import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepararEstilosDom } from "./helpers/estilos-dom.js";
import { SeguimientoEntrega } from "../../src/componentes/SeguimientoEntrega";
import { solicitarApi } from "../../src/servicios/api";
vi.mock("../../src/servicios/api", () => ({ solicitarApi: vi.fn() }));
const radicado = { numero_radicado: "RAD-FICTICIO", remitente_nombre: "Persona ficticia", remitente_email: "fixture@example.test" };
const registro = { id: 1, resultado: "entrega_acreditada", canal: "correo_electronico", destinatario: "Persona ficticia",
  destino: "fixture@example.test", actor_nombre: "Actor ficticio", observaciones: "Constancia ficticia",
  fecha_actuacion_utc: "2026-01-05 15:00:00.000000", creado_en_utc: "2026-01-05 15:00:00.000000",
  anulado_en_utc: null, evidencias: [{ id: 1, nombre_archivo: "evidencia.pdf", tamano_bytes: 100, sha256: "a".repeat(64) }] };
const json = objeto => ({ json: async () => Array.isArray(objeto.documentos)
  ? { fecha_respuesta_epoch: 1735689600, ...objeto } : objeto });
const historial = (registros = [], cambios = {}) => json({ success: true, registros,
  automatico_disponible: true, fecha_real_disponible: true,
  resumen: registros.length ? "entrega_acreditada" : "pendiente_de_envio", total: registros.length,
  pagina: 1, paginas: registros.length ? 1 : 0, ...cambios });
const props = (rol = "ventanilla") => ({ radicado, usuario: { id: 1, rol }, alProceso: vi.fn(), alPerderAcceso: vi.fn(() => false) });
beforeAll(prepararEstilosDom);

