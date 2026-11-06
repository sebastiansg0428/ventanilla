import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepararEstilosDom } from "./helpers/estilos-dom.js";
import { RespuestasInternas, TrazabilidadInterna } from "../../src/componentes/RespuestasInternas";
import { solicitarApi } from "../../src/servicios/api";
vi.mock("../../src/servicios/api", () => ({ solicitarApi: vi.fn() }));
const usuario = { id: 1, rol: "funcionario", dependencia_id: 7 };
const recepcion = { id: 1, respuesta_id: 10, dependencia_origen_id: 7, historica: 0,
  numero_radicado: "INTERNO-FICTICIO", contenido: "Respuesta institucional de prueba.",
  dependencia_destino: "Oficina ficticia", disponible_en_utc: "2026-11-05 15:00:00.000000",
  primera_apertura_utc: null, actor_nombre: null };
const confirmada = { ...recepcion, primera_apertura_utc: "2026-11-05 15:10:00.000000", actor_nombre: "Actor ficticio" };
const json = datos => ({ json: async () => ({ success: true, ...datos }) });
const lista = r => json({ registros: [r], pagina: 1, paginas: 1, total: 1,
  resumen: { total: 1, pendientes: r.primera_apertura_utc ? 0 : 1, leidas: r.primera_apertura_utc ? 1 : 0 } });
beforeAll(prepararEstilosDom);

