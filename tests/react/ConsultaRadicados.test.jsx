import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaginaConsultaRadicados } from "../../src/paginas/ConsultaRadicados.jsx";
import { confirmarSesion, solicitarApi } from "../../src/servicios/api.js";
import { crearPdfComprobante } from "../../src/servicios/comprobante.js";

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

async function abrirConsulta() {
  render(<PaginaConsultaRadicados />);
  await screen.findByText("RAD-001", { selector: "button" });
  await screen.findByText("RAD-002", { selector: "button" });
  await screen.findByText("RAD-003", { selector: "button" });
}

async function abrirRespuesta(user) {
  await abrirConsulta();
  const dialogo = document.querySelector(".respuesta-dialog");
  dialogo.showModal = vi.fn(() => dialogo.setAttribute("open", ""));
  dialogo.close = vi.fn(() => {
    dialogo.removeAttribute("open");
  });
  const fila = screen.getByText("RAD-001", { selector: "button" }).closest("tr");
  await user.click(within(fila).getByRole("button", { name: "Responder" }));
  return screen.findByLabelText(/Documentos de respuesta/);
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
    confirmarSesion.mockReset().mockResolvedValue(usuario);
    solicitarApi.mockReset().mockImplementation(async (ruta, opciones = {}) => {
      if (ruta === "/api/radicados" && !opciones.method) {
        return respuestaJson({ success: true, radicados: crearRadicados() });
      }
      if (ruta === "/api/dependencias") {
        return respuestaJson({
          success: true,
          dependencias: [{ id: 3, nombre: "Secretaría de Gobierno" }],
        });
      }
      if (ruta.startsWith("/api/radicados/") && opciones.method === "PUT") {
        const { estado } = JSON.parse(opciones.body);
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
      if (ruta === "/api/radicados") return respuestaJson({ success: true, radicados });
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
    const user = userEvent.setup({ delay: null });
    await abrirConsulta();
    document.querySelectorAll("dialog").forEach((dialogo) => {
      dialogo.showModal = vi.fn(() => dialogo.setAttribute("open", ""));
      dialogo.close = vi.fn(() => {
        dialogo.removeAttribute("open");
        fireEvent(dialogo, new Event("close"));
      });
    });
    const boton = screen.getByText("RAD-001", { selector: "button" });
    await user.click(boton);
    await screen.findByText("Este radicado no tiene documentos adjuntos.");
    const detalle = document.querySelector("#modal-detalle");
    expect(within(detalle).queryByText("Respuesta institucional")).toBeNull();
    expect(within(detalle).queryByText("Dependencia responsable")).toBeNull();
    expect(within(detalle).getByText("Estado")).toBeTruthy();
    expect(solicitarApi.mock.calls.some(([ruta]) => ruta.startsWith("/uploads/") || ruta.endsWith("/respuesta"))).toBe(false);
    expect(solicitarApi.mock.calls.some(([ruta]) => ruta.includes("/respuesta/resumen"))).toBe(false);
    detalle.close();
    await user.click(within(boton.closest("tr")).getByRole("button", { name: "Ver respuesta" }));
    const modalRespuesta = document.querySelector(".respuesta-dialog");
    expect(await within(modalRespuesta).findByText("Brandon Grajales")).toBeTruthy();
    expect(within(modalRespuesta).getByText("Talento Humano")).toBeTruthy();
    expect(within(modalRespuesta).getByText("Fecha de envío").closest(".modal-field").textContent).toContain("2026");
    expect(within(modalRespuesta).getByText("Respuesta oficial registrada")).toBeTruthy();
    expect(within(modalRespuesta).getByRole("link", { name: "respuesta.pdf" }).getAttribute("href")).toBe("blob:respuesta");
    expect(within(modalRespuesta).getAllByText("Respondida por")).toHaveLength(1);
    expect(solicitarApi).toHaveBeenCalledWith("/uploads/respuestas/archivo.pdf");
  });

  it.each(["Planeación", null])("consulta la respuesta global seleccionada y muestra dependencia %s", async (dependencia) => {
    const radicados = crearRadicados();
    Object.assign(radicados[0], { estado: "Respondido", destino_todas_dependencias: 1, radicado_dependencia_id: 301 });
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta === "/api/radicados") return respuestaJson({ success: true, radicados });
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
      if (ruta === "/api/radicados") return respuestaJson({ success: true, radicados });
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

  it("presenta clasificación jurídica y contacto de una externa", async () => {
    const radicados = crearRadicados();
    Object.assign(radicados[0], {
      remitente_tipo_persona: "juridica", remitente_entidad: "Empresa registrada",
      remitente_nit: "900123456", remitente_email: "empresa@example.com",
    });
    const catalogos = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta === "/api/radicados") return respuestaJson({ success: true, radicados });
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
    const selector = await abrirRespuesta(user);

    await user.upload(selector, crearPdf("excedido.pdf", 10 * 1024 * 1024 + 1));

    const alerta = screen.getByRole("alert");
    expect(alerta.textContent).toContain("excedido.pdf");
    expect(alerta.textContent).toContain("10485761 bytes");
    expect(alerta.textContent).toContain("10 MB");
    expect(alerta.closest(".modal-content")).toBeNull();
    expect(selector.getAttribute("aria-invalid")).toBe("true");
    expect(selector.getAttribute("aria-describedby")).toContain(alerta.id);
    expect(screen.queryByRole("list", { name: "Archivos seleccionados" })).toBeNull();
  });

  it("conserva y envía los PDFs anteriores al rechazar una selección nueva", async () => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta(user);
    const valido = crearPdf("anterior.pdf", 32);
    await user.selectOptions(screen.getByLabelText("Plantilla institucional"), "general");
    await user.upload(selector, valido);
    await user.upload(selector, crearPdf("excedido.pdf", 10 * 1024 * 1024 + 1));

    expect(screen.getByRole("alert").textContent).toContain("Se conservan");
    expect(within(screen.getByRole("list", { name: "Archivos seleccionados" })).getByText(/anterior.pdf/)).toBeTruthy();
    expect(screen.getByLabelText("Plantilla institucional").value).toBe("general");
    expect(screen.getByLabelText(/Contenido de la respuesta/).value).toContain("En atención");

    const original = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones = {}) => {
      if (opciones.method === "POST") {
        return { ok: true, json: async () => ({ success: true, estado: "Respondido" }) };
      }
      return original(ruta, opciones);
    });
    await user.click(screen.getByRole("button", { name: "Enviar respuesta" }));

    const envio = solicitarApi.mock.calls.find(([, opciones]) => opciones?.method === "POST");
    expect(envio[1].body.getAll("archivos")).toEqual([valido]);
    await waitFor(() => expect(screen.queryByLabelText(/Documentos de respuesta/)).toBeNull());
  });

  it("acepta exactamente 10 MB y limpia el error al reemplazar la selección", async () => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta(user);
    await user.upload(selector, crearPdf("excedido.pdf", 10 * 1024 * 1024 + 1));
    await user.upload(selector, crearPdf("limite.pdf", 10 * 1024 * 1024));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(selector.getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByText(/limite.pdf/)).toBeTruthy();
  });

  it("rechaza más de cinco PDFs y extensiones inválidas sin borrar los anteriores", async () => {
    const user = userEvent.setup({ applyAccept: false, delay: null });
    const selector = await abrirRespuesta(user);
    await user.upload(selector, crearPdf("anterior.pdf", 32));
    await user.upload(selector, Array.from({ length: 6 }, (_, i) => crearPdf(`${i}.pdf`, 32)));
    expect(screen.getByRole("alert").textContent).toContain("máximo 5");
    await user.upload(selector, new File(["texto"], "invalido.txt", { type: "text/plain" }));
    expect(screen.getByRole("alert").textContent).toContain("invalido.txt");
    expect(screen.getByText(/anterior.pdf/)).toBeTruthy();
    fireEvent.change(selector, { target: { files: [] } });
    expect(screen.getByText(/anterior.pdf/)).toBeTruthy();
  });

  it("admite cinco PDFs, rechaza archivos vacíos y reinicia los adjuntos al reabrir", async () => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta(user);
    await user.upload(selector, Array.from({ length: 5 }, (_, i) => crearPdf(`${i}.pdf`, 32)));
    expect(within(screen.getByRole("list", { name: "Archivos seleccionados" })).getAllByRole("listitem")).toHaveLength(5);
    await user.upload(selector, crearPdf("vacio.pdf", 0));
    expect(screen.getByRole("alert").textContent).toContain("está vacío");
    expect(within(screen.getByRole("list", { name: "Archivos seleccionados" })).getAllByRole("listitem")).toHaveLength(5);

    const dialogo = document.querySelector(".respuesta-dialog");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent(dialogo, new Event("close"));
    await waitFor(() => expect(screen.queryByLabelText(/Documentos de respuesta/)).toBeNull());
    await user.click(screen.getAllByRole("button", { name: "Responder" })[0]);
    await screen.findByLabelText(/Documentos de respuesta/);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("list", { name: "Archivos seleccionados" })).toBeNull();
  });

  it.each([
    { errorServidor: "Cada PDF debe pesar máximo 10 MB.", conAdjunto: false },
    {
      errorServidor: "El archivo PDF está cifrado o protegido con contraseña y no se puede validar. Adjunta una copia sin protección, si tienes autorización para hacerlo.",
      conAdjunto: true,
    },
  ])("mantiene visible el rechazo del servidor: $errorServidor", async ({ errorServidor, conAdjunto }) => {
    const user = userEvent.setup({ delay: null });
    const selector = await abrirRespuesta(user);
    const adjuntos = conAdjunto ? [crearPdf("protegido.pdf", 32)] : [];
    if (conAdjunto) await user.upload(selector, adjuntos);
    await user.selectOptions(screen.getByLabelText("Plantilla institucional"), "general");
    const original = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones = {}) => {
      if (opciones.method === "POST") throw new Error(errorServidor);
      return original(ruta, opciones);
    });
    await user.click(screen.getByRole("button", { name: "Enviar respuesta" }));
    const mensaje = await screen.findByText(errorServidor);
    expect(mensaje.closest(".modal-content")).toBeNull();
    const envio = solicitarApi.mock.calls.find(([, opciones]) => opciones?.method === "POST");
    expect(envio[1].body.getAll("archivos")).toEqual(adjuntos);
    expect(screen.getByLabelText("Plantilla institucional").value).toBe("general");
    if (conAdjunto) expect(screen.getByText(/protegido.pdf/)).toBeTruthy();
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
      if (ruta === "/api/radicados" && !opciones.method) {
        return respuestaJson({ success: true, radicados: crearRadicados() });
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
      if (ruta === "/api/radicados") return respuestaJson({ success: true, radicados: filas });
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
    solicitarApi.mockImplementation(async (ruta, opciones) => ruta === "/api/radicados"
      ? respuestaJson({ success: true, radicados: filas }) : base(ruta, opciones));
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
    solicitarApi.mockImplementation(async (ruta, opciones) => ruta === "/api/radicados"
      ? respuestaJson({ success: true, radicados: [...asignaciones, ...filas.slice(1)] }) : base(ruta, opciones));
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
