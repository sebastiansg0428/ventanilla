import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepararEstilosDom } from "./helpers/estilos-dom.js";
import { RespuestasInternas, TrazabilidadInterna } from "../../src/componentes/RespuestasInternas";
import { solicitarApi } from "../../src/servicios/api";

vi.mock("../../src/servicios/api", () => ({ solicitarApi: vi.fn() }));

const usuario = { id: 1, rol: "funcionario", dependencia_id: 7 };
const recepcion = {
  id: 1, respuesta_id: 10, dependencia_origen_id: 7, historica: 0,
  numero_radicado: "INTERNO-FICTICIO", contenido: "Respuesta institucional de prueba.",
  dependencia_remitente: "Oficina de origen ficticia", dependencia_destino: "Oficina ficticia",
  tipo_recepcion: "Digital", radicado_estado: "Respondido",
  disponible_en_utc: "2026-11-05 15:00:00.000000",
  primera_apertura_utc: null, actor_nombre: null,
};
const confirmada = {
  ...recepcion,
  primera_apertura_utc: "2026-11-05 15:10:00.000000",
  actor_nombre: "Actor ficticio",
  radicado_estado: "Entregado",
};
const radicadoEnviado = {
  numero_radicado: "RAD-INTERNO-0015", estado: "Respondido",
  dependencia_destino: "Oficina de Planeación", tipo_recepcion: "Digital",
  fecha_hora_recepcion: "2026-11-18 12:00:00", fecha_respuesta: "2026-11-18 15:40:00",
};
const radicadoPendiente = {
  numero_radicado: "RAD-INTERNO-0016", estado: "Recibido",
  dependencia_destino: "Oficina de Planeación", tipo_recepcion: "Digital",
  fecha_hora_recepcion: "2026-11-18 13:00:00", fecha_respuesta: null,
};
const json = datos => ({ json: async () => ({ success: true, ...datos }) });
const lista = r => json({ registros: [r], pagina: 1, paginas: 1, total: 1,
  resumen: { total: 1, pendientes: r.primera_apertura_utc ? 0 : 1, leidas: r.primera_apertura_utc ? 1 : 0 } });
const listaEnviados = json({ radicados: [radicadoEnviado], pagina: 1, paginas: 1, total: 1 });

beforeAll(prepararEstilosDom);

function diferida() {
  let resolve;
  const promise = new Promise(ok => { resolve = ok; });
  return { promise, resolve };
}

async function abrirBandeja() {
  const tab = await screen.findByRole("tab", { name: "Radicados enviados" });
  expect(screen.queryByRole("tab", { name: "Respuestas recibidas" })).toBeNull();
  return tab;
}

async function abrirRespuestaEnviada() {
  const boton = await screen.findByRole("button", { name: "Ver respuesta de Oficina de Planeación" });
  await act(async () => fireEvent.click(boton));
  return boton;
}

beforeEach(() => {
  vi.resetAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:ficticio");
  URL.revokeObjectURL = vi.fn();
  solicitarApi.mockImplementation(ruta => Promise.resolve(
    ruta.startsWith("/api/radicados?") ? listaEnviados
      : ruta.includes("?") ? lista(recepcion)
        : ruta.endsWith("/apertura") ? json({ recepcion: confirmada })
          : json({ recepcion, documentos: [] }),
  ));
});

