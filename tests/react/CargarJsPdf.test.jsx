import { afterEach, beforeEach, expect, it, vi } from "vitest";

let cargarJsPdf;
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("jspdf", undefined);
  ({ cargarJsPdf } = await import("../../src/servicios/cargar-jspdf.js"));
});
afterEach(() => {
  document.head.querySelectorAll('script[src*="vendor/jspdf.umd.min.js"]').forEach(script => script.remove());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const scripts = () => document.head.querySelectorAll('script[src*="vendor/jspdf.umd.min.js"]');

it("no carga al importar y reutiliza un constructor existente", async () => {
  expect(scripts()).toHaveLength(0);
  const constructor = vi.fn();
  vi.stubGlobal("jspdf", { jsPDF: constructor });
  expect(await cargarJsPdf()).toBe(constructor);
  expect(scripts()).toHaveLength(0);
});

it("comparte una sola carga concurrente y reutiliza la librería cargada", async () => {
  const primera = cargarJsPdf();
  const segunda = cargarJsPdf();
  expect(segunda).toBe(primera);
  expect(scripts()).toHaveLength(1);
  const script = scripts()[0];
  expect(script.getAttribute("src")).toBe(`${import.meta.env.BASE_URL}vendor/jspdf.umd.min.js`);
  expect(script.async).toBe(true);
  const constructor = vi.fn();
  vi.stubGlobal("jspdf", { jsPDF: constructor });
  script.dispatchEvent(new Event("load"));
  expect(await primera).toBe(constructor);
  expect(await segunda).toBe(constructor);
  expect(script.onload).toBeNull();
  expect(script.onerror).toBeNull();
  expect(await cargarJsPdf()).toBe(constructor);
  expect(scripts()).toHaveLength(1);
});

it.each(["error", "load"])("rechaza %s sin exportación y permite una nueva carga", async evento => {
  const carga = cargarJsPdf();
  const fallo = expect(carga).rejects.toThrow(evento === "error" ? /No se pudo cargar/ : /generador válido/);
  const anterior = scripts()[0];
  anterior.dispatchEvent(new Event(evento));
  await fallo;
  expect(anterior.isConnected).toBe(false);
  const reintento = cargarJsPdf();
  expect(scripts()).toHaveLength(1);
  expect(scripts()[0]).not.toBe(anterior);
  const constructor = vi.fn();
  vi.stubGlobal("jspdf", { jsPDF: constructor });
  scripts()[0].dispatchEvent(new Event("load"));
  expect(await reintento).toBe(constructor);
});

it("limita la espera y descarta eventos del intento vencido durante el reintento", async () => {
  vi.useFakeTimers();
  const carga = cargarJsPdf();
  const fallo = expect(carga).rejects.toThrow(/tardó demasiado/);
  const anterior = scripts()[0];
  await vi.advanceTimersByTimeAsync(15000);
  await fallo;
  expect(anterior.isConnected).toBe(false);
  const reintento = cargarJsPdf();
  anterior.dispatchEvent(new Event("error"));
  expect(scripts()).toHaveLength(1);
  const constructor = vi.fn();
  vi.stubGlobal("jspdf", { jsPDF: constructor });
  scripts()[0].dispatchEvent(new Event("load"));
  expect(await reintento).toBe(constructor);
  expect(vi.getTimerCount()).toBe(0);
});

it("un export no invocable no se acepta como generador", async () => {
  vi.stubGlobal("jspdf", { jsPDF: {} });
  const carga = cargarJsPdf();
  const fallo = expect(carga).rejects.toThrow(/generador válido/);
  scripts()[0].dispatchEvent(new Event("load"));
  await fallo;
  expect(scripts()).toHaveLength(0);
});

it("un fallo al insertar el script limpia el intento y permite reintentar", async () => {
  vi.useFakeTimers();
  const insertar = vi.spyOn(document.head, "appendChild").mockImplementationOnce(() => {
    throw new Error("Inserción bloqueada");
  });
  await expect(cargarJsPdf()).rejects.toThrow("Inserción bloqueada");
  expect(vi.getTimerCount()).toBe(0);
  insertar.mockRestore();
  const reintento = cargarJsPdf();
  const constructor = vi.fn();
  vi.stubGlobal("jspdf", { jsPDF: constructor });
  scripts()[0].dispatchEvent(new Event("load"));
  expect(await reintento).toBe(constructor);
});
