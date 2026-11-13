import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crearPdfComprobante } from "../../src/servicios/comprobante.js";

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
  }));
});

function soporteImagen() {
  return {
    getImageProperties: () => ({ width: 350, height: 355 }),
    internal: { pageSize: { getWidth: () => 100, getHeight: () => 150 } },
    addImage() {},
  };
}

function crearPdfMock({ paginas = 1, textos = [], rectangulos = [], imagenes = [], lineas = [] } = {}) {
  let numeroPaginas = paginas;
  let estiloFuente = "normal";
  let tamanoFuente = null;
  return {
    ...soporteImagen(),
    setFont: vi.fn((_familia, estilo) => { estiloFuente = estilo; }),
    setFontSize: vi.fn((tamano) => { tamanoFuente = tamano; }),
    setTextColor: vi.fn(), setFillColor: vi.fn(),
    line(...argumentos) { lineas.push(argumentos); }, setPage: vi.fn(),
    rect(...argumentos) { rectangulos.push(argumentos); },
    addImage(...argumentos) { imagenes.push(argumentos); },
    text(texto, x, y) { textos.push({ texto, x, y, estiloFuente, tamanoFuente }); },
    getTextWidth: (texto) => String(texto).length * 1.1,
    splitTextToSize: (texto) => texto.split("\n"),
    addPage() { numeroPaginas += 1; },
    getNumberOfPages: () => numeroPaginas,
  };
}

it("crea una etiqueta de 100 x 150 mm con radicado y Code 128", async () => {
  let opciones;
  const textos = [];
  const rectangulos = [];
  const lineas = [];
  const pdf = crearPdfMock({ textos, rectangulos, lineas });
  vi.stubGlobal("jspdf", {
    jsPDF: function (configuracion) {
      opciones = configuracion;
      return pdf;
    },
  });

  await expect(crearPdfComprobante({
    numero_radicado: "RAD-20261113-0008",
    fecha_hora: "13/11/2026, 10:36:47 a. m.",
    tipo_comunicacion: "Interna",
    dependencia_remitente: "Talento Humano",
    tipo_tramite: "Derecho de petición",
    numero_folios: 5,
    dependencia_destino: "Alcaldía Municipal",
    usuario_recibe: "Ana Pérez",
    remitente_nombre: "Juan Pérez",
    remitente_documento: "123456",
    asunto_documento: "Solicitud de información",
  })).resolves.toBe(pdf);

  expect(opciones).toEqual({
    unit: "mm",
    format: [100, 150],
    orientation: "portrait",
    compress: true,
  });
  expect(textos.some(({ texto }) => texto === "RAD-20261113-0008")).toBe(true);
  expect(textos.some(({ texto }) => texto === "Dependencia remitente:")).toBe(true);
  expect(textos.some(({ texto }) => texto === "Talento Humano")).toBe(true);
  expect(textos.find(({ texto }) => texto === "Tipo de comunicación:")?.estiloFuente).toBe("bold");
  expect(textos.find(({ texto }) => texto === "Interna")?.estiloFuente).toBe("normal");
  expect(textos.filter(({ texto }) => texto === "RAD-20261113-0008")).toHaveLength(1);
  expect(textos.some(({ texto }) => texto === "Número de radicado:")).toBe(false);
  expect(textos.find(({ texto }) => texto === "ALCALDÍA MUNICIPAL")?.tamanoFuente).toBe(7.5);
  expect(textos.find(({ texto }) => texto === "Sistema de Ventanilla Única")?.tamanoFuente).toBe(4.8);
  expect(lineas).toContainEqual([6, 18, 94, 18]);

  const barras = rectangulos.filter(([, , , alto, estilo]) => estilo === "F" && alto === 9);
  expect(barras.length).toBeGreaterThan(20);
  expect(Math.min(...barras.map(([x]) => x))).toBeCloseTo(19);
  expect(Math.max(...barras.map(([x, , ancho]) => x + ancho))).toBeLessThanOrEqual(81.01);
});

it.each(["Planeación histórica", null])("incluye el origen interno guardado %s y pagina asuntos largos", async (origen) => {
  const paginas = { valor: 1 };
  const textos = [];
  const pdf = crearPdfMock({ textos });
  pdf.addPage = vi.fn(() => { paginas.valor += 1; });
  pdf.getNumberOfPages = () => paginas.valor;
  vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });

  expect(await crearPdfComprobante({
    numero_radicado: "RAD-20261113-0008",
    tipo_comunicacion: "Interna", dependencia_remitente: origen,
    asunto_documento: Array(90).fill("Línea del asunto").join("\n"),
  })).toBe(pdf);
  expect(textos.some(({ texto }) => texto === "Dependencia remitente:")).toBe(true);
  expect(textos.some(({ texto }) => texto === (origen || "No registrada"))).toBe(true);
  expect(paginas.valor).toBeGreaterThan(1);
  expect(textos.filter(({ texto }) => texto === "Línea del asunto").every(({ y }) => y <= 137)).toBe(true);
  expect(pdf.addPage).toHaveBeenCalledWith([100, 150], "portrait");
});

it.each([false, 0, true, undefined])("incluye datos externos y solo imprime la regla explícita sin respuesta (%s)", async (regla) => {
  const textos = [];
  const pdf = crearPdfMock({ textos });
  vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });
  await crearPdfComprobante({
    requiere_respuesta: regla,
    tipo_comunicacion: "Externa", remitente_tipo_persona: "juridica",
    remitente_entidad: "Empresa", remitente_nit: "123", remitente_email: "a@example.com",
    dependencia_remitente: "No corresponde",
  });
  expect(textos.map(({ texto }) => texto)).toEqual(expect.arrayContaining([
    "Tipo de persona:", "Jurídica", "Entidad / razón social:", "Empresa",
    "NIT:", "123", "Correo:", "a@example.com",
  ]));
  expect(textos.some(({ texto }) => texto.includes("Dependencia remitente"))).toBe(false);
  expect(textos.some(({ texto }) => texto.includes("No requiere respuesta"))).toBe(regla === false || regla === 0);
});

it("dibuja el escudo pequeño en cada página sin marca de agua", async () => {
  const paginas = { valor: 1 };
  const imagenes = [];
  const textos = [];
  const pdf = crearPdfMock({ paginas: 1, textos, imagenes });
  pdf.addPage = vi.fn(() => { paginas.valor += 1; });
  pdf.getNumberOfPages = () => paginas.valor;
  vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });

  await crearPdfComprobante({ asunto_documento: Array(90).fill("Detalle legible").join("\n") });
  expect(imagenes).toHaveLength(paginas.valor);
  expect(imagenes[0].slice(1, 5)).toEqual(["PNG", 6, 5, 9]);
  expect(fetch).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}img/escudo-miranda.png`);
});

it("rechaza la carga fallida del escudo y permite reintentar sin PDF incompleto", async () => {
  const pdf = { ...soporteImagen(), addImage: vi.fn(), text: vi.fn() };
  vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });
  fetch.mockResolvedValueOnce({ ok: false, status: 404 });
  await expect(crearPdfComprobante({})).rejects.toThrow(/escudo institucional.*404/);
  expect(pdf.addImage).not.toHaveBeenCalled();
  expect(pdf.text).not.toHaveBeenCalled();
  fetch.mockRejectedValueOnce(new Error("Sin conexión"));
  await expect(crearPdfComprobante({})).rejects.toThrow("Sin conexión");
  expect(fetch).toHaveBeenCalledTimes(2);
});
