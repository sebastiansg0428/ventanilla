import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeguimientoEntrega } from "../../src/componentes/SeguimientoEntrega";
import { solicitarApi } from "../../src/servicios/api";
vi.mock("../../src/servicios/api", () => ({ solicitarApi: vi.fn() }));
const radicado = { numero_radicado: "RAD-FICTICIO", remitente_nombre: "Persona ficticia", remitente_email: "fixture@example.test" };
const registro = { id: 1, resultado: "entrega_acreditada", canal: "correo_electronico", destinatario: "Persona ficticia",
  destino: "fixture@example.test", actor_nombre: "Actor ficticio", observaciones: "Constancia ficticia",
  fecha_actuacion_utc: "2026-01-05 15:00:00.000000", creado_en_utc: "2026-01-05 15:00:00.000000",
  anulado_en_utc: null, evidencias: [{ id: 1, nombre_archivo: "evidencia.pdf", tamano_bytes: 100, sha256: "a".repeat(64) }] };
const json = objeto => ({ json: async () => objeto });
const historial = (registros = [], cambios = {}) => json({ success: true, registros,
  resumen: registros.length ? "entrega_acreditada" : "pendiente_de_envio", total: registros.length,
  pagina: 1, paginas: registros.length ? 1 : 0, ...cambios });