function diferida() {
  let resolve;
  const promise = new Promise(ok => { resolve = ok; });
  return { promise, resolve };
}
async function abrirBandeja() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver bandeja interna" })));
  expect(screen.getByRole("button", { name: "Abrir respuesta interna INTERNO-FICTICIO" })).toBeTruthy();
}
async function abrirDetalle() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Abrir respuesta interna INTERNO-FICTICIO" })));
  expect(screen.getByRole("article", { name: "Respuesta interna abierta" })).toBeTruthy();
}
beforeEach(() => {
  vi.resetAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:ficticio");
  URL.revokeObjectURL = vi.fn();
  solicitarApi.mockImplementation(ruta => Promise.resolve(ruta.includes("?") ? lista(recepcion)
    : ruta.endsWith("/apertura") ? json({ recepcion: confirmada }) : json({ recepcion, documentos: [] })));
});
describe("respuestas internas digitales", () => {
  it("carga diferida y listar no registran apertura; mostrar contenido si la registra", async () => {
    render(<RespuestasInternas usuario={usuario} />);
    expect(solicitarApi).not.toHaveBeenCalled();
    await abrirBandeja();
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
    await abrirDetalle();
    await screen.findByText(/Actor ficticio/);
    expect(screen.getByText("Respuesta institucional de prueba.")).toBeTruthy();
    const posts = solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe("/api/respuestas-internas/1/apertura");
    expect(posts[0][1].body).toBe("{}");
  });
  it("espera los PDF antes de acreditar y libera blobs al cerrar", async () => {
    const pdf = diferida();
    solicitarApi.mockImplementation(ruta => Promise.resolve(ruta.includes("?") ? lista(recepcion)
      : ruta.endsWith("/documentos/4") ? pdf.promise : ruta.endsWith("/apertura") ? json({ recepcion: confirmada })
        : json({ recepcion, documentos: [{ id: 4, nombre_archivo: "oficio.pdf", tamano_bytes: 100 }] })));
    render(<RespuestasInternas usuario={usuario} />); await abrirBandeja();
    fireEvent.click(screen.getByRole("button", { name: /Abrir respuesta interna/ }));
    await screen.findByText("Cargando respuesta interna y PDF…");
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
    await act(async () => pdf.resolve({ blob: async () => new Blob(["ficticio"]) }));
    await screen.findByRole("link", { name: "oficio.pdf" });
    await screen.findByText(/Actor ficticio/);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar respuesta interna" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:ficticio");
  });
  it("cerrar durante carga descarta resultado tardio y no acredita", async () => {
    const pendiente = diferida();
    solicitarApi.mockImplementation(ruta => ruta.includes("?") ? Promise.resolve(lista(recepcion)) : pendiente.promise);
    render(<RespuestasInternas usuario={usuario} />); await abrirBandeja();
    fireEvent.click(screen.getByRole("button", { name: /Abrir respuesta interna/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar respuesta interna" }));
    await act(async () => pendiente.resolve(json({ recepcion, documentos: [] })));
    expect(screen.queryByRole("article")).toBeNull();
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });
  it("error PDF es explicito y no acredita", async () => {
    solicitarApi.mockImplementation(ruta => ruta.includes("/documentos/") ? Promise.reject(new Error("PDF ausente"))
      : Promise.resolve(ruta.includes("?") ? lista(recepcion)
        : json({ recepcion, documentos: [{ id: 4, nombre_archivo: "oficio.pdf", tamano_bytes: 100 }] })));
    render(<RespuestasInternas usuario={usuario} />); await abrirBandeja();
    fireEvent.click(screen.getByRole("button", { name: /Abrir respuesta interna/ }));
    await screen.findByText("PDF ausente");
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });
  it("error de acuse no oculta respuesta y permite reintento sin fecha cliente", async () => {
    let fallo = true;
    solicitarApi.mockImplementation((ruta, o) => o?.method === "POST"
      ? fallo ? Promise.reject(new Error("Confirmación incierta")) : Promise.resolve(json({ recepcion: confirmada }))
      : Promise.resolve(ruta.includes("?") ? lista(recepcion) : json({ recepcion, documentos: [] })));
    render(<RespuestasInternas usuario={usuario} />); await abrirBandeja(); await abrirDetalle();
    await screen.findByText(/Confirmación incierta/);
    expect(screen.getByText("Respuesta institucional de prueba.")).toBeTruthy();
    expect(screen.getByText("Sin primera apertura registrada")).toBeTruthy();
    fallo = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar registro de apertura" }));
    await screen.findByText(/Actor ficticio/);
    expect(solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(2);
  });
  it("primera apertura existente no se sobrescribe y historicas no inventan disponibilidad", async () => {
    solicitarApi.mockImplementation(ruta => Promise.resolve(ruta.includes("?") ? lista(confirmada)
      : json({ recepcion: { ...confirmada, historica: 1, disponible_en_utc: null }, documentos: [] })));
    render(<RespuestasInternas usuario={usuario} />); await abrirBandeja(); await abrirDetalle();
    expect(screen.getByText(/fecha de disponibilidad anterior desconocida/)).toBeTruthy();
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });
  it("migracion pendiente muestra error sin bandeja vacia aparente", async () => {
    solicitarApi.mockRejectedValue(new Error("Recepcion interna no activada: migracion 027."));
    render(<RespuestasInternas usuario={usuario} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver bandeja interna" }));
    await screen.findByText(/no activada/);
    expect(screen.queryByText("No hay respuestas internas para este filtro.")).toBeNull();
  });
  it("filtro reinicia pagina y consulta servidor", async () => {
    render(<RespuestasInternas usuario={usuario} />); await abrirBandeja();
    fireEvent.change(screen.getByLabelText("Filtrar respuestas internas"), { target: { value: "pendientes" } });
    await waitFor(() => expect(solicitarApi).toHaveBeenCalledWith("/api/respuestas-internas?pagina=1&estado=pendientes", undefined));
  });
  for (const rol of ["ventanilla", "administrador", "funcionario"]) {
    it(`consulta de trazabilidad de ${rol} ajeno al origen no registra apertura`, async () => {
      solicitarApi.mockResolvedValue(json({ recepcion }));
      render(<TrazabilidadInterna radicado={{ numero_radicado: recepcion.numero_radicado, dependencia_remitente_id: 7 }}
        usuario={{ id: 2, rol, dependencia_id: rol === "funcionario" ? 9 : null }} />);
      fireEvent.click(screen.getByRole("button", { name: "Ver recepción digital" }));
      await screen.findByText("Sin primera apertura registrada");
      expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
    });
  }
});
