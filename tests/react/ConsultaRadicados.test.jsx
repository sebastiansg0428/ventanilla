import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepararEstilosDom } from "./helpers/estilos-dom.js";
import { PaginaConsultaRadicados } from "../../src/paginas/ConsultaRadicados.jsx";
import { confirmarSesion, solicitarApi } from "../../src/servicios/api.js";
import { crearPdfComprobante } from "../../src/servicios/comprobante.js";
import { formatearFechaRadicacion, obtenerDiaRadicacion, obtenerFechaBogota } from "../../src/servicios/fechas.js";

vi.mock("../../src/servicios/api.js", () => ({
  confirmarSesion: vi.fn(),
  solicitarApi: vi.fn(),
}));
vi.mock("../../src/servicios/comprobante.js", () => ({
  crearPdfComprobante: vi.fn(),
}));

const usuario = {
  id: 7,
  nombre: "Ana Pérez",
  rol: "administrador",
  dependencia_id: null,
};
let registrosSimulados;

beforeAll(prepararEstilosDom);

function crearRadicados() {
  const hoy = new Date().toISOString();
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      numero_radicado: "RAD-001",
      fecha_creacion: hoy,
      tipo_comunicacion: "Externa",
      remitente_nombre: "Ana García",
      remitente_documento: "12345678",
      estado: "Recibido",
      semaforo: { nivel: "alerta", texto: "Por vencer" },
    },
    {
      numero_radicado: "RAD-002",
      fecha_creacion: ayer,
      tipo_comunicacion: "Interna",
      remitente_nombre: "Luis Gómez",
      remitente_documento: "87654321",
      estado: "Recibido",
      semaforo: { nivel: "a_tiempo", texto: "A tiempo" },
    },
    {
      numero_radicado: "RAD-003",
      fecha_creacion: hoy,
      tipo_comunicacion: null,
      remitente_nombre: "Sofía Ruiz",
      remitente_documento: "23456789",
      estado: "Pendiente",
      semaforo: { nivel: "vencido", texto: "Vencido" },
    },
  ];
}

function respuestaJson(resultado) {
  return { json: async () => resultado };
}

function paginaRadicados(radicados, ruta) {
  const parametros = new URLSearchParams(ruta.split("?")[1]);
  const normalizar = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const hoy = obtenerFechaBogota(new Date());
  const critico = r => ["alerta", "vencido"].includes(r.semaforo?.nivel);
  const clase = r => {
    const valor = normalizar(r.tipo_comunicacion || r.tipo_documento);
    return valor.includes("interna") ? "interna" : valor.includes("externa") ? "externa" : "sin-tipo";
  };
  const filtrados = radicados.filter(r =>
    (!parametros.get("busqueda") || ["numero_radicado", "remitente_nombre", "remitente_documento", "remitente_nit"]
      .some(campo => normalizar(r[campo]).includes(normalizar(parametros.get("busqueda"))))) &&
    (parametros.get("hoy") !== "1" || obtenerDiaRadicacion(r) === hoy) &&
    (parametros.get("criticos") !== "1" || critico(r)) &&
    (!parametros.get("tipo_comunicacion") || clase(r) === parametros.get("tipo_comunicacion")));
  const pagina = Number(parametros.get("pagina"));
  const limite = Number(parametros.get("limite"));
  return respuestaJson({ success: true, total: filtrados.length, pagina, limite,
    paginas: Math.ceil(filtrados.length / limite),
    resumen: { total: radicados.length, hoy: radicados.filter(r => obtenerDiaRadicacion(r) === hoy).length,
      criticos: radicados.filter(critico).length },
    radicados: filtrados.slice((pagina - 1) * limite, pagina * limite) });
}

async function abrirConsulta() {
  const vista = render(<PaginaConsultaRadicados />);
  await screen.findByText("RAD-001", { selector: "button" });
  screen.getByText("RAD-002", { selector: "button" });
  screen.getByText("RAD-003", { selector: "button" });
  return vista;
}

function prepararDialogos() {
  document.querySelectorAll("dialog").forEach((dialogo) => {
    dialogo.showModal = vi.fn(() => dialogo.setAttribute("open", ""));
    dialogo.close = vi.fn(() => {
      dialogo.removeAttribute("open");
      fireEvent(dialogo, new Event("close"));
    });
  });
}

function diferida() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function abrirHistorial() {
  await abrirConsulta();
  prepararDialogos();
  await act(async () => fireEvent.click(screen.getByText("RAD-001", { selector: "button" })));
  return within(document.querySelector("#modal-detalle")).getByRole("list", {
    name: "Línea de tiempo del radicado",
  });
}

async function abrirRespuesta() {
  await abrirConsulta();
  const dialogo = document.querySelector(".respuesta-dialog");
  dialogo.showModal = vi.fn(() => dialogo.setAttribute("open", ""));
  dialogo.close = vi.fn(() => {
    dialogo.removeAttribute("open");
  });
  const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
  fireEvent.click(within(fila).getByRole("button", { name: "Responder" }));
  return within(dialogo).getByLabelText(/Documentos de respuesta/);
}

function crearPdf(nombre, tamano) {
  return new File([new Uint8Array(tamano)], nombre, { type: "application/pdf" });
}

function simularUrlsBlob(url) {
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => url);
    static revokeObjectURL = vi.fn();
  });
}

function simularAlerta() {
  return vi.spyOn(window, "alert").mockImplementation(() => {});
}

