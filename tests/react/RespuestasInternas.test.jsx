import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepararEstilosDom } from "./helpers/estilos-dom.js";
import { RespuestasInternas, TrazabilidadInterna } from "../../src/componentes/RespuestasInternas";
import { solicitarApi } from "../../src/servicios/api";
vi.mock("../../src/servicios/api", () => ({ solicitarApi: vi.fn() }));
const usuario = { id: 1, rol: "funcionario", dependencia_id: 7 };
const recepcion = { id: 1, respuesta_id: 10, dependencia_origen_id: 7, historica: 0,
  numero_radicado: "INTERNO-FICTICIO", contenido: "Respuesta institucional de prueba.",
  dependencia_remitente: "Oficina de origen ficticia", dependencia_destino: "Oficina ficticia",
  disponible_en_utc: "2026-11-05 15:00:00.000000",
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
  await waitFor(() => expect(screen.queryByText("Cargando bandeja interna…")).toBeNull());
  const boton = screen.queryByRole("button", { name: "Ver bandeja interna" });
  if (boton) await act(async () => fireEvent.click(boton));
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
  it("mantiene resumen y aviso al plegar y no reabre al actualizar", async () => {
    render(<RespuestasInternas usuario={usuario} />);
    await abrirBandeja();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar bandeja interna" }));
    expect(screen.getByRole("status", { name: "Resumen de respuestas de tu dependencia" }).textContent).toContain("1Sin apertura");
    expect(screen.getByText(/Tienes 1 respuesta interna sin abrir/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Respuestas disponibles" })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Actualizar bandeja interna" })));
    expect(screen.getByRole("button", { name: "Ver bandeja interna" }).getAttribute("aria-expanded")).toBe("false");
    expect(solicitarApi).toHaveBeenCalledTimes(2);
    expect(solicitarApi.mock.calls.every(([ruta, opciones]) => ruta.includes("?") && !opciones?.method)).toBe(true);
  });
  it("con respuestas ya abiertas muestra resumen sin desplegar ni cargar contenido", async () => {
    solicitarApi.mockResolvedValue(lista(confirmada));
    render(<RespuestasInternas usuario={usuario} />);
    const resumen = await screen.findByRole("status", { name: "Resumen de respuestas de tu dependencia" });
    expect(resumen.textContent).toContain("1Con apertura");
    expect(screen.getByRole("button", { name: "Ver bandeja interna" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Respuestas disponibles" })).toBeNull();
    expect(solicitarApi).toHaveBeenCalledTimes(1);
  });
  it("un error inicial queda visible sin abrir la bandeja y permite recuperar", async () => {
    solicitarApi.mockRejectedValueOnce(new Error("No se pudo consultar la bandeja."));
    render(<RespuestasInternas usuario={usuario} />);
    await screen.findByText("No se pudo consultar la bandeja.");
    expect(screen.getByRole("button", { name: "Ver bandeja interna" })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reintentar carga de bandeja interna" })));
    expect(screen.getByRole("list", { name: "Respuestas disponibles" })).toBeTruthy();
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "POST")).toBe(false);
  });
  it("carga al entrar y muestra las pendientes sin registrar apertura; mostrar contenido sí la registra", async () => {
    render(<RespuestasInternas usuario={usuario} />);
    await abrirBandeja();
    expect(solicitarApi).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Ocultar bandeja interna" })).toBeTruthy();
    expect(screen.getByText(/Tienes 1 respuesta interna sin abrir/)).toBeTruthy();
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
    expect(screen.getByText("Sin primera apertura registrada por la dependencia de origen.")).toBeTruthy();
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
      await screen.findByText("Sin primera apertura registrada por la dependencia de origen.");
      expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
    });
  }

  it("identifica al origen y muestra dos hitos pendientes sin registrar apertura desde Ventanilla", async () => {
    solicitarApi.mockResolvedValue(json({ recepcion }));
    render(<TrazabilidadInterna radicado={{ numero_radicado: recepcion.numero_radicado }}
      usuario={{ id: 2, rol: "ventanilla" }} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver recepción digital" })));
    const hitos = screen.getByRole("list", { name: "Hitos de recepción digital interna" });
    expect(within(hitos).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Respuesta dirigida a")).toBeTruthy();
    expect(screen.getByText(recepcion.dependencia_remitente)).toBeTruthy();
    expect(within(hitos).getByRole("heading", { name: "Respuesta disponible" })).toBeTruthy();
    expect(within(hitos).getByRole("heading", { name: "Primera apertura pendiente" })).toBeTruthy();
    expect(hitos.textContent).toContain("10:00");
    expect(screen.getByText("La apertura no acredita comprensión ni notificación legal.")).toBeTruthy();
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });

  it.each([null, "", "   "])("no sustituye un origen sin nombre (%s) por la oficina que respondió", async nombre => {
    solicitarApi.mockResolvedValue(json({ recepcion: { ...recepcion, dependencia_remitente: nombre } }));
    render(<TrazabilidadInterna radicado={{ numero_radicado: recepcion.numero_radicado }}
      usuario={{ id: 2, rol: "administrador" }} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver recepción digital" })));
    expect(screen.getByText("Dependencia de origen no registrada")).toBeTruthy();
    expect(screen.queryByText(recepcion.dependencia_destino, { exact: true })).toBeNull();
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });

  it.each([true, false])("aclara disponibilidad sin fecha; histórica=%s", async historica => {
    solicitarApi.mockResolvedValue(json({ recepcion: {
      ...recepcion, historica: historica ? 1 : 0, disponible_en_utc: null,
    } }));
    render(<TrazabilidadInterna radicado={{ numero_radicado: recepcion.numero_radicado }}
      usuario={{ id: 2, rol: "ventanilla" }} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver recepción digital" })));
    const hitos = screen.getByRole("list", { name: "Hitos de recepción digital interna" });
    expect(within(hitos).getByText(historica
      ? "Respuesta histórica; fecha de disponibilidad anterior desconocida" : "No registrada")).toBeTruthy();
    expect(hitos.textContent).not.toContain("10:00");
    expect(within(hitos).getByRole("heading", { name: "Primera apertura pendiente" })).toBeTruthy();
  });

  it("registra apertura desde el origen y conserva los hitos al actualizar o reabrir el panel", async () => {
    const base = solicitarApi.getMockImplementation();
    let actual = recepcion;
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (opciones?.method === "POST") {
        actual = confirmada;
        return Promise.resolve(json({ recepcion: actual }));
      }
      if (ruta.endsWith("/recepcion-interna")) return Promise.resolve(json({ recepcion: actual }));
      return base(ruta, opciones);
    });
    render(<TrazabilidadInterna radicado={{
      numero_radicado: recepcion.numero_radicado, dependencia_remitente_id: 7,
    }} usuario={usuario} />);
    await screen.findByText(confirmada.actor_nombre);
    const hitos = screen.getByRole("list", { name: "Hitos de recepción digital interna" });
    expect(within(hitos).getByRole("heading", { name: "Primera apertura registrada" })).toBeTruthy();
    expect(within(hitos).getByText("Registrada por")).toBeTruthy();
    expect(hitos.textContent).toContain("10:10");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Actualizar recepción digital" })));
    fireEvent.click(screen.getByRole("button", { name: "Ocultar recepción digital" }));
    expect(screen.queryByRole("list", { name: "Hitos de recepción digital interna" })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver recepción digital" })));
    expect(screen.getByText(confirmada.actor_nombre)).toBeTruthy();
    expect(solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
  });

  it("la bandeja conserva resumen compacto y el detalle comparte receptor e hitos con el modal", async () => {
    render(<RespuestasInternas usuario={usuario} />);
    await abrirBandeja();
    expect(screen.getByText(recepcion.dependencia_remitente)).toBeTruthy();
    expect(screen.getByText(recepcion.dependencia_destino)).toBeTruthy();
    expect(screen.getByText("Pendiente de primera apertura por la dependencia de origen")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Hitos de recepción digital interna" })).toBeNull();
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
    await abrirDetalle();
    const detalle = screen.getByRole("article", { name: "Respuesta interna abierta" });
    expect(within(detalle).getByText(recepcion.dependencia_remitente)).toBeTruthy();
    const hitos = within(detalle).getByRole("list", { name: "Hitos de recepción digital interna" });
    expect(within(hitos).getAllByRole("listitem")).toHaveLength(2);
    expect(within(hitos).getByRole("heading", { name: "Primera apertura registrada" })).toBeTruthy();
    expect(within(hitos).getByText(confirmada.actor_nombre)).toBeTruthy();
    expect(solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
  });

  it.each([
    ["todas", "Aún no hay respuestas internas"],
    ["pendientes", "Sin respuestas pendientes de apertura"],
    ["leidas", "Sin respuestas con apertura registrada"],
  ])("distingue vacío para %s sin paginación y permite quitar el filtro", async (estado, titulo) => {
    solicitarApi.mockResolvedValue(json({ registros: [], pagina: 1, paginas: 0, total: 0,
      resumen: { total: 0, pendientes: 0, leidas: 0 } }));
    render(<RespuestasInternas usuario={usuario} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver bandeja interna" })));
    if (estado !== "todas") await act(async () => fireEvent.change(screen.getByLabelText("Filtrar respuestas internas"), { target: { value: estado } }));
    expect(screen.getByRole("heading", { name: titulo })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: /Abrir respuesta interna/ })).toBeNull();
    if (estado !== "todas") {
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver todas las respuestas internas" })));
      expect(screen.getByLabelText("Filtrar respuestas internas").value).toBe("todas");
      expect(solicitarApi).toHaveBeenLastCalledWith("/api/respuestas-internas?pagina=1&estado=todas", undefined);
    }
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });

  it("resume fechas y oficinas en la tarjeta sin cargar el detalle ni acreditar", async () => {
    solicitarApi.mockResolvedValue(lista(confirmada));
    render(<RespuestasInternas usuario={usuario} />);
    await abrirBandeja();
    const tarjeta = screen.getByRole("list", { name: "Respuestas disponibles" }).querySelector("li");
    expect(within(tarjeta).getByRole("heading", { name: confirmada.numero_radicado })).toBeTruthy();
    expect(within(tarjeta).getByText("Respuesta dirigida a")).toBeTruthy();
    expect(within(tarjeta).getByText("Dependencia que respondió")).toBeTruthy();
    expect(within(tarjeta).getByText("Disponibilidad (Bogotá)")).toBeTruthy();
    expect(within(tarjeta).getByText("Primera apertura (Bogotá)")).toBeTruthy();
    expect(tarjeta.textContent).toContain("10:00");
    expect(tarjeta.textContent).toContain("10:10");
    expect(solicitarApi).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("article")).toBeNull();
  });

  it.each([0, 1])("aclara fechas ausentes e históricas en tarjeta: histórica=%s", async historica => {
    solicitarApi.mockResolvedValue(lista({ ...recepcion, historica,
      disponible_en_utc: historica ? recepcion.disponible_en_utc : null,
      dependencia_remitente: " ", dependencia_destino: "" }));
    render(<RespuestasInternas usuario={usuario} />);
    await abrirBandeja();
    expect(screen.getByText(historica ? "Respuesta histórica; disponibilidad anterior desconocida" : "Fecha de disponibilidad no registrada")).toBeTruthy();
    expect(screen.getByText("Sin apertura registrada")).toBeTruthy();
    expect(screen.getByText("Dependencia de origen no registrada")).toBeTruthy();
    expect(screen.getByText("No registrada")).toBeTruthy();
    expect(solicitarApi).toHaveBeenCalledTimes(1);
  });

  it("organiza contenido y adjuntos vacíos y conserva foco tras refrescar la lista", async () => {
    render(<RespuestasInternas usuario={usuario} />);
    await abrirBandeja(); await abrirDetalle();
    const detalle = screen.getByRole("article", { name: "Respuesta interna abierta" });
    expect(document.activeElement).toBe(within(detalle).getByRole("heading", { name: recepcion.numero_radicado }));
    expect(within(detalle).getByRole("region", { name: "Contenido de la respuesta" })).toBeTruthy();
    expect(within(detalle).getByRole("region", { name: "Adjuntos de la respuesta" }).textContent).toContain("Esta respuesta no tiene adjuntos.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Actualizar bandeja interna" })));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar respuesta interna" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actualizar bandeja interna" }));
  });

  it("reintenta la carga PDF sin acuse prematuro y libera URLs parciales", async () => {
    let fallar = true;
    URL.createObjectURL.mockReturnValueOnce("blob:parcial").mockReturnValueOnce("blob:uno").mockReturnValueOnce("blob:dos");
    solicitarApi.mockImplementation(ruta => {
      if (ruta.includes("?")) return Promise.resolve(lista(recepcion));
      if (ruta.endsWith("/documentos/5") && fallar) return Promise.reject(new Error("PDF de prueba ausente"));
      if (ruta.includes("/documentos/")) return Promise.resolve({ blob: async () => new Blob(["PDF fixture"]) });
      return Promise.resolve(ruta.endsWith("/apertura") ? json({ recepcion: confirmada })
        : json({ recepcion, documentos: [{ id: 4, nombre_archivo: "uno.pdf", tamano_bytes: 2048 }, { id: 5, nombre_archivo: "dos.pdf", tamano_bytes: 1024 }] }));
    });
    render(<RespuestasInternas usuario={usuario} />); await abrirBandeja();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Abrir respuesta interna/ })));
    expect(screen.getByText("PDF de prueba ausente")).toBeTruthy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:parcial");
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
    fallar = false;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reintentar carga de respuesta" })));
    expect(screen.getByRole("link", { name: "uno.pdf" })).toBeTruthy();
    expect(screen.getByText("PDF · 2 KiB · Abre en otra pestaña")).toBeTruthy();
    expect(solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar respuesta interna" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:uno");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:dos");
  });

  it("pagina y descarta respuestas tardías al filtrar sin acreditar aperturas", async () => {
    const lenta = diferida();
    solicitarApi.mockResolvedValue(json({ registros: [recepcion], pagina: 1, paginas: 2, total: 26,
      resumen: { total: 30, pendientes: 26, leidas: 4 } }));
    render(<RespuestasInternas usuario={usuario} />); await abrirBandeja();
    solicitarApi.mockReturnValueOnce(lenta.promise).mockResolvedValueOnce(json({ registros: [confirmada], pagina: 1, paginas: 1, total: 4,
      resumen: { total: 30, pendientes: 26, leidas: 4 } }));
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await act(async () => fireEvent.change(screen.getByLabelText("Filtrar respuestas internas"), { target: { value: "leidas" } }));
    await act(async () => lenta.resolve(json({ registros: [recepcion], pagina: 2, paginas: 2, total: 26,
      resumen: { total: 30, pendientes: 26, leidas: 4 } })));
    expect(screen.getByText("4 respuestas en este filtro")).toBeTruthy();
    const resumen = screen.getByRole("status", { name: "Resumen de respuestas de tu dependencia" });
    expect(within(resumen).getByText("30")).toBeTruthy();
    expect(within(resumen).getByText("26")).toBeTruthy();
    expect(screen.getByText("Primera apertura registrada")).toBeTruthy();
    expect(screen.queryByText("Sin apertura registrada")).toBeNull();
    expect(solicitarApi).toHaveBeenCalledWith("/api/respuestas-internas?pagina=2&estado=todas", undefined);
    expect(solicitarApi).toHaveBeenCalledWith("/api/respuestas-internas?pagina=1&estado=leidas", undefined);
    expect(solicitarApi.mock.calls.some(([, o]) => o?.method === "POST")).toBe(false);
  });
});