describe("respuestas internas digitales", () => {
  it("muestra una sola vista de radicados enviados y abre una respuesta inline", async () => {
    const scrollIntoView = vi.fn();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const anteriorScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<RespuestasInternas usuario={usuario} directa alVerTrazabilidad={vi.fn()} />);
      await abrirBandeja();
      const boton = await screen.findByRole("button", { name: "Ver respuesta de Oficina de Planeación" });
      const tarjeta = boton.closest("li");
      expect(screen.getAllByRole("tab")).toHaveLength(1);
      expect(boton.getAttribute("aria-expanded")).toBe("false");
      expect(boton.getAttribute("aria-controls")).toBe("respuesta-interna-enviada-RAD-INTERNO-0015");

      fireEvent.click(boton);
      expect(boton.disabled).toBe(true);
      expect(within(tarjeta).getByText("Cargando respuesta interna y PDF…")).toBeTruthy();
      await screen.findByRole("article", { name: "Respuesta interna abierta" });
      expect(screen.getByText(recepcion.contenido)).toBeTruthy();
      expect(boton.getAttribute("aria-expanded")).toBe("true");
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center", inline: "nearest" });
      expect(focus.mock.calls.some(([opciones]) => opciones?.preventScroll === true)).toBe(true);
      expect(solicitarApi).toHaveBeenCalledWith("/api/radicados/RAD-INTERNO-0015/recepcion-interna", undefined);
      expect(solicitarApi).toHaveBeenCalledWith("/api/respuestas-internas/1", undefined);
      expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "POST")).toBe(true);

      fireEvent.click(screen.getByRole("button", { name: "Cerrar respuesta interna" }));
      expect(screen.queryByRole("article", { name: "Respuesta interna abierta" })).toBeNull();
      expect(document.activeElement).toBe(boton);
    } finally {
      HTMLElement.prototype.scrollIntoView = anteriorScroll;
      focus.mockRestore();
    }
  });

  it("muestra únicamente la trazabilidad para un radicado sin respuesta", async () => {
    const alVerTrazabilidad = vi.fn();
    solicitarApi.mockImplementation(ruta => ruta.startsWith("/api/radicados?")
      ? json({ radicados: [radicadoEnviado, radicadoPendiente], pagina: 1, paginas: 1, total: 2 })
      : ruta.includes("?") ? lista(recepcion) : json({ recepcion, documentos: [] }));
    render(<RespuestasInternas usuario={usuario} directa alVerTrazabilidad={alVerTrazabilidad} />);
    await abrirBandeja();
    const tarjeta = screen.getByRole("heading", { name: "RAD-INTERNO-0016" }).closest("li");
    expect(within(tarjeta).queryByRole("button", { name: /Ver respuesta de/ })).toBeNull();
    expect(within(tarjeta).getByRole("button", { name: "Ver trazabilidad" })).toBeTruthy();
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Ver trazabilidad" }));
    expect(alVerTrazabilidad).toHaveBeenCalledWith(radicadoPendiente);
  });

  it("muestra el error de carga dentro de la tarjeta y permite reintentar", async () => {
    let fallo = true;
    solicitarApi.mockImplementation(ruta => {
      if (ruta.startsWith("/api/radicados?")) return listaEnviados;
      if (ruta.endsWith("/recepcion-interna")) return json({ recepcion });
      if (ruta === "/api/respuestas-internas/1" && fallo) return Promise.reject(new Error("El PDF no está disponible."));
      return json({ recepcion, documentos: [] });
    });
    render(<RespuestasInternas usuario={usuario} directa />);
    await abrirBandeja();
    const boton = await abrirRespuestaEnviada();
    const tarjeta = boton.closest("li");
    const alerta = await within(tarjeta).findByRole("alert");
    expect(alerta.textContent).toContain("El PDF no está disponible.");
    expect(within(tarjeta).getByRole("button", { name: "Reintentar carga de respuesta" })).toBeTruthy();
    expect(screen.getByText("Respuesta · RAD-INTERNO-0015")).toBeTruthy();
    expect(boton.disabled).toBe(false);
    fallo = false;
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Reintentar carga de respuesta" }));
    await screen.findByRole("article", { name: "Respuesta interna abierta" });
    expect(solicitarApi.mock.calls.filter(([ruta]) => ruta === "/api/respuestas-internas/1")).toHaveLength(2);
  });

  it("impide llamadas duplicadas mientras carga la respuesta enviada", async () => {
    const pendiente = diferida();
    solicitarApi.mockImplementation(ruta => {
      if (ruta.startsWith("/api/radicados?")) return listaEnviados;
      if (ruta.endsWith("/recepcion-interna")) return pendiente.promise;
      return json({ recepcion, documentos: [] });
    });
    render(<RespuestasInternas usuario={usuario} directa />);
    await abrirBandeja();
    const boton = await screen.findByRole("button", { name: "Ver respuesta de Oficina de Planeación" });
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(solicitarApi.mock.calls.filter(([ruta]) => ruta.endsWith("/recepcion-interna"))).toHaveLength(1);
    expect(boton.disabled).toBe(true);
    await act(async () => pendiente.resolve(json({ recepcion })));
    await screen.findByRole("article", { name: "Respuesta interna abierta" });
  });

  it("conserva el resumen y los indicadores de la bandeja", async () => {
    const alResumen = vi.fn();
    render(<RespuestasInternas usuario={usuario} directa alResumen={alResumen} />);
    await abrirBandeja();
    const resumen = screen.getByRole("status", { name: "Resumen de respuestas de tu dependencia" });
    expect(resumen.textContent).toContain("1Sin apertura");
    await waitFor(() => expect(alResumen).toHaveBeenLastCalledWith({
      resumen: { total: 1, pendientes: 1, leidas: 0 }, error: "", cargando: false,
    }));
  });

  it("muestra carga y permite resolver una bandeja enviada vacía", async () => {
    const pendiente = diferida();
    solicitarApi.mockImplementation(ruta => ruta.startsWith("/api/radicados?")
      ? pendiente.promise : lista(recepcion));
    render(<RespuestasInternas usuario={usuario} directa />);
    await screen.findByRole("tab", { name: "Radicados enviados" });
    expect(screen.getByText("Cargando radicados enviados…")).toBeTruthy();
    await act(async () => pendiente.resolve(json({ radicados: [], pagina: 1, paginas: 0, total: 0 })));
    await screen.findByText("Aún no hay radicados internos enviados");
  });

  it("espera los PDF antes de mostrar el detalle y libera blobs al cerrar", async () => {
    const pdf = diferida();
    solicitarApi.mockImplementation(ruta => Promise.resolve(ruta.startsWith("/api/radicados?")
      ? listaEnviados : ruta.endsWith("/documentos/4") ? pdf.promise
        : ruta.endsWith("/apertura") ? json({ recepcion: confirmada })
          : json({ recepcion, documentos: [{ id: 4, nombre_archivo: "oficio.pdf", tamano_bytes: 100 }] })));
    render(<RespuestasInternas usuario={usuario} directa />);
    await abrirBandeja();
    await abrirRespuestaEnviada();
    await screen.findByText("Cargando respuesta interna y PDF…");
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "POST")).toBe(false);
    await act(async () => pdf.resolve({ blob: async () => new Blob(["ficticio"]) }));
    await screen.findByRole("link", { name: "oficio.pdf" });
    await screen.findByText(/Actor ficticio/);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar respuesta interna" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:ficticio");
  });

  it("no acredita ni conserva una carga tardía al abandonar el panel", async () => {
    const pendiente = diferida();
    solicitarApi.mockImplementation(ruta => ruta.startsWith("/api/radicados?")
      ? listaEnviados : ruta === "/api/respuestas-internas/1" ? pendiente.promise : json({ recepcion, documentos: [] }));
    const vista = render(<RespuestasInternas usuario={usuario} directa />);
    await abrirBandeja();
    const boton = await screen.findByRole("button", { name: "Ver respuesta de Oficina de Planeación" });
    fireEvent.click(boton);
    await screen.findByText("Cargando respuesta interna y PDF…");
    vista.rerender(<RespuestasInternas usuario={usuario} directa activa={false} />);
    await act(async () => pendiente.resolve(json({ recepcion, documentos: [] })));
    expect(screen.queryByRole("article", { name: "Respuesta interna abierta" })).toBeNull();
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "POST")).toBe(false);
  });

  it("conserva respuesta, documentos y entrega al abrir un radicado enviado", async () => {
    solicitarApi.mockImplementation(ruta => ruta.startsWith("/api/radicados?")
      ? listaEnviados : ruta.includes("/documentos/")
        ? { blob: async () => new Blob(["pdf"]) }
        : ruta.endsWith("/apertura") ? json({ recepcion: confirmada })
          : json({ recepcion, documentos: [{ id: 4, nombre_archivo: "Respuesta.pdf", tamano_bytes: 2048 }] }));
    render(<RespuestasInternas usuario={usuario} directa />);
    await abrirBandeja();
    await abrirRespuestaEnviada();
    const detalle = await screen.findByRole("article", { name: "Respuesta interna abierta" });
    expect(within(detalle).getByText(recepcion.contenido)).toBeTruthy();
    expect(within(detalle).getByRole("link", { name: "Respuesta.pdf" })).toBeTruthy();
    expect(within(detalle).getByRole("region", { name: "Entrega interna de la respuesta" })).toBeTruthy();
    expect(solicitarApi.mock.calls.filter(([, opciones]) => opciones?.method === "POST")).toHaveLength(1);
  });

  it("no consulta radicados enviados ni registra apertura cuando la bandeja está inactiva", async () => {
    const alResumen = vi.fn();
    render(<RespuestasInternas usuario={usuario} directa={false} activa={false} alResumen={alResumen} />);
    await screen.findByRole("status", { name: "Resumen de respuestas de tu dependencia" });
    expect(solicitarApi.mock.calls.some(([ruta]) => ruta.startsWith("/api/radicados?"))).toBe(false);
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "POST")).toBe(false);
  });
});