const props = (rol = "ventanilla") => ({ radicado, usuario: { id: 1, rol }, alProceso: vi.fn(), alPerderAcceso: vi.fn(() => false) });
function diferida() {
  let resolve; let reject;
  const promise = new Promise((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}
async function abrir() {
  fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento de entrega" }));
  await screen.findByText(/Seguimiento:/);
}
function formulario() { return screen.getByRole("button", { name: /Confirmar envío\/entrega|Reintentar registro/ }).closest("form"); }
function completar() {
  fireEvent.change(screen.getByLabelText("Fecha y hora de actuación (Bogotá)"), { target: { value: "2026-01-05T10:00" } });
}
beforeEach(() => {
  vi.resetAllMocks();
  solicitarApi.mockResolvedValue(historial());
  URL.createObjectURL = vi.fn(() => "blob:evidencia");
  URL.revokeObjectURL = vi.fn();
});
describe("seguimiento manual de entrega", () => {
  it("carga solo al abrir; funcionario consulta sin registrar ni anular", async () => {
    solicitarApi.mockResolvedValue(historial([registro]));
    render(<SeguimientoEntrega {...props("funcionario")} />);
    expect(solicitarApi).not.toHaveBeenCalled();
    await abrir();
    expect(screen.getByText(/no envía correos/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Confirmar envío/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Anular registro/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Entrega acreditada" })).toBeTruthy();
  });
  it("precompleta datos editables y exige PDF y observaciones segun resultado", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); completar();
    expect(screen.getByLabelText("Correo de destino").value).toBe("fixture@example.test");
    expect(screen.getByLabelText("Destinatario").value).toBe("Persona ficticia");
    fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: "entrega_acreditada" } });
    expect(screen.getByLabelText("Evidencias PDF (obligatorias)").required).toBe(true);
    fireEvent.submit(formulario());
    expect(screen.getByRole("alert").textContent).toContain("Acreditar requiere evidencia");
    expect(solicitarApi).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: "intento_fallido" } });
    expect(screen.getByLabelText("Observaciones (obligatorias)").required).toBe(true);
    fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "presencial" } });
    expect(screen.getByLabelText("Lugar o dirección de entrega").value).toBe("");
  });
  it.each([
    [new File(["x"], "imagen.png")],
    [new File([new Uint8Array(10 * 1024 * 1024 + 1)], "grande.pdf")],
    Array.from({ length: 6 }, () => new File(["x"], "evidencia.pdf")),
  ])("rechaza archivos fuera de limites sin enviar: %s", async (...archivos) => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); completar();
    fireEvent.change(screen.getByLabelText("Evidencias PDF (opcionales)"), { target: { files: archivos } });
    fireEvent.submit(formulario());
    expect(screen.getByRole("alert").textContent).toContain("hasta 5 PDF de 10 MB");
    expect(solicitarApi).toHaveBeenCalledTimes(1);
  });
  it("bloquea doble envio y reintenta exactamente FormData/UUID/PDF tras incertidumbre", async () => {
    const pendiente = diferida(); const p = props();
    solicitarApi.mockImplementation((ruta, opciones) => opciones?.method === "POST" ? pendiente.promise : Promise.resolve(historial()));
    render(<SeguimientoEntrega {...p} />); await abrir(); completar();
    const pdf = new File(["fixture"], "evidencia.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Evidencias PDF (opcionales)"), { target: { files: [pdf] } });
    const form = formulario();
    fireEvent.submit(form); fireEvent.submit(form);
    expect(solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
    expect(screen.getByLabelText("Canal").disabled).toBe(true);
    expect(p.alProceso).toHaveBeenCalledWith(true);
    await act(async () => pendiente.reject(Object.assign(new Error("Resultado incierto"), { status: 500 })));
    expect(screen.getByLabelText("Canal").disabled).toBe(true);
    const datos = solicitarApi.mock.calls.find(([, o]) => o?.method === "POST")[1].body;
    expect(datos.get("fecha_actuacion")).toBe("2026-01-05T10:00");
    expect(datos.get("archivos").name).toBe("evidencia.pdf");
    solicitarApi.mockImplementation((ruta, o) => Promise.resolve(o?.method === "POST"
      ? json({ success: true, registro: { ...registro, resultado: "enviado" } }) : historial()));
    fireEvent.submit(form);
    await screen.findByText("Registro de envío/entrega confirmado.");
    const posts = solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST");
    expect(posts[1][1].body).toBe(datos);
    expect(p.alProceso).toHaveBeenLastCalledWith(false);
  });
  it("muestra 503 sin formulario; fallo definitivo permite corregir datos", async () => {
    solicitarApi.mockRejectedValueOnce(Object.assign(new Error("Falta migración 025"), { status: 503 }));
    render(<SeguimientoEntrega {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento de entrega" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Falta migración 025");
    expect(screen.queryByRole("button", { name: "Confirmar envío/entrega" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar entregas" }));
    await screen.findByText(/Seguimiento:/); completar();
    solicitarApi.mockRejectedValueOnce(Object.assign(new Error("Destino inválido"), { status: 400 }));
    fireEvent.submit(formulario());
    await screen.findByText("Destino inválido");
    expect(screen.getByLabelText("Canal").disabled).toBe(false);
  });
  it("acreditacion bloquea registro; anula con motivo, conserva tarjeta y evidencia", async () => {
    solicitarApi.mockResolvedValue(historial([registro]));
    render(<SeguimientoEntrega {...props("administrador")} />); await abrir();
    expect(screen.queryByRole("button", { name: "Confirmar envío/entrega" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Anular registro 1" }));
    fireEvent.change(screen.getByLabelText("Motivo de anulación"), { target: { value: "  Corrección ficticia documentada.  " } });
    const anulado = { ...registro, anulado_en_utc: "2026-01-06 15:00:00.000000", anulador_nombre: "Actor ficticio",
      motivo_anulacion: "Corrección ficticia documentada." };
    solicitarApi.mockImplementation((ruta, o) => Promise.resolve(o?.method === "POST"
      ? json({ success: true, registro: anulado }) : historial([anulado], { resumen: "pendiente_de_envio" })));
    fireEvent.submit(screen.getByRole("button", { name: "Confirmar anulación" }).closest("form"));
    await screen.findByText("Anulación confirmada. La evidencia se conserva.");
    await screen.findByRole("button", { name: "Confirmar envío/entrega" });
    expect(screen.getByText(/· Anulado/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir evidencia: evidencia.pdf" })).toBeTruthy();
    const post = solicitarApi.mock.calls.find(([, o]) => o?.method === "POST");
    expect(post[0]).toContain("/1/anulacion");
    expect(JSON.parse(post[1].body)).toEqual({ motivo: "Corrección ficticia documentada." });
  });
  it("paginas de 25 y callback parental cambiante no recargan innecesariamente", async () => {
    const p = props("funcionario");
    solicitarApi.mockResolvedValue(historial([registro], { total: 26, paginas: 2 }));
    const vista = render(<SeguimientoEntrega {...p} />); await abrir();
    vista.rerender(<SeguimientoEntrega {...p} alPerderAcceso={vi.fn()} />);
    expect(solicitarApi).toHaveBeenCalledTimes(1);
    solicitarApi.mockResolvedValue(historial([registro], { total: 26, paginas: 2, pagina: 2 }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(solicitarApi.mock.calls.at(-1)[0]).toContain("?pagina=2"));
  });
  it("PDF autenticado y URLs liberadas al desmontar", async () => {
    solicitarApi.mockResolvedValue(historial([registro]));
    const vista = render(<SeguimientoEntrega {...props("funcionario")} />); await abrir();
    solicitarApi.mockResolvedValue({ blob: async () => new Blob(["fixture"], { type: "application/pdf" }) });
    fireEvent.click(screen.getByRole("button", { name: "Abrir evidencia: evidencia.pdf" }));
    expect((await screen.findByRole("link", { name: "evidencia.pdf" })).getAttribute("href")).toBe("blob:evidencia");
    expect(solicitarApi.mock.calls.at(-1)[0]).toContain("/1/evidencias/1");
    vista.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:evidencia");
  });
  it("historial mal formado es error explicito, nunca ausencia de entregas", async () => {
    solicitarApi.mockResolvedValue(historial([{ ...registro, evidencias: null }]));
    render(<SeguimientoEntrega {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento de entrega" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Historial de entrega inválido.");
    expect(screen.queryByText("No hay registros de envío o entrega.")).toBeNull();
  });
  it("confirmacion incompleta no informa exito y conserva intento para replay", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); completar();
    solicitarApi.mockResolvedValueOnce(json({ success: true, registro: { id: 1 } }));
    fireEvent.submit(formulario());
    expect((await screen.findByRole("alert")).textContent).toContain("Confirmación incompleta");
    expect(screen.queryByText("Registro de envío/entrega confirmado.")).toBeNull();
    expect(screen.getByRole("button", { name: "Reintentar registro" })).toBeTruthy();
  });
  it("perdida de permiso durante consulta se comunica al padre", async () => {
    const p = props(); p.alPerderAcceso.mockReturnValue(true);
    const error = Object.assign(new Error("Sin acceso"), { status: 404 });
    solicitarApi.mockRejectedValue(error);
    render(<SeguimientoEntrega {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento de entrega" }));
    await waitFor(() => expect(p.alPerderAcceso).toHaveBeenCalledWith(error));
  });
  it("descarta descargas y GET tardios tras desmontar", async () => {
    solicitarApi.mockResolvedValue(historial([registro]));
    const vista = render(<SeguimientoEntrega {...props("funcionario")} />); await abrir();
    const lenta = diferida(); solicitarApi.mockReturnValue(lenta.promise);
    fireEvent.click(screen.getByRole("button", { name: "Abrir evidencia: evidencia.pdf" }));
    vista.unmount();
    await act(async () => lenta.resolve({ blob: async () => new Blob(["fixture"]) }));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    const get = diferida(); solicitarApi.mockReturnValue(get.promise);
    const otra = render(<SeguimientoEntrega {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento de entrega" }));
    otra.unmount();
    await act(async () => get.resolve(historial([registro])));
    expect(screen.queryByText(/Seguimiento:/)).toBeNull();
  });
});