describe("consulta de radicados React", () => {
  beforeEach(() => {
    const registros = crearRadicados();
    registrosSimulados = registros;
    confirmarSesion.mockReset().mockResolvedValue(usuario);
    solicitarApi.mockReset().mockImplementation(async (ruta, opciones = {}) => {
      if (ruta.startsWith("/api/radicados?") && !opciones.method) {
        return paginaRadicados(registros, ruta);
      }
      if (ruta === "/api/dependencias") {
        return respuestaJson({
          success: true,
          dependencias: [{ id: 3, nombre: "Secretaría de Gobierno" }],
        });
      }
      if (/^\/api\/radicados\/[^/]+\/historial(?:\?|$)/.test(ruta)) {
        return respuestaJson({ success: true, historial: [], siguiente_cursor: null });
      }
      if (ruta.startsWith("/api/radicados/") && opciones.method === "PUT") {
        const { estado } = JSON.parse(opciones.body);
        Object.assign(registros.find(r => ruta.includes(r.numero_radicado)), {
          estado, semaforo: { nivel: "completado", texto: "Completado" },
        });
        return respuestaJson({
          estado,
          semaforo: { nivel: "completado", texto: "Completado" },
        });
      }
      throw new Error(`Ruta inesperada: ${ruta}`);
    });
  });

  it.each(["Interna", "Externa"])("muestra autor, dependencia y fecha solo en Ver respuesta %s", async (tipo) => {
    const radicados = crearRadicados();
    radicados[0].tipo_comunicacion = tipo;
    radicados[0].estado = "Respondido";
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta.startsWith("/api/radicados?")) return paginaRadicados(radicados, ruta);
      if (ruta.endsWith("/documentos")) return respuestaJson({ documentos: [] });
      if (ruta.endsWith("/respuesta")) return respuestaJson({ success: true, respuesta: {
        funcionario_nombre: "Brandon Grajales", dependencia_responsable: "Talento Humano",
        fecha_envio: "2026-10-21 11:30:00", contenido: "Respuesta oficial registrada",
        documentos: [{ id: 1, nombre_archivo: "respuesta.pdf", ruta_archivo: "respuestas/archivo.pdf", tamano_bytes: 100 }],
      } });
      if (ruta === "/uploads/respuestas/archivo.pdf") return { blob: async () => new Blob(["PDF"]) };
      return base(ruta, opciones);
    });
    simularUrlsBlob("blob:respuesta");
    await abrirConsulta();
    document.querySelectorAll("dialog").forEach((dialogo) => {
      dialogo.showModal = vi.fn(() => dialogo.setAttribute("open", ""));
      dialogo.close = vi.fn(() => {
        dialogo.removeAttribute("open");
        fireEvent(dialogo, new Event("close"));
      });
    });
    const boton = screen.getByText("RAD-001", { selector: "button" });
    await act(async () => fireEvent.click(boton));
    await screen.findByText("Este radicado no tiene documentos adjuntos.");
    const detalle = document.querySelector("#modal-detalle");
    expect(within(detalle).queryByText("Respuesta institucional")).toBeNull();
    expect(within(detalle).queryByText("Dependencia responsable")).toBeNull();
    expect(within(detalle).getByText("Estado")).toBeTruthy();
    expect(solicitarApi.mock.calls.some(([ruta]) => ruta.startsWith("/uploads/") || ruta.endsWith("/respuesta"))).toBe(false);
    expect(solicitarApi.mock.calls.some(([ruta]) => ruta.includes("/respuesta/resumen"))).toBe(false);
    await act(async () => detalle.close());
    await act(async () => fireEvent.click(
      within(boton.closest("tr")).getByRole("button", { name: "Ver respuesta" }),
    ));
    const modalRespuesta = document.querySelector(".respuesta-dialog");
    expect(await within(modalRespuesta).findByText("Brandon Grajales")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Respuesta institucional RAD-001" })).toBe(modalRespuesta);
    expect(within(modalRespuesta).getByRole("heading", {
      name: "Respuesta institucional RAD-001",
    }).querySelector(".respuesta-numero").textContent).toBe("RAD-001");
    expect(within(modalRespuesta).getByText("Talento Humano")).toBeTruthy();
    expect(within(modalRespuesta).getByText("Fecha de registro de respuesta").closest(".modal-field").textContent).toContain("2026");
    expect(within(modalRespuesta).getByRole("region", { name: "Resumen de la respuesta" })).toBeTruthy();
    expect(within(modalRespuesta).getByText("Sin plantilla").className).toContain("detalle-badge--plantilla");
    const contenido = within(modalRespuesta).getByRole("region", { name: "Contenido de la respuesta" });
    const documentos = within(modalRespuesta).getByRole("region", { name: "Documentos adjuntos" });
    expect(contenido.textContent)
      .toContain("Respuesta oficial registrada");
    expect(documentos.textContent).toContain("0.0 MB");
    for (const seccion of [contenido, documentos]) {
      expect(seccion.className).toContain("respuesta-grupo");
    }
    expect(within(modalRespuesta).getByText("Respuesta oficial registrada")).toBeTruthy();
    expect(within(documentos).getByRole("link", { name: "respuesta.pdf" }).getAttribute("href")).toBe("blob:respuesta");
    expect(within(modalRespuesta).getAllByText("Respondida por")).toHaveLength(1);
    expect(within(modalRespuesta).queryByRole("button", { name: "Ver seguimiento de entrega" }) !== null)
      .toBe(tipo === "Externa");
    expect(solicitarApi).toHaveBeenCalledWith("/uploads/respuestas/archivo.pdf");
  });

  it("bloquea cierre y Escape durante confirmacion de entrega sin afectar la respuesta", async () => {
    registrosSimulados[0].estado = "Respondido";
    const pendiente = diferida();
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, o) => {
      if (ruta.endsWith("/respuesta")) return Promise.resolve(respuestaJson({ success: true, respuesta: {
        id: 1, funcionario_nombre: "Actor ficticio", dependencia_responsable: "Oficina ficticia",
        fecha_envio: "2026-01-05 10:00:00", contenido: "Respuesta ficticia.", documentos: [],
      } }));
      if (ruta.endsWith("/entregas") && o?.method === "POST") return pendiente.promise;
      if (ruta.endsWith("/entregas/documentos-respuesta")) return Promise.resolve(respuestaJson({ success: true, documentos: [] }));
      if (ruta.includes("/entregas?")) return Promise.resolve(respuestaJson({ success: true, resumen: "pendiente_de_envio",
        registros: [], total: 0, pagina: 1, paginas: 0 }));
      return base(ruta, o);
    });
    await abrirConsulta(); prepararDialogos();
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    fireEvent.click(within(fila).getByRole("button", { name: "Ver respuesta" }));
    const modal = document.querySelector(".respuesta-dialog");
    const consulta = within(modal);
    await consulta.findByText("Respuesta ficticia.");
    await act(async () => fireEvent.click(consulta.getByRole("button", { name: "Ver seguimiento de entrega" })));
    await act(async () => fireEvent.click(consulta.getByRole("button", { name: "Registrar envío/entrega" })));
    const boton = consulta.getByRole("button", { name: "Confirmar envío/entrega" });
    fireEvent.change(consulta.getByLabelText("Correo de destino"), { target: { value: "fixture@example.test" } });
    expect(consulta.getByText("La respuesta institucional no tiene PDF adjuntos.")).toBeTruthy();
    fireEvent.submit(boton.closest("form"));
    const botonesCerrar = consulta.getAllByRole("button", { name: "Cerrar" });
    expect(botonesCerrar.every(b => b.disabled)).toBe(true);
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(modal, cancel); expect(cancel.defaultPrevented).toBe(true);
    expect(modal.hasAttribute("open")).toBe(true);
    await act(async () => pendiente.reject(Object.assign(new Error("Destino inválido"), { status: 400 })));
    expect(botonesCerrar.every(b => b.isConnected && !b.disabled)).toBe(true);
  });
  it.each(["Planeación", null])("consulta la respuesta global seleccionada y muestra dependencia %s", async (dependencia) => {
    const radicados = crearRadicados();
    Object.assign(radicados[0], { estado: "Respondido", destino_todas_dependencias: 1, radicado_dependencia_id: 301 });
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta.startsWith("/api/radicados?")) return paginaRadicados(radicados, ruta);
      if (ruta === "/api/radicados/RAD-001/respuesta?radicado_dependencia_id=301") {
        return respuestaJson({ success: true, respuesta: {
          funcionario_nombre: "Andrea", dependencia_responsable: dependencia,
          fecha_envio: "2026-10-21 11:30:00", contenido: "Respuesta seleccionada", documentos: [],
        } });
      }
      return base(ruta, opciones);
    });
    await abrirConsulta();
    const modal = document.querySelector(".respuesta-dialog");
    modal.showModal = vi.fn();
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    fireEvent.click(within(fila).getByRole("button", { name: "Ver respuesta" }));
    expect(await within(modal).findByText(dependencia || "No registrada")).toBeTruthy();
    expect(within(modal).getByText("Andrea")).toBeTruthy();
    expect(within(modal).getByText("La respuesta no tiene PDF adjuntos.")).toBeTruthy();
    expect(solicitarApi).toHaveBeenCalledWith("/api/radicados/RAD-001/respuesta?radicado_dependencia_id=301");
    expect(solicitarApi.mock.calls.some(([ruta]) => ruta.includes("/respuesta/resumen"))).toBe(false);
  });

  it.each(["Oficina histórica", null])("muestra y regenera origen interno %s sin deducirlo del destino", async (origen) => {
    const radicados = crearRadicados();
    Object.assign(radicados[1], {
      dependencia_remitente: origen, dependencia_remitente_id: origen ? 3 : null,
      dependencia_destino: "Dependencia diferente",
    });
    const catalogos = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta.startsWith("/api/radicados?")) return paginaRadicados(radicados, ruta);
      if (ruta.endsWith("/documentos")) return respuestaJson({ documentos: [] });
      return catalogos(ruta, opciones);
    });
    const output = vi.fn(() => new Blob(["PDF"], { type: "application/pdf" }));
    crearPdfComprobante.mockReturnValue({ output });
    simularUrlsBlob("blob:comprobante");
    const user = userEvent.setup({ delay: null });
    await abrirConsulta();
    document.querySelectorAll("dialog").forEach((dialogo) => {
      dialogo.showModal = vi.fn(() => dialogo.setAttribute("open", ""));
      dialogo.close = vi.fn(() => dialogo.removeAttribute("open"));
    });
    const boton = screen.getByText("RAD-002", { selector: "button" });
    const fila = boton.closest("tr");
    await user.click(boton);
    const campo = screen.getByText("Dependencia remitente").closest(".modal-field");
    expect(campo.textContent).toContain(origen || "No registrada");
    expect(campo.textContent).not.toContain("Dependencia diferente");
    await user.click(within(fila).getByRole("button", { name: "Ver comprobante" }));
    expect(crearPdfComprobante).toHaveBeenLastCalledWith(expect.objectContaining({
      tipo_comunicacion: "Interna", dependencia_remitente: origen,
    }));
    expect(output).toHaveBeenCalledWith("blob");
  });

  it("presenta origen y destino del traslado en el historial sin confundirlo con una respuesta", async () => {
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta.includes("/historial")) return respuestaJson({ success: true, historial: [{
        id: 501, event_type: "traslado_aprobado", actor_name: "Ventanilla fixture",
        dependencia_nombre: "Origen fixture", valor_anterior: "Origen fixture", valor_nuevo: "Destino fixture",
        motivo: "Solicitud de traslado #1: Nueva dependencia competente.",
        ocurrido_en_utc: "2026-11-04 15:00:00",
      }] });
      if (ruta.endsWith("/documentos")) return respuestaJson({ documentos: [] });
      return base(ruta, opciones);
    });
    await abrirConsulta();
    prepararDialogos();
    fireEvent.click(screen.getByRole("button", { name: "RAD-001" }));
    await screen.findByText("Traslado aprobado por Ventanilla");
    const cambio = screen.getByText("Reasignación:").closest("p");
    expect(cambio.textContent).toContain("Origen fixture → Destino fixture");
    expect(screen.queryByText("Respuesta institucional registrada")).toBeNull();
  });

  it("administrador conserva respuesta externa pero solo consulta internos individuales", async () => {
    render(<PaginaConsultaRadicados />);
    const externo = (await screen.findByText("RAD-001")).closest("tr");
    const interno = screen.getByText("RAD-002").closest("tr");
    expect(within(externo).getByRole("button", { name: "Responder" })).toBeTruthy();
    expect(within(interno).queryByRole("button", { name: "Responder" })).toBeNull();
  });
  it("ofrece traslado solo al funcionario sobre individuales abiertos", async () => {
    confirmarSesion.mockResolvedValue({ ...usuario, rol: "funcionario", dependencia_id: 3 });
    registrosSimulados.forEach((radicado) => { radicado.dependencia_destino_id = 3; });
    registrosSimulados[1].destino_todas_dependencias = 1;
    registrosSimulados[2].estado = "Enterado";
    await abrirConsulta();
    expect(screen.getAllByRole("button", { name: "Solicitar traslado" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Solicitar traslado" }).closest("tr").textContent).toContain("RAD-001");
    expect(screen.getByRole("button", { name: "Mis solicitudes de traslado" })).toBeTruthy();
  });

  it("carga destinos de traslado completos sin ampliar las dependencias de alertas del funcionario", async () => {
    confirmarSesion.mockResolvedValue({ ...usuario, rol: "funcionario", dependencia_id: 3 });
    registrosSimulados.forEach((radicado) => { radicado.dependencia_destino_id = 3; });
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta === "/api/dependencias") return respuestaJson({ success: true,
        dependencias: [{ id: 3, nombre: "Oficina de Planeación", activo: 1 }] });
      if (ruta === "/api/traslados/dependencias") return respuestaJson({ success: true, dependencias: [
        { id: 3, nombre: "Oficina de Planeación", activo: 1 },
        { id: 4, nombre: "SEDAM", activo: 1 },
        { id: 5, nombre: "Secretaría de Gobierno", activo: 1 },
        { id: 6, nombre: "Inactiva", activo: 0 },
      ] });
      return base(ruta, opciones);
    });
    const showModalOriginal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true, value() { this.setAttribute("open", ""); },
    });
    try {
      await abrirConsulta();
      fireEvent.click(screen.getAllByRole("button", { name: "Solicitar traslado" })[0]);
      const selector = await screen.findByLabelText("Dependencia sugerida");
      await waitFor(() => expect(within(selector).getAllByRole("option")).toHaveLength(3));
      expect(within(selector).getByRole("option", { name: "SEDAM" }).value).toBe("4");
      expect(within(selector).getByRole("option", { name: "Secretaría de Gobierno" })).toBeTruthy();
      expect(within(selector).queryByRole("option", { name: "Oficina de Planeación" })).toBeNull();
      expect(within(selector).queryByRole("option", { name: "Inactiva" })).toBeNull();
      fireEvent.change(selector, { target: { value: "4" } });
      expect(selector.value).toBe("4");
      const alertas = screen.getByLabelText("Dependencia", { selector: "select" });
      expect(alertas.disabled).toBe(true);
      expect(within(alertas).queryByRole("option", { name: "SEDAM" })).toBeNull();
    } finally {
      if (showModalOriginal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalOriginal);
      else delete HTMLDialogElement.prototype.showModal;
    }
  });

  it("limpia vistas y recarga Consulta al perder autorización sobre el expediente", async () => {
    const alertar = simularAlerta();
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta.endsWith("/documentos")) throw Object.assign(new Error("Fuera de tu dependencia"), { status: 404 });
      return base(ruta, opciones);
    });
    await abrirConsulta();
    prepararDialogos();
    fireEvent.click(screen.getByRole("button", { name: "RAD-001" }));
    await waitFor(() => expect(alertar).toHaveBeenCalledWith(expect.stringContaining("Fuera de tu dependencia")));
    expect(document.querySelector("#modal-detalle").open).toBe(false);
    await waitFor(() => expect(solicitarApi.mock.calls.filter(([ruta]) => ruta.startsWith("/api/radicados?")).length).toBeGreaterThan(1));
  });

  it("conserva columnas y acciones únicas en las tarjetas de radicados", async () => {
    await abrirConsulta();
    const tabla = screen.getByRole("table", { name: "Radicados" });
    const fila = within(tabla).getByRole("button", { name: "RAD-001" }).closest("tr");
    const etiquetas = Array.from(fila.querySelectorAll(".tarjeta-etiqueta"));
    expect(etiquetas.map((etiqueta) => etiqueta.textContent)).toEqual([
      "Radicado", "Tipo / fecha", "Remitente", "Semáforo", "Estado", "Acciones",
    ]);
    expect(etiquetas.every((etiqueta) => etiqueta.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(within(fila).getAllByRole("cell")).toHaveLength(6);
    expect(within(fila).getAllByRole("button", { name: "Responder" })).toHaveLength(1);
    expect(within(tabla).getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.getByRole("region", { name: "Listado de radicados" }).tabIndex).toBe(0);
  });

  it("espera el PDF, bloquea clics duplicados y permite reintentar tras fallo de imagen", async () => {
    const alertar = simularAlerta();
    let rechazar;
    crearPdfComprobante.mockReset().mockImplementationOnce(() => new Promise((_, reject) => { rechazar = reject; }));
    const output = vi.fn(() => new Blob(["PDF"]));
    crearPdfComprobante.mockResolvedValue({ output });
    simularUrlsBlob("blob:marca");
    await abrirConsulta();
    document.querySelector(".receipt-dialog").showModal = vi.fn();
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    const boton = within(fila).getByRole("button", { name: "Ver comprobante" });
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(boton.disabled).toBe(true);
    expect(crearPdfComprobante).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Generando comprobante…")).toBeTruthy();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    rechazar(new Error("No se pudo cargar el escudo"));
    await waitFor(() => expect(boton.disabled).toBe(false));
    expect(alertar).toHaveBeenCalledWith(expect.stringContaining("No se pudo cargar el escudo"));
    fireEvent.click(boton);
    await waitFor(() => expect(output).toHaveBeenCalledWith("blob"));
    expect(screen.getByTitle("Vista previa del comprobante").getAttribute("src")).toBe("blob:marca");
    expect(solicitarApi.mock.calls.filter(([ruta, opciones]) => ruta === "/api/radicados" && opciones?.method === "POST")).toHaveLength(0);
  });

  it("ignora un PDF que termina de generarse después de desmontar Consulta", async () => {
    let terminar;
    crearPdfComprobante.mockReset().mockImplementation(() => new Promise(resolve => { terminar = resolve; }));
    const output = vi.fn();
    simularUrlsBlob();
    const vista = render(<PaginaConsultaRadicados />);
    const fila = (await screen.findByText("RAD-001", { selector: "button" })).closest("tr");
    fireEvent.click(within(fila).getByRole("button", { name: "Ver comprobante" }));
    vista.unmount();
    terminar({ output });
    await Promise.resolve();
    expect(output).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("descarta un comprobante pendiente si su dialogo se cierra antes de terminar", async () => {
    const pendiente = diferida();
    crearPdfComprobante.mockReturnValue(pendiente.promise);
    simularUrlsBlob("blob:descartado");
    await abrirConsulta();
    prepararDialogos();
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    const boton = within(fila).getByRole("button", { name: "Ver comprobante" });
    fireEvent.click(boton);
    const modal = document.querySelector(".receipt-dialog");
    fireEvent(modal, new Event("close"));
    await act(async () => pendiente.resolve({ output: () => new Blob(["PDF"]) }));
    expect(modal.open).toBe(false);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(boton.disabled).toBe(false);
  });

  it("presenta clasificación jurídica y contacto de una externa", async () => {
    const radicados = crearRadicados();
    Object.assign(radicados[0], {
      remitente_tipo_persona: "juridica", remitente_entidad: "Empresa registrada",
      remitente_nit: "900123456", remitente_email: "empresa@example.com",
    });
    const catalogos = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta.startsWith("/api/radicados?")) return paginaRadicados(radicados, ruta);
      if (ruta.endsWith("/documentos")) return respuestaJson({ documentos: [] });
      return catalogos(ruta, opciones);
    });
    const user = userEvent.setup({ delay: null });
    await abrirConsulta();
    document.querySelectorAll("dialog").forEach((dialogo) => {
      dialogo.showModal = vi.fn(() => dialogo.setAttribute("open", ""));
      dialogo.close = vi.fn(() => dialogo.removeAttribute("open"));
    });
    await user.click(screen.getByText("RAD-001", { selector: "button" }));
    expect(screen.getByText("Jurídica")).toBeTruthy();
    expect(screen.getByText("Empresa registrada")).toBeTruthy();
    expect(screen.getByText("900123456")).toBeTruthy();
    expect(screen.getByText("empresa@example.com")).toBeTruthy();
    expect(screen.queryByText("Dependencia remitente")).toBeNull();
  });

  it("muestra el rechazo de un PDF de más de 10 MB fuera del cuerpo desplazable", async () => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta();
    const consulta = within(selector.closest("dialog"));

    await user.upload(selector, crearPdf("excedido.pdf", 10 * 1024 * 1024 + 1));

    const alerta = consulta.getByRole("alert");
    expect(alerta.textContent).toContain("excedido.pdf");
    expect(alerta.textContent).toContain("10485761 bytes");
    expect(alerta.textContent).toContain("10 MB");
    expect(alerta.closest(".modal-content")).toBeNull();
    expect(selector.getAttribute("aria-invalid")).toBe("true");
    expect(selector.getAttribute("aria-describedby")).toContain(alerta.id);
    expect(consulta.queryByRole("list", { name: "Archivos seleccionados" })).toBeNull();
  });

  it("conserva y envía los PDFs anteriores al rechazar una selección nueva", async () => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta();
    const consulta = within(selector.closest("dialog"));
    const valido = crearPdf("anterior.pdf", 32);
    await user.selectOptions(consulta.getByLabelText("Plantilla institucional"), "general");
    await user.upload(selector, valido);
    await user.upload(selector, crearPdf("excedido.pdf", 10 * 1024 * 1024 + 1));

    expect(consulta.getByRole("alert").textContent).toContain("Se conservan");
    expect(within(consulta.getByRole("list", { name: "Archivos seleccionados" })).getByText(/anterior.pdf/)).toBeTruthy();
    expect(consulta.getByLabelText("Plantilla institucional").value).toBe("general");
    expect(consulta.getByLabelText(/Contenido de la respuesta/).value).toContain("En atención");
    expect(consulta.getByRole("region", { name: "Radicado a responder" })).toBeTruthy();
    expect(consulta.getByRole("region", { name: "Redacción" })).toBeTruthy();
    expect(consulta.getByRole("region", { name: "Adjuntos de la respuesta" })).toBeTruthy();
    const contador = document.getElementById("contador-respuesta");
    expect(contador.textContent).toContain(`${consulta.getByLabelText(/Contenido de la respuesta/).value.length} / 10.000`);
    expect(consulta.getByLabelText(/Contenido de la respuesta/).getAttribute("aria-describedby")).toBe("contador-respuesta");

    const original = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones = {}) => {
      if (opciones.method === "POST") {
        return { ok: true, json: async () => ({ success: true, estado: "Respondido" }) };
      }
      if (ruta.endsWith("/respuesta")) return respuestaJson({
        respuesta: { contenido: "Respuesta guardada", documentos: [] },
      });
      return original(ruta, opciones);
    });
    await user.click(consulta.getByRole("button", { name: "Enviar respuesta" }));

    const envio = solicitarApi.mock.calls.find(([, opciones]) => opciones?.method === "POST");
    expect(envio[1].body.getAll("archivos")).toEqual([valido]);
    await waitFor(() => expect(consulta.queryByLabelText(/Documentos de respuesta/)).toBeNull());
  });

  it("acepta exactamente 10 MB y limpia el error al reemplazar la selección", async () => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta();
    const consulta = within(selector.closest("dialog"));
    await user.upload(selector, crearPdf("excedido.pdf", 10 * 1024 * 1024 + 1));
    await user.upload(selector, crearPdf("limite.pdf", 10 * 1024 * 1024));

    expect(consulta.queryByRole("alert")).toBeNull();
    expect(selector.getAttribute("aria-invalid")).toBe("false");
    expect(consulta.getByText(/limite.pdf/)).toBeTruthy();
  });

  it("rechaza más de cinco PDFs y extensiones inválidas sin borrar los anteriores", async () => {
    const user = userEvent.setup({ applyAccept: false, delay: null });
    const selector = await abrirRespuesta();
    const consulta = within(selector.closest("dialog"));
    await user.upload(selector, crearPdf("anterior.pdf", 32));
    await user.upload(selector, Array.from({ length: 6 }, (_, i) => crearPdf(`${i}.pdf`, 32)));
    expect(consulta.getByRole("alert").textContent).toContain("máximo 5");
    await user.upload(selector, new File(["texto"], "invalido.txt", { type: "text/plain" }));
    expect(consulta.getByRole("alert").textContent).toContain("invalido.txt");
    expect(consulta.getByText(/anterior.pdf/)).toBeTruthy();
    fireEvent.change(selector, { target: { files: [] } });
    expect(consulta.getByText(/anterior.pdf/)).toBeTruthy();
  });

  it("admite cinco PDFs, rechaza archivos vacíos y reinicia los adjuntos al reabrir", async () => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta();
    const dialogo = selector.closest("dialog");
    const consulta = within(dialogo);
    await user.upload(selector, Array.from({ length: 5 }, (_, i) => crearPdf(`${i}.pdf`, 32)));
    expect(within(consulta.getByRole("list", { name: "Archivos seleccionados" })).getAllByRole("listitem")).toHaveLength(5);
    await user.upload(selector, crearPdf("vacio.pdf", 0));
    expect(consulta.getByRole("alert").textContent).toContain("está vacío");
    expect(within(consulta.getByRole("list", { name: "Archivos seleccionados" })).getAllByRole("listitem")).toHaveLength(5);

    await user.click(consulta.getByRole("button", { name: "Cancelar" }));
    fireEvent(dialogo, new Event("close"));
    await waitFor(() => expect(consulta.queryByLabelText(/Documentos de respuesta/)).toBeNull());
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    await user.click(within(fila).getByRole("button", { name: "Responder" }));
    consulta.getByLabelText(/Documentos de respuesta/);
    expect(consulta.queryByRole("alert")).toBeNull();
    expect(consulta.queryByRole("list", { name: "Archivos seleccionados" })).toBeNull();
  });

  it("comparte encabezado accesible y tarjetas en Responder con nombres PDF largos", async () => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta();
    const modal = screen.getByRole("dialog", { name: "Respuesta institucional RAD-001" });
    const consulta = within(modal);
    expect(consulta.getByRole("heading", { name: "Respuesta institucional RAD-001" })
      .querySelector(".respuesta-numero").textContent).toBe("RAD-001");
    const pie = within(modal.querySelector(".modal-footer"));
    const enviar = pie.getByRole("button", { name: "Enviar respuesta" });
    expect(enviar.className).toBe("respuesta-enviar");
    expect(enviar.disabled).toBe(true);
    for (const nombre of ["Redacción", "Adjuntos de la respuesta"]) {
      expect(consulta.getByRole("region", { name: nombre }).className).toContain("respuesta-grupo");
    }
    const nombreLargo = `${"documento-institucional-".repeat(12)}.pdf`;
    await user.upload(selector, crearPdf(nombreLargo, 1024));
    const nombre = consulta.getByText(nombreLargo);
    expect(nombre.className).toBe("detalle-archivo-nombre");
    expect(nombre.closest("li").querySelector(".detalle-archivo-tamano").textContent).toBe("0.0 MB");
    expect(pie.getByRole("button", { name: "Cancelar" }).className).not.toContain("respuesta-enviar");
    await user.selectOptions(consulta.getByLabelText("Plantilla institucional"), "general");
    expect(enviar.disabled).toBe(false);
  });

  it.each([
    { errorServidor: "Cada PDF debe pesar máximo 10 MB.", conAdjunto: false },
    {
      errorServidor: "El archivo PDF está cifrado o protegido con contraseña y no se puede validar. Adjunta una copia sin protección, si tienes autorización para hacerlo.",
      conAdjunto: true,
    },
  ])("mantiene visible el rechazo del servidor: $errorServidor", async ({ errorServidor, conAdjunto }) => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta();
    const consulta = within(selector.closest("dialog"));
    const adjuntos = conAdjunto ? [crearPdf("protegido.pdf", 32)] : [];
    if (conAdjunto) await user.upload(selector, adjuntos);
    await user.selectOptions(consulta.getByLabelText("Plantilla institucional"), "general");
    const original = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones = {}) => {
      if (opciones.method === "POST") throw new Error(errorServidor);
      return original(ruta, opciones);
    });
    await user.click(consulta.getByRole("button", { name: "Enviar respuesta" }));
    const mensaje = await consulta.findByText(errorServidor);
    expect(mensaje.closest(".modal-content")).toBeNull();
    const envio = solicitarApi.mock.calls.find(([, opciones]) => opciones?.method === "POST");
    expect(envio[1].body.getAll("archivos")).toEqual(adjuntos);
    expect(consulta.getByLabelText("Plantilla institucional").value).toBe("general");
    if (conAdjunto) expect(consulta.getByText(/protegido.pdf/)).toBeTruthy();
  });

  it("descarta metadatos tardios al cambiar de radicado y al cerrar el detalle", async () => {
    const primera = diferida();
    const segunda = diferida();
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta === "/api/radicados/RAD-001/documentos") return primera.promise;
      if (ruta === "/api/radicados/RAD-002/documentos") return segunda.promise;
      return base(ruta, opciones);
    });
    await abrirConsulta();
    prepararDialogos();
    fireEvent.click(screen.getByText("RAD-001", { selector: "button" }));
    fireEvent.click(screen.getByText("RAD-002", { selector: "button" }));
    await act(async () => segunda.resolve(respuestaJson({ documentos: [
      { id: 2, nombre_archivo: "segundo.pdf" },
    ] })));
    const modal = document.querySelector("#modal-detalle");
    expect(within(modal).getByText("Ver segundo.pdf")).toBeTruthy();
    await act(async () => primera.resolve(respuestaJson({ documentos: [
      { id: 1, nombre_archivo: "primero.pdf" },
    ] })));
    expect(within(modal).queryByText("Ver primero.pdf")).toBeNull();
    expect(within(modal).getByText("Ver segundo.pdf")).toBeTruthy();
    fireEvent.click(within(modal).getByRole("button", { name: "Cerrar" }));
    expect(modal.open).toBe(false);
    const tercera = diferida();
    solicitarApi.mockImplementation((ruta, opciones) => ruta.endsWith("/documentos") ? tercera.promise : base(ruta, opciones));
    fireEvent.click(screen.getByText("RAD-001", { selector: "button" }));
    fireEvent(modal, new Event("cancel", { cancelable: true }));
    await act(async () => tercera.reject(new Error("Fallo tardio")));
    expect(modal.open).toBe(false);
    expect(within(modal).queryByText(/Fallo tardio/)).toBeNull();
  });

  it("presenta el historial paginado y no muestra identificadores de red o sesión", async () => {
    const primera = {
      success: true,
      historial: [{
        id: 8, event_type: "estado_cambiado", valor_anterior: "Recibido",
        valor_nuevo: "En trámite", actor_name: "María", dependencia_nombre: "Planeación",
        ocurrido_en_utc: "2026-10-25 16:00:00.123000", ip_address: "192.0.2.1",
        session_id: "secreto",
      }],
      next_cursor: 8, has_more: true,
    };
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta.endsWith("/historial?limite=25"))
        return Promise.resolve(respuestaJson(primera));
      if (ruta.endsWith("/historial?limite=25&cursor=8"))
        return Promise.resolve(respuestaJson({
          historial: [{ id: 7, event_type: "radicado_asignado", actor_name: "Luis",
            dependencia_nombre: "Hacienda", ocurrido_en_utc: "2026-10-25 15:00:00.000000" }],
          next_cursor: null, has_more: false,
        }));
      return base(ruta, opciones);
    });
    const timeline = await abrirHistorial();
    const modal = document.querySelector("#modal-detalle");
    expect(within(timeline).getByText("Cambio de estado")).toBeTruthy();
    expect(within(timeline).getByText("Recibido → En trámite")).toBeTruthy();
    expect(within(timeline).getByText("María").textContent).toBe("Registrado por: María");
    expect(within(timeline).getByText("Planeación").textContent).toBe("Dependencia atendida: Planeación");
    expect(within(timeline).getByRole("heading", { name: "Cambio de estado", level: 4 })).toBeTruthy();
    expect(within(timeline).getByText("Se actualizó el estado del expediente.")).toBeTruthy();
    expect(timeline.textContent).toContain("25/10/2026");
    expect(timeline.textContent).toMatch(/11:00:00/);
    expect(timeline.textContent).not.toContain("192.0.2.1");
    expect(timeline.textContent).not.toContain("secreto");
    await userEvent.click(within(modal).getByRole("button", { name: "Cargar eventos anteriores" }));
    expect(await within(timeline).findByText("Asignado a dependencia")).toBeTruthy();
    expect(within(timeline).getByText("Hacienda").textContent).toBe("Dependencia destinataria: Hacienda");
    expect(timeline.querySelector("li").textContent).toContain("Asignado a dependencia");
    expect(solicitarApi).toHaveBeenCalledWith("/api/radicados/RAD-001/historial?limite=25&cursor=8");
  });

  it("separa los eventos iniciales y describe cambios sin imprimir valores JSON", async () => {
    const eventos = [
      { id: 1, event_type: "regla_respuesta_aplicada",
        valor_nuevo: '{"requiere_respuesta":true,"dias":15}',
        motivo: "Regla de respuesta aplicada al crear el radicado." },
      { id: 2, event_type: "radicado_creado", actor_name: "Ana",
        dependencia_nombre: "Planeación", motivo: "Radicado recibido y registrado." },
      { id: 3, event_type: "radicado_asignado", dependencia_nombre: "Planeación" },
      { id: 4, event_type: "documentos_radicado_adjuntados",
        motivo: "Se adjuntaron 2 documento(s) PDF al radicado." },
      { id: 5, event_type: "termino_ampliado", valor_anterior: "2026-10-28",
        valor_nuevo: "2026-11-03", motivo: "Ampliación justificada de prueba." },
      { id: 6, event_type: "respuesta_enviada", valor_anterior: "En trámite",
        valor_nuevo: "Respondido" },
    ].map(evento => ({ ocurrido_en_utc: "2026-10-27 13:26:35.000000", ...evento }));
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta.includes("/historial?"))
        return Promise.resolve(respuestaJson({ historial: [...eventos].reverse(), has_more: false }));
      if (ruta.endsWith("/documentos")) return Promise.resolve(respuestaJson({ documentos: [] }));
      return base(ruta, opciones);
    });
    const lista = await abrirHistorial();
    expect(within(lista).getAllByRole("article")).toHaveLength(6);
    expect(within(lista).getAllByRole("heading", { level: 4 }).map(titulo => titulo.textContent))
      .toEqual(["Regla de respuesta aplicada", "Radicado recibido", "Asignado a dependencia",
        "Documentos originales adjuntados", "Término ampliado", "Respuesta institucional registrada"]);
    expect(lista.textContent).toContain("Se adjuntaron 2 documento(s) PDF");
    expect(lista.textContent).toContain("2026-10-28 → 2026-11-03");
    expect(lista.textContent).toContain("En trámite → Respondido");
    expect(lista.textContent).toContain("Este evento no acredita su envío ni su entrega");
    expect(lista.textContent).not.toContain('{"requiere_respuesta"');
    expect(screen.getByText(/Las fechas nuevas se muestran en hora de Bogotá/)).toBeTruthy();
    expect(screen.queryByText(/Cómo leer este historial/)).toBeNull();
    expect(document.querySelector("#modal-detalle .timeline-aclaracion")).toBeNull();
  });

  it("conserva eventos históricos y desconocidos sin inventar actor, dependencia ni zona horaria", async () => {
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta.includes("/historial?"))
        return Promise.resolve(respuestaJson({ historial: [
          { id: 3, event_type: "tipo_futuro", ocurrido_en_utc: "fecha-invalida" },
          { id: 2, campo_modificado: "estado", creado_en: "2025-01-02 09:00:00",
            usuario: "migracion_009", valor_anterior: "Recibido", valor_nuevo: "Pendiente" },
          { id: 1, campo_modificado: "otro" },
        ], has_more: false }));
      if (ruta.endsWith("/documentos")) return Promise.resolve(respuestaJson({ documentos: [] }));
      return base(ruta, opciones);
    });
    const lista = await abrirHistorial();
    expect(lista.textContent).toContain("zona horaria histórica no confirmada");
    expect(lista.textContent).toContain("Fecha histórica no disponible");
    expect(lista.textContent).toContain("Fecha UTC inválida");
    expect(lista.textContent).toContain("No identificado en el registro histórico");
    expect(lista.textContent).toContain("No registrada en este evento");
    expect(lista.textContent).toContain("Recibido → Pendiente");
    expect(within(lista).getByRole("heading", { name: "Cambio de estado histórico" })).toBeTruthy();
  });

  it("agrupa registros por minuto sin atribuir la oficina del destino al usuario", async () => {
    const eventos = [
      { id: 1, event_type: "regla_respuesta_aplicada", actor_name: "Karime",
        ocurrido_en_utc: "2026-11-03 15:44:59.000000" },
      { id: 2, event_type: "radicado_creado", actor_name: "Karime", dependencia_nombre: "Planeación",
        ocurrido_en_utc: "2026-11-03 15:44:59.100000" },
      { id: 3, event_type: "radicado_asignado", actor_name: "Karime", dependencia_nombre: "Planeación",
        ocurrido_en_utc: "2026-11-03 15:44:59.200000" },
      { id: 4, event_type: "estado_cambiado", actor_name: "Andrea", dependencia_nombre: "Planeación",
        valor_anterior: "Recibido", valor_nuevo: "Pendiente", ocurrido_en_utc: "2026-11-03 15:50:21.000000" },
      { id: 5, event_type: "estado_cambiado", actor_name: "Andrea", dependencia_nombre: "Hacienda",
        valor_anterior: "Pendiente", valor_nuevo: "En trámite", ocurrido_en_utc: "2026-11-03 15:58:00.000000" },
    ];
    const radicados = crearRadicados();
    Object.assign(radicados[0], { estado: "En trámite", asunto_documento: "Línea 1\nLínea 2" });
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta.startsWith("/api/radicados?")) return Promise.resolve(paginaRadicados(radicados, ruta));
      if (ruta.includes("/historial?"))
        return Promise.resolve(respuestaJson({ historial: [...eventos].reverse(), has_more: false }));
      if (ruta.endsWith("/documentos")) return Promise.resolve(respuestaJson({ documentos: [] }));
      return base(ruta, opciones);
    });
    const lista = await abrirHistorial();
    const modal = document.querySelector("#modal-detalle");
    const grupos = lista.querySelectorAll(":scope > li");
    expect(grupos).toHaveLength(3);
    expect(grupos[0].classList.contains("timeline-grupo")).toBe(true);
    expect(grupos[0].querySelectorAll("article")).toHaveLength(3);
    expect(grupos[0].textContent).toContain("3 registros del mismo usuario en este minuto");
    expect(within(grupos[0]).getAllByText(/^Registrado por:/)).toHaveLength(1);
    expect(within(grupos[0]).getAllByText("Planeación").every(p =>
      p.textContent === "Dependencia destinataria: Planeación")).toBe(true);
    expect(grupos[1].querySelectorAll("article")).toHaveLength(1);
    expect(grupos[2].textContent).toContain("Dependencia atendida: Hacienda");
    const regla = within(grupos[0]).getByRole("heading", { name: "Regla de respuesta aplicada" }).closest("article");
    expect(regla.textContent).toContain("No registrada en este evento");
    expect(regla.textContent).not.toContain("Planeación");
    expect(regla.textContent).toContain("Registro automático");
    expect(within(grupos[0]).getAllByRole("article").every(a => a.querySelector("time"))).toBe(true);

    const resumen = within(modal).getByRole("region", { name: "Resumen del radicado" });
    const estado = within(resumen).getByText("En trámite");
    expect(estado.className).toContain("detalle-badge--estado-en-tramite");
    expect(within(resumen).getByText("Requiere respuesta").className).toContain("detalle-badge--requiere");
    expect(within(modal).getByRole("region", { name: "Remitente" })).toBeTruthy();
    expect(within(modal).getByRole("region", { name: "Trámite" })).toBeTruthy();
    expect(within(modal).getByRole("region", { name: "Asunto" }).textContent).toContain("Línea 1\nLínea 2");
  });

  it("no une usuarios distintos con el mismo nombre ni mezcla fechas UTC con históricas", async () => {
    const eventos = [
      { id: 1, actor_id: 7, actor_name: "Usuario ficticio", event_type: "radicado_creado",
        dependencia_nombre: "Planeación" },
      { id: 2, actor_id: 8, actor_name: "Usuario ficticio", event_type: "radicado_asignado",
        dependencia_nombre: "Hacienda" },
      { id: 3, actor_id: 8, actor_name: "Usuario ficticio", event_type: "radicado_asignado",
        dependencia_nombre: "Gobierno" },
      { id: 4, actor_id: 8, actor_name: "Usuario ficticio", event_type: "tipo_futuro",
        ocurrido_en_utc: null, creado_en: "2026-11-03 15:44:20" },
      { id: 5, usuario: "42", event_type: "tipo_futuro" },
    ].map(e => ({ ocurrido_en_utc: "2026-11-03 15:44:10.000000", ...e }));
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => ruta.includes("/historial?")
      ? Promise.resolve(respuestaJson({ historial: [...eventos].reverse(), has_more: false }))
      : base(ruta, opciones));
    const lista = await abrirHistorial();
    expect(lista.children).toHaveLength(4);
    expect(within(lista.children[1]).getAllByRole("article")).toHaveLength(2);
    expect(lista.children[1].textContent).toContain("Dependencia destinataria: Hacienda");
    expect(lista.children[1].textContent).toContain("Dependencia destinataria: Gobierno");
    expect(lista.children[2].textContent).toContain("zona horaria histórica no confirmada");
    expect(lista.children[3].textContent).toContain("Usuario histórico sin nombre registrado");
    expect(lista.children[3].textContent).not.toContain("Registrado por: 42");
  });

  it("describe la oficina de traslados y apertura interna por evento y distingue el destino global", async () => {
    Object.assign(registrosSimulados[0], { destino_todas_dependencias: 1, dependencia_destino: "Planeación" });
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => ruta.includes("/historial?")
      ? Promise.resolve(respuestaJson({ historial: [
        { id: 2, event_type: "respuesta_interna_abierta", actor_id: 7, actor_name: "Usuario ficticio",
          dependencia_nombre: "Origen ficticio", ocurrido_en_utc: "2026-11-03 15:44:20.000000" },
        { id: 1, event_type: "traslado_aprobado", actor_id: 7, actor_name: "Usuario ficticio",
          dependencia_nombre: "Oficina anterior", ocurrido_en_utc: "2026-11-03 15:44:10.000000",
          valor_anterior: "Oficina anterior", valor_nuevo: "Oficina nueva" },
      ], has_more: false })) : base(ruta, opciones));
    const lista = await abrirHistorial();
    expect(lista.textContent).toContain("Oficina de origen del traslado: Oficina anterior");
    expect(lista.textContent).toContain("Dependencia de origen que abrió la respuesta: Origen ficticio");
    const resumen = screen.getByRole("region", { name: "Resumen del radicado" });
    expect(resumen.textContent).toContain("Destino compartido");
    expect(resumen.textContent).toContain("Cada dependencia tiene su propio estado y respuesta");
    expect(resumen.textContent).not.toContain("Dependencia responsable actual");
  });

  it("no presenta la advertencia de entrega externa como requisito de una respuesta interna", async () => {
    registrosSimulados[0].tipo_comunicacion = "Interna";
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => ruta.includes("/historial?")
      ? Promise.resolve(respuestaJson({ historial: [{ id: 1, event_type: "respuesta_enviada",
        actor_id: 7, actor_name: "Usuario ficticio", ocurrido_en_utc: "2026-11-03 15:44:10.000000" }],
        has_more: false })) : base(ruta, opciones));
    const lista = await abrirHistorial();
    expect(lista.textContent).toContain("Se registró la respuesta institucional.");
    expect(lista.textContent).not.toContain("acredita su envío");
    expect(lista.textContent).not.toContain("se acredita por separado");
  });

  it.each(["botón", "Escape"])("nombra el diálogo y restaura el foco al cerrar con %s", async (cierre) => {
    await abrirConsulta();
    prepararDialogos();
    const boton = screen.getByText("RAD-001", { selector: "button" });
    fireEvent.click(boton);
    const modal = screen.getByRole("dialog", { name: "Detalle del radicado: RAD-001" });
    expect(document.activeElement).toBe(within(modal).getByRole("heading", { level: 2 }));
    if (cierre === "botón") fireEvent.click(within(modal).getByRole("button", { name: "Cerrar detalle del radicado" }));
    else fireEvent(modal, new Event("cancel", { cancelable: true }));
    expect(modal.open).toBe(false);
    expect(document.activeElement).toBe(boton);
  });

  it("solo presenta el ultimo PDF solicitado y libera las vistas previas al cerrar", async () => {
    const descargas = [diferida(), diferida(), diferida()];
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta.endsWith("/documentos")) return Promise.resolve(respuestaJson({ documentos: [
        { id: 1, nombre_archivo: "uno.pdf", ruta_archivo: "uno.pdf" },
        { id: 2, nombre_archivo: "dos.pdf", ruta_archivo: "dos.pdf" },
      ] }));
      if (ruta === "/uploads/uno.pdf") return descargas[0].promise;
      if (ruta === "/uploads/dos.pdf") return descargas[1].promise;
      return base(ruta, opciones);
    });
    simularUrlsBlob("blob:ultimo");
    const { unmount } = await abrirConsulta();
    prepararDialogos();
    fireEvent.click(screen.getByText("RAD-001", { selector: "button" }));
    const modal = document.querySelector("#modal-detalle");
    const uno = await within(modal).findByText("Ver uno.pdf");
    fireEvent.click(uno);
    fireEvent.click(within(modal).getByText("Ver dos.pdf"));
    await act(async () => descargas[1].resolve({ blob: async () => new Blob(["dos"]) }));
    expect(screen.getByTitle("Documento adjunto").getAttribute("src")).toBe("blob:ultimo");
    await act(async () => descargas[0].resolve({ blob: async () => new Blob(["uno"]) }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const revocar = URL.revokeObjectURL;
    fireEvent.click(within(modal).getByRole("button", { name: "Cerrar" }));
    expect(revocar).toHaveBeenCalledWith("blob:ultimo");
    fireEvent.click(screen.getByText("RAD-001", { selector: "button" }));
    await within(modal).findByText("Ver uno.pdf");
    solicitarApi.mockImplementation((ruta, opciones) => ruta.startsWith("/uploads/") ? descargas[2].promise : base(ruta, opciones));
    fireEvent.click(within(modal).getByText("Ver uno.pdf"));
    unmount();
    await act(async () => descargas[2].resolve({ blob: async () => new Blob(["tardio"]) }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("ignora respuestas tardias entre asignaciones globales y despues de cerrar", async () => {
    const pendientes = [diferida(), diferida()];
    const radicados = crearRadicados();
    Object.assign(radicados[0], { estado: "Respondido", radicado_dependencia_id: 301, destino_todas_dependencias: 1 });
    radicados[1] = { ...radicados[0], radicado_dependencia_id: 302 };
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta.startsWith("/api/radicados?")) return Promise.resolve(paginaRadicados(radicados, ruta));
      if (ruta.endsWith("radicado_dependencia_id=301")) return pendientes[0].promise;
      if (ruta.endsWith("radicado_dependencia_id=302")) return pendientes[1].promise;
      return base(ruta, opciones);
    });
    const alertar = simularAlerta();
    render(<PaginaConsultaRadicados />);
    await screen.findByText("RAD-003", { selector: "button" });
    prepararDialogos();
    const filas = screen.getAllByText("RAD-001", { selector: "button" }).map(boton => boton.closest("tr"));
    fireEvent.click(within(filas[0]).getByRole("button", { name: "Ver respuesta" }));
    fireEvent.click(within(filas[1]).getByRole("button", { name: "Ver respuesta" }));
    await act(async () => pendientes[1].resolve(respuestaJson({ respuesta: {
      contenido: "Respuesta de oficina B", documentos: [],
    } })));
    const modal = document.querySelector(".respuesta-dialog");
    expect(within(modal).getByText("Respuesta de oficina B")).toBeTruthy();
    await act(async () => pendientes[0].resolve(respuestaJson({ respuesta: {
      contenido: "Respuesta de oficina A", documentos: [],
    } })));
    expect(within(modal).queryByText("Respuesta de oficina A")).toBeNull();
    fireEvent.click(within(modal).getAllByRole("button", { name: "Cerrar", exact: true })[0]);
    const tardia = diferida();
    solicitarApi.mockImplementation(() => tardia.promise);
    fireEvent.click(within(filas[0]).getByRole("button", { name: "Ver respuesta" }));
    fireEvent(modal, new Event("cancel", { cancelable: true }));
    await act(async () => tardia.reject(new Error("Error de consulta descartada")));
    expect(modal.open).toBe(false);
    expect(alertar).not.toHaveBeenCalled();
  });

  it("libera blobs parciales de una respuesta cerrada durante la siguiente descarga", async () => {
    const segunda = diferida();
    const base = solicitarApi.getMockImplementation();
    const radicados = crearRadicados();
    radicados[0].estado = "Respondido";
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta.startsWith("/api/radicados?")) return Promise.resolve(paginaRadicados(radicados, ruta));
      if (ruta.endsWith("/respuesta")) return Promise.resolve(respuestaJson({ respuesta: {
        contenido: "Respuesta", documentos: [
          { id: 1, ruta_archivo: "uno.pdf" }, { id: 2, ruta_archivo: "dos.pdf" },
        ],
      } }));
      if (ruta === "/uploads/uno.pdf") return Promise.resolve({ blob: async () => new Blob(["uno"]) });
      if (ruta === "/uploads/dos.pdf") return segunda.promise;
      return base(ruta, opciones);
    });
    simularUrlsBlob("blob:parcial");
    await abrirConsulta();
    prepararDialogos();
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    fireEvent.click(within(fila).getByRole("button", { name: "Ver respuesta" }));
    await waitFor(() => expect(solicitarApi).toHaveBeenCalledWith("/uploads/dos.pdf"));
    const modal = document.querySelector(".respuesta-dialog");
    fireEvent.click(within(modal).getAllByRole("button", { name: "Cerrar", exact: true })[0]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:parcial");
    await act(async () => segunda.resolve({ blob: async () => new Blob(["dos"]) }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:parcial");
    expect(modal.open).toBe(false);
  });

  it.each(["publicada", "pendiente"])("limpia una descarga de respuesta %s al desmontar", async (estado) => {
    const descarga = diferida();
    const base = solicitarApi.getMockImplementation();
    const radicados = crearRadicados();
    radicados[0].estado = "Respondido";
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta.startsWith("/api/radicados?")) return Promise.resolve(paginaRadicados(radicados, ruta));
      if (ruta.endsWith("/respuesta")) return Promise.resolve(respuestaJson({ respuesta: {
        contenido: "Respuesta", documentos: [{ id: 1, nombre_archivo: "respuesta.pdf", ruta_archivo: "respuesta.pdf" }],
      } }));
      if (ruta === "/uploads/respuesta.pdf") return descarga.promise;
      return base(ruta, opciones);
    });
    simularUrlsBlob("blob:publicado");
    const vista = await abrirConsulta();
    prepararDialogos();
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    await act(async () => fireEvent.click(within(fila).getByRole("button", { name: "Ver respuesta" })));
    const consulta = within(document.querySelector(".respuesta-dialog"));
    if (estado === "publicada") {
      await act(async () => descarga.resolve({ blob: async () => new Blob(["PDF"]) }));
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      expect(consulta.getByRole("link", { name: "respuesta.pdf" }).getAttribute("href")).toBe("blob:publicado");
      vista.unmount();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:publicado");
    } else {
      expect(solicitarApi).toHaveBeenCalledWith("/uploads/respuesta.pdf");
      vista.unmount();
      await act(async () => descarga.resolve({ blob: async () => new Blob(["tardio"]) }));
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    }
  });

  it("bloquea cierre, Escape y doble envio; conserva borrador tras fallo y permite reintentar", async () => {
    const peticion = diferida();
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (opciones?.method === "POST") return peticion.promise;
      return base(ruta, opciones);
    });
    const user = userEvent.setup({ delay: null });
    await abrirRespuesta();
    prepararDialogos();
    const modal = document.querySelector(".respuesta-dialog");
    const cerrar = within(modal.querySelector(".modal-header")).getByRole("button", { name: "Cerrar" });
    const cancelar = within(modal.querySelector(".modal-footer")).getByRole("button", { name: "Cancelar" });
    const plantilla = within(modal).getByLabelText("Plantilla institucional");
    fireEvent.change(plantilla, { target: { value: "general" } });
    const contenido = within(modal).getByLabelText("Contenido de la respuesta *");
    const texto = contenido.value;
    const adjunto = within(modal).getByLabelText(/Documentos de respuesta/);
    await user.upload(adjunto, crearPdf("conservar.pdf", 100));
    const formulario = modal.querySelector("form");
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    const posts = () => solicitarApi.mock.calls.filter(([, opciones]) => opciones?.method === "POST");
    expect(posts()).toHaveLength(1);
    expect(cerrar.disabled).toBe(true);
    expect(cancelar.disabled).toBe(true);
    expect(plantilla.disabled).toBe(true);
    expect(contenido.disabled).toBe(true);
    expect(adjunto.disabled).toBe(true);
    expect(fireEvent(modal, new Event("cancel", { cancelable: true }))).toBe(false);
    expect(modal.open).toBe(true);
    await act(async () => peticion.reject(new Error("Fallo al guardar")));
    expect(within(modal).getByText("Fallo al guardar")).toBeTruthy();
    expect(contenido.value).toBe(texto);
    expect(plantilla.value).toBe("general");
    expect(within(modal).getByText(/conservar.pdf/)).toBeTruthy();
    expect(cancelar.isConnected && !cancelar.disabled).toBe(true);
    const baseConsulta = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (opciones?.method === "POST") {
        Object.assign(registrosSimulados[0], { estado: "Respondido", semaforo: { nivel: "completado" } });
        return Promise.resolve({ ok: true, json: async () => ({
          success: true, estado: "Respondido", semaforo: { nivel: "completado" },
        }) });
      }
      if (ruta.endsWith("/respuesta")) return Promise.resolve(respuestaJson({
        respuesta: { contenido: "Respuesta guardada tras reintento", documentos: [] },
      }));
      return baseConsulta(ruta, opciones);
    });
    fireEvent.submit(formulario);
    await within(modal).findByText(/Respuesta guardada correctamente/);
    expect(modal.open).toBe(true);
    expect(posts()).toHaveLength(2);
    expect(posts()[1][1].body.getAll("archivos")[0].name).toBe("conservar.pdf");
    const fila = (await screen.findByText("RAD-001", { selector: "button" })).closest("tr");
    expect(within(fila).getByRole("button", { name: "Ver respuesta" })).toBeTruthy();
  });

  it.each([
    { tipo: "Externa", global: false, pdf: true },
    { tipo: "Externa", global: true, pdf: false },
    { tipo: "Interna", global: false, pdf: false },
  ])("conserva el modal y muestra la respuesta confirmada: $tipo global=$global PDF=$pdf", async ({ tipo, global, pdf }) => {
    if (tipo === "Interna") confirmarSesion.mockResolvedValue({
      ...usuario, rol: "funcionario", dependencia_id: 3,
    });
    Object.assign(registrosSimulados[0], {
      tipo_comunicacion: tipo, destino_todas_dependencias: global ? 1 : 0,
      radicado_dependencia_id: global ? 301 : null,
    });
    const base = solicitarApi.getMockImplementation();
    const respuesta = {
      id: 20, funcionario_nombre: "Autor confirmado", dependencia_responsable: "Oficina confirmada",
      contenido: "Contenido confirmado por el servidor", fecha_envio: "2026-11-06 15:00:00",
      documentos: pdf ? [{ id: 1, nombre_archivo: "confirmado.pdf", ruta_archivo: "confirmado.pdf", tamano_bytes: 32 }] : [],
    };
    const post = diferida();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (opciones?.method === "POST") return post.promise;
      if (ruta.includes("/respuesta")) return Promise.resolve(respuestaJson({ success: true, respuesta }));
      if (ruta === "/uploads/confirmado.pdf") return Promise.resolve({ blob: async () => new Blob(["PDF"]) });
      return base(ruta, opciones);
    });
    simularUrlsBlob("blob:confirmado");
    await abrirRespuesta();
    prepararDialogos();
    const modal = document.querySelector(".respuesta-dialog");
    fireEvent.change(within(modal).getByLabelText("Plantilla institucional"), { target: { value: "general" } });
    const formulario = modal.querySelector("form");
    fireEvent.submit(formulario);
    fireEvent.submit(formulario);
    expect(solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
    await act(async () => {
      Object.assign(registrosSimulados[0], { estado: "Respondido" });
      post.resolve({ ok: true, json: async () => ({ success: true, estado: "Respondido" }) });
    });
    await within(modal).findByText("Contenido confirmado por el servidor");
    expect(modal.open).toBe(true);
    expect(modal.close).not.toHaveBeenCalled();
    expect(within(modal).getByText(/Respuesta guardada correctamente/)).toBeTruthy();
    expect(within(modal).getByText("Autor confirmado")).toBeTruthy();
    expect(within(modal).queryByRole("button", { name: "Enviar respuesta" })).toBeNull();
    expect(within(modal).queryByText(/Esto no acredita/)!==null).toBe(tipo === "Externa");
    expect(document.activeElement).toBe(within(modal).getByRole("heading", { level: 2 }));
    expect(solicitarApi).toHaveBeenCalledWith(
      `/api/radicados/RAD-001/respuesta${global ? "?radicado_dependencia_id=301" : ""}`,
    );
    if (global) {
      const envio = solicitarApi.mock.calls.find(([, o]) => o?.method === "POST");
      expect(envio[1].body.get("radicado_dependencia_id")).toBe("301");
    }
    if (pdf) expect(within(modal).getByRole("link", { name: "confirmado.pdf" }).getAttribute("href")).toBe("blob:confirmado");
    else expect(within(modal).getByText("La respuesta no tiene PDF adjuntos.")).toBeTruthy();
    fireEvent.click(within(modal).getAllByRole("button", { name: "Cerrar" })[0]);
    if (pdf) expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:confirmado");
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    fireEvent.click(within(fila).getByRole("button", { name: "Ver respuesta" }));
    await within(modal).findByText("Contenido confirmado por el servidor");
    expect(within(modal).queryByText(/Respuesta guardada correctamente/)).toBeNull();
  });

  it.each(["consulta", "PDF"])("mantiene guardado confirmado si falla %s y reintenta solo lectura", async (fallo) => {
    let fallar = true;
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (opciones?.method === "POST") return Promise.resolve({ ok: true, json: async () => ({ success: true, estado: "Respondido" }) });
      if (ruta.endsWith("/respuesta")) {
        if (fallar && fallo === "consulta") return Promise.reject(new Error("Fallo ficticio de consulta"));
        return Promise.resolve(respuestaJson({ respuesta: {
          contenido: "Respuesta recuperada", documentos: [
            { id: 1, nombre_archivo: "uno.pdf", ruta_archivo: "uno.pdf", tamano_bytes: 32 },
            { id: 2, nombre_archivo: "dos.pdf", ruta_archivo: "dos.pdf", tamano_bytes: 32 },
          ],
        } }));
      }
      if (ruta.startsWith("/uploads/")) {
        if (fallar && ruta.endsWith("dos.pdf")) return Promise.reject(new Error("Fallo ficticio de PDF"));
        return Promise.resolve({ blob: async () => new Blob(["PDF"]) });
      }
      return base(ruta, opciones);
    });
    simularUrlsBlob("blob:recuperado");
    await abrirRespuesta(); prepararDialogos();
    const modal = document.querySelector(".respuesta-dialog");
    fireEvent.change(within(modal).getByLabelText("Plantilla institucional"), { target: { value: "general" } });
    fireEvent.submit(modal.querySelector("form"));
    expect(await within(modal).findByRole("alert")).toBeTruthy();
    expect(modal.open).toBe(true);
    expect(within(modal).getByText(/Respuesta guardada correctamente/)).toBeTruthy();
    expect(within(modal).queryByText("La respuesta no tiene PDF adjuntos.")).toBeNull();
    expect(within(modal).queryByRole("button", { name: "Enviar respuesta" })).toBeNull();
    if (fallo === "PDF") expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:recuperado");
    fallar = false;
    fireEvent.click(within(modal).getByRole("button", { name: "Reintentar consulta de respuesta" }));
    await within(modal).findByText("Respuesta recuperada");
    expect(within(modal).getAllByRole("link")).toHaveLength(2);
    expect(within(modal).queryByRole("alert")).toBeNull();
    expect(within(modal).getByText(/Respuesta guardada correctamente/)).toBeTruthy();
    expect(solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
  });

  it.each(["cerrar", "permiso", "PDF tardío"])("protege la consulta posterior al guardar ante %s", async (accion) => {
    const lectura = diferida();
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (opciones?.method === "POST") return Promise.resolve({ ok: true, json: async () => ({ success: true, estado: "Respondido" }) });
      if (ruta.endsWith("/respuesta")) return accion === "PDF tardío"
        ? Promise.resolve(respuestaJson({ respuesta: { contenido: "Respuesta con descarga pendiente",
          documentos: [{ id: 1, nombre_archivo: "tardio.pdf", ruta_archivo: "tardio.pdf" }] } }))
        : lectura.promise;
      if (ruta === "/uploads/tardio.pdf") return lectura.promise;
      return base(ruta, opciones);
    });
    const alertar = simularAlerta();
    simularUrlsBlob("blob:tardio");
    await abrirRespuesta(); prepararDialogos();
    const modal = document.querySelector(".respuesta-dialog");
    fireEvent.change(within(modal).getByLabelText("Plantilla institucional"), { target: { value: "general" } });
    fireEvent.submit(modal.querySelector("form"));
    await within(modal).findByText(/Respuesta guardada correctamente/);
    if (accion === "cerrar" || accion === "PDF tardío") {
      if (accion === "PDF tardío") await waitFor(() =>
        expect(solicitarApi).toHaveBeenCalledWith("/uploads/tardio.pdf"));
      fireEvent(modal, new Event("cancel", { cancelable: true }));
      await act(async () => lectura.resolve(accion === "PDF tardío"
        ? { blob: async () => new Blob(["PDF tardío"]) }
        : respuestaJson({ respuesta: { contenido: "No reaparecer", documentos: [] } })));
      expect(within(modal).queryByText("No reaparecer")).toBeNull();
      expect(alertar).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    } else {
      await act(async () => lectura.reject(Object.assign(new Error("Acceso retirado"), { status: 403 })));
      expect(alertar).toHaveBeenCalledWith(expect.stringContaining("Acceso retirado"));
    }
    expect(modal.open).toBe(false);
    expect(solicitarApi.mock.calls.filter(([, o]) => o?.method === "POST")).toHaveLength(1);
  });

  it("usa recepcion Bogota en contador, filtro y detalle sin ocultar invalidos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-02T04:30:00Z"));
    try {
      const radicados = crearRadicados();
      Object.assign(radicados[0], { fecha_hora_recepcion: "2026-01-01 23:30:00", fecha_creacion: "2026-01-02 10:00:00" });
      Object.assign(radicados[1], { fecha_creacion: "2026-01-01T23:30:00-05:00" });
      Object.assign(radicados[2], { fecha_hora_recepcion: "2026-02-30", fecha_creacion: "2026-01-01 10:00:00" });
      const base = solicitarApi.getMockImplementation();
      solicitarApi.mockImplementation((ruta, opciones) => {
        if (ruta.startsWith("/api/radicados?")) return Promise.resolve(paginaRadicados(radicados, ruta));
        if (ruta.endsWith("/documentos")) return Promise.resolve(respuestaJson({ documentos: [] }));
        return base(ruta, opciones);
      });
      await abrirConsulta();
      prepararDialogos();
      const hoy = within(screen.getByLabelText("Resumen y filtros")).getByRole("button", { name: /Registrados hoy/ });
      expect(hoy.querySelector("strong").textContent).toBe("2");
      await act(async () => fireEvent.click(hoy));
      expect(screen.getByText("RAD-001", { selector: "button" })).toBeTruthy();
      expect(screen.getByText("RAD-002", { selector: "button" })).toBeTruthy();
      expect(screen.queryByText("RAD-003", { selector: "button" })).toBeNull();
      await act(async () => fireEvent.click(hoy));
      const boton = screen.getByText("RAD-001", { selector: "button" });
      expect(boton.closest("tr").querySelector("td:nth-child(2) small").textContent)
        .toBe(formatearFechaRadicacion(radicados[0]));
      fireEvent.click(boton);
      await screen.findByText("Este radicado no tiene documentos adjuntos.");
      const detalle = document.querySelector("#modal-detalle");
      expect(within(detalle).getByText("Fecha de radicación").closest(".modal-field").querySelector("p").textContent)
        .toBe(formatearFechaRadicacion(radicados[0]));
      fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar" }));
      const filaInvalida = screen.getByText("RAD-003", { selector: "button" }).closest("tr");
      expect(within(filaInvalida).getByText("Fecha no válida")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("genera comprobante con recepcion y rechaza fechas invalidas aunque exista creacion", async () => {
    const radicados = crearRadicados();
    Object.assign(radicados[0], { fecha_hora_recepcion: "2026-01-01 23:30:00", fecha_creacion: "2026-01-02 10:00:00" });
    Object.assign(radicados[2], { fecha_hora_recepcion: "2026-02-30", fecha_creacion: "2026-01-01 10:00:00" });
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => ruta.startsWith("/api/radicados?")
      ? Promise.resolve(paginaRadicados(radicados, ruta)) : base(ruta, opciones));
    crearPdfComprobante.mockResolvedValue({ output: () => new Blob(["PDF"]) });
    simularUrlsBlob("blob:fecha");
    const alertar = simularAlerta();
    await abrirConsulta();
    prepararDialogos();
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    await act(async () => fireEvent.click(within(fila).getByRole("button", { name: "Ver comprobante" })));
    expect(crearPdfComprobante).toHaveBeenCalledWith(expect.objectContaining({
      fecha_hora: formatearFechaRadicacion(radicados[0]),
    }));
    const recibo = document.querySelector(".receipt-dialog");
    expect(recibo.open).toBe(true);
    fireEvent.click(within(recibo).getByRole("button", { name: "Cerrar" }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fecha");
    const filaInvalida = screen.getByText("RAD-003", { selector: "button" }).closest("tr");
    fireEvent.click(within(filaInvalida).getByRole("button", { name: "Ver comprobante" }));
    expect(alertar).toHaveBeenCalledWith(expect.stringContaining("no tiene fecha válida"));
    expect(crearPdfComprobante).toHaveBeenCalledTimes(1);
  });

  it("combina filtros, permite quitarlos por badge y reinicia todo con Total", async () => {
    const user = userEvent.setup({ delay: null });
    await abrirConsulta();
    const resumen = within(screen.getByLabelText("Resumen y filtros"));
    const registradosHoy = resumen.getByRole("button", { name: /Registrados hoy/ });
    const criticos = resumen.getByRole("button", { name: /Críticos/ });
    const total = resumen.getByRole("button", { name: /Total/ });

    await user.click(registradosHoy);
    expect(screen.getByText("RAD-001", { selector: "button" })).toBeTruthy();
    expect(screen.queryByText("RAD-002", { selector: "button" })).toBeNull();
    expect(screen.getByText("RAD-003", { selector: "button" })).toBeTruthy();
    expect(
      screen.getByText("Mostrando 2 de 3. Hay filtros activos."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Quitar filtro Fecha: hoy")).toBeTruthy();
    await user.click(registradosHoy);

    await user.click(screen.getByLabelText("Buscar radicados"));
    await user.paste("garcia");
    await user.selectOptions(
      screen.getByLabelText("Tipo de comunicación"),
      "externa",
    );
    await user.click(criticos);

    expect(screen.getByText("RAD-001", { selector: "button" })).toBeTruthy();
    expect(screen.queryByText("RAD-002", { selector: "button" })).toBeNull();
    expect(screen.queryByText("RAD-003", { selector: "button" })).toBeNull();
    expect(
      screen.getByText("Mostrando 1 de 3. Hay filtros activos."),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Quitar filtro Críticos: alerta y vencido"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Quitar filtro Tipo: Externa")).toBeTruthy();
    expect(screen.getByLabelText("Quitar filtro Búsqueda: garcia")).toBeTruthy();

    await user.click(
      screen.getByLabelText("Quitar filtro Búsqueda: garcia"),
    );
    expect(screen.getByText("RAD-001", { selector: "button" })).toBeTruthy();
    expect(screen.queryByText("RAD-003", { selector: "button" })).toBeNull();

    await user.click(total);

    expect(screen.getByText("RAD-001", { selector: "button" })).toBeTruthy();
    expect(screen.getByText("RAD-002", { selector: "button" })).toBeTruthy();
    expect(screen.getByText("RAD-003", { selector: "button" })).toBeTruthy();
    expect(
      screen.getByText("Mostrando 3 de 3. Sin filtros activos."),
    ).toBeTruthy();
  });

  it("pagina en servidor, conserva contadores globales y reinicia pagina al filtrar", async () => {
    const filas = Array.from({ length: 53 }, (_, i) => ({
      ...crearRadicados()[0], numero_radicado: `RAD-${String(i + 1).padStart(3, "0")}`,
      remitente_nombre: i === 52 ? "Remitente final" : "Otra persona",
    }));
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => ruta.startsWith("/api/radicados?")
      ? Promise.resolve(paginaRadicados(filas, ruta)) : base(ruta, opciones));
    await abrirConsulta();
    const navegacion = within(screen.getByRole("navigation", { name: "Paginación de radicados" }));
    expect(screen.getByText("Página 1 de 3")).toBeTruthy();
    expect(within(screen.getByLabelText("Resumen y filtros")).getByRole("button", { name: /Total/ }).textContent).toContain("53");
    expect(screen.queryByText("RAD-026", { selector: "button" })).toBeNull();
    await act(async () => fireEvent.click(navegacion.getByRole("button", { name: "Siguiente" })));
    expect(screen.getByText("RAD-026", { selector: "button" })).toBeTruthy();
    expect(screen.queryByText("RAD-001", { selector: "button" })).toBeNull();
    expect(screen.getByText("Página 2 de 3")).toBeTruthy();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByLabelText("Buscar radicados"));
    await user.paste("final");
    expect(await screen.findByText("RAD-053", { selector: "button" })).toBeTruthy();
    expect(navegacion.getByText("Página 1 de 1")).toBeTruthy();
    expect(navegacion.getByRole("button", { name: "Siguiente" }).disabled).toBe(true);
    expect(solicitarApi.mock.calls.some(([ruta]) => ruta.includes("pagina=1") && ruta.includes("busqueda=final"))).toBe(true);
  });

  it("descarta una consulta tardia cuando se cambian los filtros", async () => {
    const pendiente = diferida();
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) =>
      ruta.startsWith("/api/radicados?") && ruta.includes("criticos=1")
        ? pendiente.promise : base(ruta, opciones));
    await abrirConsulta();
    const resumen = within(screen.getByLabelText("Resumen y filtros"));
    fireEvent.click(resumen.getByRole("button", { name: /Críticos/ }));
    await act(async () => fireEvent.click(resumen.getByRole("button", { name: /Total/ })));
    await act(async () => pendiente.resolve(respuestaJson({ success: false, message: "Resultado obsoleto" })));
    expect(screen.getByText("RAD-002", { selector: "button" })).toBeTruthy();
    expect(screen.queryByText(/Resultado obsoleto/)).toBeNull();
  });

  it("muestra error de contrato sin inventar totales y permite reintentar", async () => {
    const base = solicitarApi.getMockImplementation();
    let fallo = true;
    solicitarApi.mockImplementation((ruta, opciones) =>
      ruta.startsWith("/api/radicados?") && fallo
        ? Promise.resolve(respuestaJson({ success: true, radicados: [] })) : base(ruta, opciones));
    render(<PaginaConsultaRadicados />);
    const boton = await screen.findByRole("button", { name: "Reintentar consulta" });
    fallo = false;
    await act(async () => fireEvent.click(boton));
    expect(screen.getByText("RAD-001", { selector: "button" })).toBeTruthy();
  });

  it("pagina alertas y no muestra resultados tardios de otra dependencia", async () => {
    const base = solicitarApi.getMockImplementation();
    const pendiente = diferida();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta === "/api/dependencias") return Promise.resolve(respuestaJson({ success: true,
        dependencias: [{ id: 3, nombre: "Gobierno" }, { id: 4, nombre: "Planeación" }] }));
      if (ruta.startsWith("/api/alertas?")) {
        if (ruta.includes("dependencia_id=4")) return pendiente.promise;
        const pagina = Number(new URLSearchParams(ruta.split("?")[1]).get("pagina"));
        return Promise.resolve(respuestaJson({ success: true, total: 26, paginas: 2,
          alertas: [{ ...crearRadicados()[0], numero_radicado: pagina === 1 ? "ALERTA-1" : "ALERTA-26" }] }));
      }
      return base(ruta, opciones);
    });
    await abrirConsulta();
    await act(async () => fireEvent.change(screen.getByLabelText("Dependencia"), { target: { value: "3" } }));
    expect(screen.getByText(/26 alertas encontradas/)).toBeTruthy();
    const navegacion = within(screen.getByRole("navigation", { name: "Paginación de alertas" }));
    await act(async () => fireEvent.click(navegacion.getByRole("button", { name: "Siguientes" })));
    expect(screen.getByText(/ALERTA-26/)).toBeTruthy();
    await act(async () => fireEvent.change(screen.getByLabelText("Dependencia"), { target: { value: "4" } }));
    expect(screen.queryByText(/ALERTA-26/)).toBeNull();
    await act(async () => fireEvent.change(screen.getByLabelText("Dependencia"), { target: { value: "3" } }));
    await act(async () => pendiente.resolve(respuestaJson({ success: true, total: 1, paginas: 1,
      alertas: [{ ...crearRadicados()[0], numero_radicado: "ALERTA-AJENA" }] })));
    expect(screen.queryByText(/ALERTA-AJENA/)).toBeNull();
    expect(screen.getByText(/ALERTA-1/)).toBeTruthy();
  });

  it("envía un cambio de estado y muestra el estado confirmado por el servidor", async () => {
    const user = userEvent.setup({ delay: null });
    await abrirConsulta();
    const selectorEstado = screen.getByRole("combobox", {
      name: "Estado de RAD-001",
    });

    await user.selectOptions(selectorEstado, "En trámite");

    await waitFor(() => expect(selectorEstado.value).toBe("En trámite"));
    expect(solicitarApi).toHaveBeenCalledWith("/api/radicados/RAD-001/estado", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "En trámite", radicado_dependencia_id: null }),
    });
  });

  it("revierte el estado y muestra el error si el servidor rechaza el cambio", async () => {
    const alertar = simularAlerta();
    solicitarApi.mockImplementation(async (ruta, opciones = {}) => {
      if (ruta.startsWith("/api/radicados?") && !opciones.method) {
        return paginaRadicados(crearRadicados(), ruta);
      }
      if (ruta === "/api/dependencias") {
        return respuestaJson({ success: true, dependencias: [] });
      }
      if (ruta.startsWith("/api/radicados/") && opciones.method === "PUT") {
        throw new Error("No se pudo guardar el estado.");
      }
      throw new Error(`Ruta inesperada: ${ruta}`);
    });
    const user = userEvent.setup({ delay: null });
    await abrirConsulta();
    const selectorEstado = screen.getByRole("combobox", {
      name: "Estado de RAD-001",
    });

    await user.selectOptions(selectorEstado, "En trámite");

    await waitFor(() => expect(selectorEstado.value).toBe("Recibido"));
    expect(alertar).toHaveBeenCalledWith("No se pudo guardar el estado.");
  });

  it("ofrece Enterado sin Responder ni Respondido y bloquea el cierre confirmado", async () => {
    const filas = crearRadicados();
    Object.assign(filas[0], { requiere_respuesta: 0, semaforo: { nivel: "sin_respuesta", texto: "No requiere respuesta" } });
    let confirmar;
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones = {}) => {
      if (ruta.startsWith("/api/radicados?")) return paginaRadicados(filas, ruta);
      if (ruta.endsWith("/estado")) return new Promise(resolve => { confirmar = resolve; });
      return base(ruta, opciones);
    });
    await abrirConsulta();
    const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
    const selector = within(fila).getByLabelText("Estado de RAD-001");
    expect(Array.from(selector.options).map(o => o.value)).toEqual(["Recibido", "En trámite", "Pendiente", "Enterado"]);
    expect(within(fila).queryByRole("button", { name: "Responder" })).toBeNull();
    fireEvent.change(selector, { target: { value: "Enterado" } });
    expect(selector.disabled).toBe(true);
    expect(within(fila).getByText("Guardando estado…")).toBeTruthy();
    Object.assign(filas[0], { estado: "Enterado", semaforo: { nivel: "completado", texto: "Enterado" } });
    confirmar(respuestaJson({ success: true, estado: "Enterado",
      fecha_enterado: "2026-10-21 15:30:00", semaforo: { nivel: "completado", texto: "Enterado" } }));
    await waitFor(() => expect(within(fila).queryByRole("combobox")).toBeNull());
    expect(within(fila).getByLabelText("Estado de RAD-001: Enterado")).toBeTruthy();
    expect(within(fila).queryByRole("button", { name: "Ver respuesta" })).toBeNull();
  });

  it("mantiene Respondido final y no ofrece cierre Enterado para una solicitud", async () => {
    const filas = crearRadicados();
    filas[1].estado = "Respondido";
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => ruta.startsWith("/api/radicados?")
      ? paginaRadicados(filas, ruta) : base(ruta, opciones));
    await abrirConsulta();
    const selector = screen.getByLabelText("Estado de RAD-001");
    expect(Array.from(selector.options).map(o => o.value)).toEqual(["Recibido", "En trámite", "Pendiente"]);
    expect(screen.getByLabelText("Estado de RAD-002: Respondido")).toBeTruthy();
  });

  it("confirma Enterado solo para la asignación global seleccionada", async () => {
    const filas = crearRadicados();
    const global = { ...filas[0], requiere_respuesta: 0, destino_todas_dependencias: 1 };
    const asignaciones = [
      { ...global, radicado_dependencia_id: 50, seguimiento_dependencia_nombre: "Planeación" },
      { ...global, radicado_dependencia_id: 51, seguimiento_dependencia_nombre: "Talento Humano" },
    ];
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => ruta.startsWith("/api/radicados?")
      ? paginaRadicados([...asignaciones, ...filas.slice(1)], ruta) : base(ruta, opciones));
    render(<PaginaConsultaRadicados />);
    const botones = await screen.findAllByText("RAD-001", { selector: "button" });
    const primera = botones[0].closest("tr");
    const segunda = botones[1].closest("tr");
    fireEvent.change(within(primera).getByRole("combobox"), { target: { value: "Enterado" } });
    await waitFor(() => expect(within(primera).queryByRole("combobox")).toBeNull());
    expect(within(segunda).getByRole("combobox").value).toBe("Recibido");
    const llamada = solicitarApi.mock.calls.find(([ruta, opciones]) =>
      ruta.endsWith("/estado") && opciones.method === "PUT");
    expect(JSON.parse(llamada[1].body)).toEqual({ estado: "Enterado", radicado_dependencia_id: 50 });
  });
});