describe("trazabilidad de comunicaciones internas", () => {
  for (const rol of ["ventanilla", "administrador", "funcionario"]) {
    it(`no registra apertura para ${rol} ajeno al origen`, async () => {
      solicitarApi.mockResolvedValue(json({ recepcion }));
      render(<TrazabilidadInterna
        radicado={{ numero_radicado: recepcion.numero_radicado, dependencia_remitente_id: 7 }}
        usuario={{ id: 2, rol, dependencia_id: rol === "funcionario" ? 9 : null }}
      />);
      fireEvent.click(screen.getByRole("button", { name: "Ver recepción digital" }));
      await screen.findByText("Sin primera apertura registrada por la dependencia de origen.");
      expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "POST")).toBe(false);
    });
  }

  it("identifica al origen y muestra los hitos pendientes sin registrar apertura desde Ventanilla", async () => {
    solicitarApi.mockResolvedValue(json({ recepcion }));
    render(<TrazabilidadInterna
      radicado={{ numero_radicado: recepcion.numero_radicado }}
      usuario={{ id: 2, rol: "ventanilla" }}
    />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ver recepción digital" })));
    const hitos = screen.getByRole("list", { name: "Hitos de recepción digital interna" });
    expect(within(hitos).getAllByRole("listitem")).toHaveLength(2);
    expect(within(hitos).getByRole("heading", { name: "Respuesta disponible" })).toBeTruthy();
    expect(within(hitos).getByRole("heading", { name: "Primera apertura pendiente" })).toBeTruthy();
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "POST")).toBe(false);
  });

  it("registra una apertura desde la dependencia de origen y conserva los hitos", async () => {
    let actual = recepcion;
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (opciones?.method === "POST") {
        actual = confirmada;
        return Promise.resolve(json({ recepcion: actual }));
      }
      if (ruta.endsWith("/recepcion-interna")) return Promise.resolve(json({ recepcion: actual }));
      return Promise.resolve(json({ recepcion: actual }));
    });
    render(<TrazabilidadInterna
      radicado={{ numero_radicado: recepcion.numero_radicado, dependencia_remitente_id: 7 }}
      usuario={usuario}
    />);
    await screen.findByText(confirmada.actor_nombre);
    const hitos = screen.getByRole("list", { name: "Hitos de recepción digital interna" });
    expect(within(hitos).getByRole("heading", { name: "Primera apertura registrada" })).toBeTruthy();
    expect(solicitarApi.mock.calls.filter(([, opciones]) => opciones?.method === "POST")).toHaveLength(1);
  });
});