function diferida() {
  let resolve; let reject;
  const promise = new Promise((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}
async function abrir() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento de entrega" })));
  expect(screen.getByText(/Seguimiento:/)).toBeTruthy();
}
function formulario() { return screen.getByRole("button", { name: /Confirmar envío\/entrega|Reintentar registro/ }).closest("form"); }
async function completar() {
  solicitarApi.mockResolvedValueOnce(json({ success: true, documentos: [] }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Registrar envío/entrega" })));
  expect(screen.getByText("La respuesta institucional no tiene PDF adjuntos.")).toBeTruthy();
}
beforeEach(() => {
  vi.resetAllMocks();
  solicitarApi.mockImplementation(ruta => Promise.resolve(ruta.endsWith("/documentos-respuesta")
    ? json({ success: true, documentos: [] }) : historial()));
  URL.createObjectURL = vi.fn(() => "blob:evidencia");
  URL.revokeObjectURL = vi.fn();
});
describe("seguimiento manual de entrega", () => {
  it("sin 029 conserva lectura y evidencia pero explica y bloquea nuevos registros", async () => {
    solicitarApi.mockResolvedValue(historial([registro], { fecha_real_disponible: false }));
    render(<SeguimientoEntrega {...props()} />); await abrir();
    expect(screen.getByRole("button", { name: "Registrar envío/entrega" }).disabled).toBe(true);
    expect(screen.getByText(/requiere aplicar y verificar la migración 029/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir evidencia: evidencia.pdf" })).toBeTruthy();
    expect(screen.getByText(/requiere aplicar y verificar la migración 029/).className)
      .toContain("entregas-aviso--sistema");
  });
  it("asocia el formulario con su título y ayuda, y conserva estados distinguibles", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    const form = formulario();
    expect(form.getAttribute("aria-labelledby")).toBe("entrega-formulario-titulo");
    expect(form.getAttribute("aria-describedby")).toBe("entrega-formulario-ayuda");
    expect(screen.getByRole("heading", { name: "Registrar envío/entrega" })).toBeTruthy();
    expect(screen.getByText(/Registro manual: no envía correos/).className)
      .toContain("entregas-aviso--legal");
    fireEvent.change(screen.getByLabelText("Fecha y hora de actuación (Bogotá)"),
      { target: { value: "2999-01-01T10:00" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert").className).toContain("entregas-mensaje--error");
  });
  it("fecha anterior exige justificacion, rechaza futuro y congela la fecha durante replay", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    const campo = screen.getByLabelText("Fecha y hora de actuación (Bogotá)");
    fireEvent.change(campo, { target: { value: "2024-12-01T10:30" } });
    const motivo = screen.getByLabelText("Justificación de actuación anterior a la respuesta");
    expect(motivo.required).toBe(true);
    fireEvent.submit(formulario());
    expect(screen.getByRole("alert").textContent).toContain("justifica");
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
    fireEvent.change(motivo, { target: { value: "Registro posterior de la respuesta." } });
    const pendiente = diferida();
    solicitarApi.mockReturnValueOnce(pendiente.promise);
    fireEvent.submit(formulario());
    const form = solicitarApi.mock.calls.find(([, o]) => o?.method === "POST")[1].body;
    expect(form.get("justificacion_fecha_anterior")).toBe("Registro posterior de la respuesta.");
    expect(form.get("fecha_actuacion")).toContain("2024-12-01T10:30");
    await act(async () => pendiente.reject(new Error("Sin confirmación")));
    expect(campo.disabled).toBe(true);
    expect(motivo.disabled).toBe(true);
  });
  it("fecha futura no permite POST, historico y fecha real se distinguen al consultar", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    fireEvent.change(screen.getByLabelText("Fecha y hora de actuación (Bogotá)"), { target: { value: "2999-01-01T10:00" } });
    fireEvent.submit(formulario());
    expect(screen.getByRole("alert").textContent).toContain("no futura");
    expect(document.activeElement).toBe(screen.getByRole("alert"));
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Volver al historial" }));
    solicitarApi.mockResolvedValue(historial([registro, { ...registro, id: 2, fecha_real_declarada: true,
      justificacion_fecha_anterior: "Actuación anterior justificada." }]));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Actualizar entregas" })));
    expect(screen.getByText("Fecha de actuación histórica")).toBeTruthy();
    expect(screen.getByText("Fecha real de la actuación")).toBeTruthy();
    expect(screen.getByText("Actuación anterior justificada.")).toBeTruthy();
  });
  it("recargar conserva marcado/desmarcado por ID y hash; nuevos, cambiados y retirados requieren revision", async () => {
    let docs = [1, 2, 3, 4].map(id => ({ id, nombre_archivo: `oficio-${id}.pdf`, tamano_bytes: 100, sha256: String(id).repeat(64) }));
    solicitarApi.mockImplementation(ruta => Promise.resolve(ruta.endsWith("/documentos-respuesta")
      ? json({ success: true, documentos: docs }) : historial()));
    render(<SeguimientoEntrega {...props()} />); await abrir();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Registrar envío/entrega" })));
    fireEvent.click(screen.getByRole("checkbox", { name: /oficio-2/ }));
    const archivo = new File(["fixture"], "constancia.pdf");
    fireEvent.change(screen.getByLabelText("Evidencias PDF (opcionales)"), { target: { files: [archivo] } });
    docs = [docs[0], docs[1], { ...docs[2], sha256: "a".repeat(64) },
      { id: 5, nombre_archivo: "nuevo.pdf", tamano_bytes: 100, sha256: "b".repeat(64) }];
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Recargar lista de PDF" })));
    expect(screen.getByRole("checkbox", { name: /oficio-1/ }).checked).toBe(true);
    expect(screen.getByRole("checkbox", { name: /oficio-2/ }).checked).toBe(false);
    expect(screen.getByRole("checkbox", { name: /oficio-3/ }).checked).toBe(false);
    expect(screen.getByRole("checkbox", { name: /nuevo/ }).checked).toBe(false);
    expect(screen.queryByRole("checkbox", { name: /oficio-4/ })).toBeNull();
    expect(screen.getByText(/2 PDF nuevos o modificados sin seleccionar; 1 retirados/)).toBeTruthy();
    expect(screen.getByText(/constancia.pdf/)).toBeTruthy();
  });
  it("seleccion invalida conserva PDF valido sin enviarlo accidentalmente", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    const input = screen.getByLabelText("Evidencias PDF (opcionales)");
    fireEvent.change(input, { target: { files: [new File(["fixture"], "conservar.pdf")] } });
    fireEvent.change(input, { target: { files: [new File(["x"], "invalido.pdf")] } });
    expect(screen.getByText(/conservar.pdf/)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("conserva");
    expect(document.activeElement).toBe(screen.getByRole("alert"));
    fireEvent.submit(formulario());
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });
  it("preselecciona documentos, permite desmarcar y congela IDs/hash y fecha real", async () => {
    const docs = [{ id: 8, nombre_archivo: "oficio-uno.pdf", tamano_bytes: 100, sha256: "a".repeat(64) },
      { id: 9, nombre_archivo: "oficio-dos.pdf", tamano_bytes: 200, sha256: "b".repeat(64) }];
    const pendiente = diferida();
    solicitarApi.mockImplementation((ruta, o) => o?.method === "POST" ? pendiente.promise
      : Promise.resolve(ruta.endsWith("/documentos-respuesta") ? json({ success: true, documentos: docs }) : historial()));
    render(<SeguimientoEntrega {...props()} />); await abrir();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Registrar envío/entrega" })));
    const primero = screen.getByRole("checkbox", { name: /oficio-uno/ });
    const segundo = screen.getByRole("checkbox", { name: /oficio-dos/ });
    expect(primero.checked).toBe(true); expect(segundo.checked).toBe(true);
    expect(screen.getByLabelText("Fecha y hora de actuación (Bogotá)").required).toBe(true);
    fireEvent.click(primero);
    fireEvent.click(screen.getByRole("button", { name: "Volver al historial" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar envío/entrega" }));
    expect(screen.getByRole("checkbox", { name: /oficio-uno/ }).checked).toBe(false);
    fireEvent.submit(formulario());
    const post = solicitarApi.mock.calls.find(([, o]) => o?.method === "POST");
    expect(JSON.parse(post[1].body.get("documentos_respuesta"))).toEqual([{ id: 9, sha256: "b".repeat(64) }]);
    expect(post[1].body.get("fecha_actuacion")).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d/);
    await act(async () => pendiente.reject(Object.assign(new Error("Confirmación incierta"), { status: 500 })));
    expect(screen.getByRole("checkbox", { name: /oficio-dos/ }).closest("fieldset").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Volver al historial" }).disabled).toBe(true);
  });
  it("catalogo fallido no se interpreta vacio; permite reintentar sin enviar", async () => {
    solicitarApi.mockImplementation(ruta => ruta.endsWith("/documentos-respuesta")
      ? Promise.reject(new Error("PDF no disponible")) : Promise.resolve(historial()));
    render(<SeguimientoEntrega {...props()} />); await abrir();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Registrar envío/entrega" })));
    await screen.findByText("PDF no disponible");
    expect(screen.getByRole("button", { name: "Confirmar envío/entrega" }).disabled).toBe(true);
    expect(screen.queryByText("La respuesta institucional no tiene PDF adjuntos.")).toBeNull();
    solicitarApi.mockResolvedValue(json({ success: true, documentos: [] }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reintentar documentos de respuesta" })));
    await screen.findByText("La respuesta institucional no tiene PDF adjuntos.");
    expect(screen.getByRole("button", { name: "Confirmar envío/entrega" }).disabled).toBe(false);
  });
  it("permite actualizar un catalogo cambiado sin perder el destinatario", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    fireEvent.change(screen.getByLabelText("Destinatario"), { target: { value: "Persona de prueba" } });
    solicitarApi.mockResolvedValue(json({ success: true, documentos: [
      { id: 8, nombre_archivo: "oficio-actualizado.pdf", tamano_bytes: 100, sha256: "c".repeat(64) },
    ] }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Recargar lista de PDF" })));
    expect(screen.getByRole("checkbox", { name: /oficio-actualizado/ }).checked).toBe(false);
    expect(screen.getByLabelText("Destinatario").value).toBe("Persona de prueba");
  });
  it("sin 026 conserva historial pero bloquea nuevos registros", async () => {
    solicitarApi.mockResolvedValue(historial([registro], { automatico_disponible: false }));
    render(<SeguimientoEntrega {...props()} />); await abrir();
    expect(screen.getByRole("button", { name: "Registrar envío/entrega" }).disabled).toBe(true);
    expect(screen.getByText(/registro automático requiere activar/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir evidencia: evidencia.pdf" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anular registro 1" })).toBeTruthy();
  });
  it("historial admite cinco documentos de respuesta y cinco evidencias con origen visible", async () => {
    const r = { ...registro, evidencias: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, nombre_archivo: `documento-${i}.pdf`, tamano_bytes: 100, sha256: "a".repeat(64),
      origen: i < 5 ? "documento_respuesta" : "evidencia_adicional",
    })) };
    solicitarApi.mockResolvedValue(historial([r]));
    render(<SeguimientoEntrega {...props("funcionario")} />); await abrir();
    expect(screen.getAllByText("Documento de respuesta")).toHaveLength(5);
    expect(screen.getAllByText("Evidencia adicional")).toHaveLength(5);
    expect(screen.getAllByRole("button", { name: /Abrir evidencia:/ })).toHaveLength(10);
  });
  it("muestra estado vacio sin formulario ni paginacion; abre por accion y devuelve foco", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir();
    expect(screen.queryByRole("button", { name: "Confirmar envío/entrega" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Páginas de entregas" })).toBeNull();
    const abrirBoton = screen.getByRole("button", { name: "Registrar envío/entrega" });
    fireEvent.click(abrirBoton);
    expect(document.activeElement).toBe(screen.getByLabelText("Canal"));
    fireEvent.click(screen.getByRole("button", { name: "Volver al historial" }));
    expect(document.activeElement).toBe(abrirBoton);
    expect(screen.queryByRole("button", { name: "Confirmar envío/entrega" })).toBeNull();
  });
  it("conserva borrador y PDF al volver al historial; permite quitar archivos", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: "entrega_acreditada" } });
    const pdf = new File(["fixture"], "borrador.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Evidencias PDF (obligatorias)"), { target: { files: [pdf] } });
    fireEvent.change(screen.getByLabelText("Destinatario"), { target: { value: "Otro destinatario ficticio" } });
    fireEvent.click(screen.getByRole("button", { name: "Volver al historial" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar envío/entrega" }));
    expect(screen.getByLabelText("Destinatario").value).toBe("Otro destinatario ficticio");
    expect(screen.getByLabelText("Fecha y hora de actuación (Bogotá)").value).toBeTruthy();
    expect(screen.getByText(/borrador.pdf/)).toBeTruthy();
    expect(screen.getByLabelText("Evidencias PDF (obligatorias)").required).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Quitar PDF seleccionados" }));
    expect(screen.queryByText(/borrador.pdf/)).toBeNull();
    expect(screen.getByLabelText("Evidencias PDF (obligatorias)").required).toBe(true);
  });
  it("envia PDF conservado tras reabrir el formulario sin exigir nueva seleccion", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: "entrega_acreditada" } });
    const pdf = new File(["fixture"], "conservado.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Evidencias PDF (obligatorias)"), { target: { files: [pdf] } });
    fireEvent.click(screen.getByRole("button", { name: "Volver al historial" }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar envío/entrega" }));
    solicitarApi.mockImplementation((ruta, o) => Promise.resolve(o?.method === "POST"
      ? json({ success: true, registro }) : historial([registro])));
    fireEvent.submit(formulario());
    await screen.findByText("Registro de envío/entrega confirmado.");
    const post = solicitarApi.mock.calls.find(([, o]) => o?.method === "POST");
    expect(post[1].body.get("archivos").name).toBe("conservado.pdf");
    expect(post[1].body.get("resultado")).toBe("entrega_acreditada");
    const registrar = screen.getByRole("button", { name: "Registrar envío/entrega" });
    await waitFor(() => expect(registrar.isConnected && registrar.disabled).toBe(true));
  });
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
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    expect(screen.getByLabelText("Correo de destino").value).toBe("fixture@example.test");
    expect(screen.getByLabelText("Destinatario").value).toBe("Persona ficticia");
    fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: "entrega_acreditada" } });
    expect(screen.getByLabelText("Evidencias PDF (obligatorias)").required).toBe(true);
    fireEvent.submit(formulario());
    expect(screen.getByRole("alert").textContent).toContain("Acreditar requiere evidencia");
    expect(solicitarApi).toHaveBeenCalledTimes(2);
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
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    fireEvent.change(screen.getByLabelText("Evidencias PDF (opcionales)"), { target: { files: archivos } });
    fireEvent.submit(formulario());
    expect(screen.getByRole("alert").textContent).toContain("hasta 5 PDF no vacíos");
    expect(solicitarApi).toHaveBeenCalledTimes(2);
  });
  it("bloquea doble envio y reintenta exactamente FormData/UUID/PDF tras incertidumbre", async () => {
    const pendiente = diferida(); const p = props();
    solicitarApi.mockImplementation((ruta, opciones) => opciones?.method === "POST" ? pendiente.promise : Promise.resolve(historial()));
    render(<SeguimientoEntrega {...p} />); await abrir(); await completar();
    const pdf = new File(["fixture"], "evidencia.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Evidencias PDF (opcionales)"), { target: { files: [pdf] } });
    const form = formulario();
    fireEvent.submit(form); fireEvent.submit(form);
    expect(solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
    expect(screen.getByLabelText("Canal").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Volver al historial" }).disabled).toBe(true);
    expect(p.alProceso).toHaveBeenCalledWith(true);
    await act(async () => pendiente.reject(Object.assign(new Error("Resultado incierto"), { status: 500 })));
    expect(screen.getByLabelText("Canal").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Volver al historial" }).disabled).toBe(true);
    const datos = solicitarApi.mock.calls.find(([, o]) => o?.method === "POST")[1].body;
    expect(datos.has("fecha_actuacion")).toBe(true);
    expect(datos.get("version")).toBe("3");
    expect(datos.get("documentos_respuesta")).toBe("[]");
    expect(datos.get("archivos").name).toBe("evidencia.pdf");
    solicitarApi.mockImplementation((ruta, o) => Promise.resolve(o?.method === "POST"
      ? json({ success: true, registro: { ...registro, resultado: "enviado" } }) : historial()));
    fireEvent.submit(form);
    await screen.findByText("Registro de envío/entrega confirmado.");
    expect(screen.queryByRole("button", { name: "Confirmar envío/entrega" })).toBeNull();
    const titulo = screen.getByRole("heading", { name: "Envío y entrega de la respuesta" });
    await waitFor(() => expect(document.activeElement).toBe(titulo));
    const posts = solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST");
    expect(posts[1][1].body).toBe(datos);
    expect(p.alProceso).toHaveBeenLastCalledWith(false);
  });
  it("muestra 503 sin formulario; fallo definitivo permite corregir datos", async () => {
    solicitarApi.mockRejectedValueOnce(Object.assign(new Error("Falta migración 025"), { status: 503 }));
    render(<SeguimientoEntrega {...props()} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento de entrega" })));
    expect(screen.getByRole("alert").textContent).toBe("Falta migración 025");
    expect(screen.queryByRole("button", { name: "Confirmar envío/entrega" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar entregas" }));
    await screen.findByText(/Seguimiento:/); await completar();
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
    expect(document.activeElement).toBe(screen.getByLabelText("Motivo de anulación"));
    fireEvent.change(screen.getByLabelText("Motivo de anulación"), { target: { value: "  Corrección ficticia documentada.  " } });
    const anulado = { ...registro, anulado_en_utc: "2026-01-06 15:00:00.000000", anulador_nombre: "Actor ficticio",
      motivo_anulacion: "Corrección ficticia documentada." };
    solicitarApi.mockImplementation((ruta, o) => Promise.resolve(o?.method === "POST"
      ? json({ success: true, registro: anulado }) : historial([anulado], { resumen: "pendiente_de_envio" })));
    fireEvent.submit(screen.getByRole("button", { name: "Confirmar anulación" }).closest("form"));
    await screen.findByText("Anulación confirmada. La evidencia se conserva.");
    await screen.findByRole("button", { name: "Registrar envío/entrega" });
    expect(await screen.findByText(/· Anulado/)).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Abrir evidencia: evidencia.pdf" })).toBeTruthy();
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
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Abrir evidencia: evidencia.pdf" })));
    expect(screen.getByRole("link", { name: "evidencia.pdf" }).getAttribute("href")).toBe("blob:evidencia");
    expect(solicitarApi.mock.calls.at(-1)[0]).toContain("/1/evidencias/1");
    vista.unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:evidencia");
  });
  it("historial mal formado es error explicito, nunca ausencia de entregas", async () => {
    solicitarApi.mockResolvedValue(historial([{ ...registro, evidencias: null }]));
    render(<SeguimientoEntrega {...props()} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver seguimiento de entrega" })));
    expect(screen.getByRole("alert").textContent).toBe("Historial de entrega inválido.");
    expect(screen.queryByText("No hay registros de envío o entrega.")).toBeNull();
  });
  it("confirmacion incompleta no informa exito y conserva intento para replay", async () => {
    render(<SeguimientoEntrega {...props()} />); await abrir(); await completar();
    solicitarApi.mockResolvedValueOnce(json({ success: true, registro: { id: 1 } }));
    await act(async () => fireEvent.submit(formulario()));
    expect(screen.getByRole("alert").textContent).toContain("Confirmación incompleta");
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
