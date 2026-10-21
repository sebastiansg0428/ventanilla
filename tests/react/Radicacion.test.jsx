import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaginaRadicacion } from "../../src/paginas/Radicacion.jsx";
import { confirmarSesion, solicitarApi } from "../../src/servicios/api.js";
import { crearPdfComprobante } from "../../src/servicios/comprobante.js";

vi.mock("../../src/servicios/api.js", () => ({
  confirmarSesion: vi.fn(),
  solicitarApi: vi.fn(),
}));

vi.mock("../../src/servicios/comprobante.js", () => ({
  crearPdfComprobante: vi.fn(),
}));

const usuario = { id: 7, nombre: "Ana Pérez", rol: "administrador" };

function prepararCatalogos() {
  solicitarApi.mockImplementation(async (ruta) => {
    const respuestas = {
      "/api/tipos-tramite": {
        tipos_tramite: [
          { id: 10, nombre: "Solicitud general", termino_legal_id: 22 },
        ],
      },
      "/api/dependencias": {
        dependencias: [{ id: 3, nombre: "Secretaría de Gobierno" }],
      },
      "/api/usuarios/ventanilla": {
        usuarios: [{ id: 8, nombre: "Luis Gómez" }],
      },
    };
    if (!respuestas[ruta]) throw new Error(`Ruta inesperada: ${ruta}`);
    return { json: async () => respuestas[ruta] };
  });
}

async function abrirRadicacion() {
  render(<PaginaRadicacion />);
  await screen.findByText("Solicitud general", { selector: "option" });
  await screen.findByText("Secretaría de Gobierno", { selector: "option" });
  await screen.findByText("Luis Gómez", { selector: "option" });
}

async function completarFormulario(user, destino = "3") {
  await user.selectOptions(
    screen.getByLabelText(/tipo de recepción/i),
    "Digital",
  );
  await user.selectOptions(
    screen.getByLabelText(/clase de comunicación/i),
    "Externa",
  );
  await user.selectOptions(screen.getByLabelText(/tipo de trámite/i), "10");
  await user.selectOptions(screen.getByLabelText(/tipo de persona/i), "natural");
  for (const [etiqueta, valor] of [
    [/nombre completo del remitente/i, "María Torres"],
    [/cédula/i, "12345678"],
    [/teléfono/i, "3001234567"],
    [/entidad \/ empresa/i, "Persona natural"],
    [/correo electrónico/i, "maria@example.com"],
  ]) {
    await user.click(screen.getByLabelText(etiqueta));
    await user.paste(valor);
  }
  await user.selectOptions(
    screen.getByLabelText(/dependencia de destino/i),
    destino,
  );
  await user.selectOptions(
    screen.getByLabelText(/funcionario \/ quién registra/i),
    "8",
  );
  await user.click(screen.getByLabelText(/asunto \/ resumen/i));
  await user.paste("Solicitud de información");
}

describe("radicación React", () => {
  let guardarPdf;

  beforeEach(() => {
    confirmarSesion.mockReset().mockResolvedValue(usuario);
    solicitarApi.mockReset();
    prepararCatalogos();
    guardarPdf = vi.fn();
    crearPdfComprobante.mockReset().mockReturnValue({ save: guardarPdf });
  });

  it("permite radicar tipo sin respuesta y sin término y usa la regla confirmada en el comprobante", async () => {
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta === "/api/tipos-tramite") return { json: async () => ({
        tipos_tramite: [{ id: 10, nombre: "Solicitud general", requiere_respuesta: 0, termino_legal_id: null }],
      }) };
      if (ruta === "/api/radicados") return { json: async () => ({
        success: true, radicado: "RAD-INFO", tipo_comunicacion: "Externa", requiere_respuesta: false, termino: null,
      }) };
      return base(ruta, opciones);
    });
    const user = userEvent.setup({ delay: null });
    await abrirRadicacion();
    await completarFormulario(user);
    expect(screen.getByText(/No requiere respuesta: el destino/)).toBeTruthy();
    await user.upload(screen.getByLabelText("Documentos PDF de soporte"),
      new File(["PDF"], "informativo.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Generar radicado y registrar" }));
    await screen.findByText(/Radicado RAD-INFO guardado/);
    expect(crearPdfComprobante).toHaveBeenCalledWith(expect.objectContaining({ requiere_respuesta: false }));
    const body = solicitarApi.mock.calls.find(([ruta]) => ruta === "/api/radicados")[1].body;
    expect(body.has("requiere_respuesta")).toBe(false);
  }, 10_000);

  it("muestra solo el origen interno y limpia selecciones incompatibles al cambiar de clase", async () => {
    await abrirRadicacion();
    const clase = screen.getByLabelText(/clase de comunicación/i);
    fireEvent.change(clase, { target: { value: "Interna" } });
    const origen = screen.getByLabelText(/dependencia remitente/i);
    expect(origen.required).toBe(true);
    expect(Array.from(origen.options).map((opcion) => opcion.value)).toEqual(["", "3"]);
    expect(screen.queryByLabelText(/tipo de persona/i)).toBeNull();
    expect(screen.getByLabelText(/correo electrónico/i).required).toBe(false);
    fireEvent.change(origen, { target: { value: "3" } });
    fireEvent.change(clase, { target: { value: "Externa" } });
    expect(screen.queryByLabelText(/dependencia remitente/i)).toBeNull();
    expect(screen.getByLabelText(/correo electrónico/i).required).toBe(true);
    fireEvent.change(screen.getByLabelText(/tipo de persona/i), { target: { value: "juridica" } });
    expect(screen.getByLabelText(/razón social/i).maxLength).toBe(150);
    expect(screen.getByLabelText(/nit de la entidad/i).required).toBe(true);
    fireEvent.change(clase, { target: { value: "Interna" } });
    expect(screen.getByLabelText(/dependencia remitente/i).value).toBe("");
    expect(screen.getByLabelText(/nit de la entidad/i).required).toBe(false);
    fireEvent.change(clase, { target: { value: "Externa" } });
    expect(screen.getByLabelText(/tipo de persona/i).value).toBe("");
  });

  it.each(["natural", "juridica"])("conserva entidad al alternar desde externa %s sin enviarla en interna y mantiene NIT opcional", async (persona) => {
    await abrirRadicacion();
    const clase = screen.getByLabelText(/clase de comunicación/i);
    fireEvent.change(clase, { target: { value: "Externa" } });
    fireEvent.change(screen.getByLabelText(/tipo de persona/i), { target: { value: persona } });
    const entidad = screen.getByLabelText(persona === "juridica" ? /razón social/i : /entidad \/ empresa/i);
    const nit = screen.getByLabelText(/nit de la entidad/i);
    fireEvent.change(entidad, { target: { value: "Entidad conservada" } });
    fireEvent.change(nit, { target: { value: "900123" } });
    expect(entidad.disabled).toBe(false);
    expect(entidad.required).toBe(true);
    fireEvent.change(clase, { target: { value: "Interna" } });
    expect(screen.getByLabelText(/entidad \/ empresa/i)).toBe(entidad);
    expect(entidad.disabled).toBe(true);
    expect(entidad.required).toBe(false);
    expect(entidad.labels[0].querySelector(".campo-obligatorio")).toBeNull();
    expect(entidad.value).toBe("Entidad conservada");
    expect(nit.disabled).toBe(false);
    expect(nit.required).toBe(false);
    const datosInternos = new FormData(entidad.form);
    expect(datosInternos.has("remitente_entidad")).toBe(false);
    expect(datosInternos.get("remitente_nit")).toBe("900123");
    fireEvent.change(clase, { target: { value: "Externa" } });
    fireEvent.change(screen.getByLabelText(/tipo de persona/i), { target: { value: persona } });
    expect(entidad.disabled).toBe(false);
    expect(entidad.required).toBe(true);
    expect(entidad.labels[0].querySelector(".campo-obligatorio")).not.toBeNull();
    expect(entidad.value).toBe("Entidad conservada");
    expect(nit.required).toBe(persona === "juridica");
    expect(new FormData(entidad.form).get("remitente_entidad")).toBe("Entidad conservada");
  });

  it.each([true, false])("envía origen interno y conserva los datos solo ante rechazo: éxito %s", async (exito) => {
    const catalogos = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta === "/api/radicados") return { json: async () => exito ? {
        success: true, radicado: "RAD-INTERNA", tipo_comunicacion: "Interna",
        dependencia_remitente: "Nombre histórico confirmado", dependencia_remitente_id: 3,
      } : { success: false, message: "Origen inactivo" } };
      return catalogos(ruta, opciones);
    });
    const user = userEvent.setup({ delay: null });
    await abrirRadicacion();
    await completarFormulario(user);
    if (exito) fireEvent.change(screen.getByLabelText(/entidad \/ empresa/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/clase de comunicación/i), { target: { value: "Interna" } });
    fireEvent.change(screen.getByLabelText(/dependencia remitente/i), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/correo electrónico/i), { target: { value: "" } });
    await user.upload(screen.getByLabelText("Documentos PDF de soporte"),
      new File(["PDF"], "interna.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Generar radicado y registrar" }));
    await screen.findByText(exito ? /Radicado RAD-INTERNA guardado/ : "Origen inactivo");
    const datos = solicitarApi.mock.calls.find(([ruta]) => ruta === "/api/radicados")[1].body;
    expect(datos.get("dependencia_remitente_id")).toBe("3");
    expect(datos.has("remitente_tipo_persona")).toBe(false);
    expect(datos.has("remitente_entidad")).toBe(false);
    if (exito) {
      expect(crearPdfComprobante).toHaveBeenCalledWith(expect.objectContaining({
        dependencia_remitente: "Nombre histórico confirmado", tipo_comunicacion: "Interna",
      }));
      expect(screen.getByLabelText(/clase de comunicación/i).value).toBe("");
      expect(screen.queryByLabelText(/dependencia remitente/i)).toBeNull();
      expect(screen.getByLabelText(/entidad \/ empresa/i).value).toBe("");
    } else {
      expect(screen.getByLabelText(/dependencia remitente/i).value).toBe("3");
      expect(screen.getByLabelText(/entidad \/ empresa/i).value).toBe("Persona natural");
      expect(screen.getByLabelText(/entidad \/ empresa/i).disabled).toBe(true);
      expect(crearPdfComprobante).not.toHaveBeenCalled();
    }
  }, 10_000);

  it("exige correo externo y NIT jurídico antes de enviar, sin enviar origen institucional", async () => {
    const catalogos = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta === "/api/radicados") return { json: async () => ({
        success: true, radicado: "RAD-JURIDICA", tipo_comunicacion: "Externa",
        remitente_tipo_persona: "juridica",
      }) };
      return catalogos(ruta, opciones);
    });
    const user = userEvent.setup({ delay: null });
    await abrirRadicacion();
    await completarFormulario(user);
    fireEvent.change(screen.getByLabelText(/tipo de persona/i), { target: { value: "juridica" } });
    await user.upload(screen.getByLabelText("Documentos PDF de soporte"),
      new File(["PDF"], "externa.pdf", { type: "application/pdf" }));
    const boton = screen.getByRole("button", { name: "Generar radicado y registrar" });
    await user.click(boton);
    expect(solicitarApi.mock.calls.some(([ruta]) => ruta === "/api/radicados")).toBe(false);
    fireEvent.change(screen.getByLabelText(/nit de la entidad/i), { target: { value: "123456789" } });
    const correo = screen.getByLabelText(/correo electrónico/i);
    fireEvent.change(correo, { target: { value: "" } });
    await user.click(boton);
    expect(correo.checkValidity()).toBe(false);
    expect(solicitarApi.mock.calls.some(([ruta]) => ruta === "/api/radicados")).toBe(false);
    fireEvent.change(correo, { target: { value: "juridica@example.com" } });
    await user.click(boton);
    await screen.findByText(/Radicado RAD-JURIDICA guardado/);
    const datos = solicitarApi.mock.calls.find(([ruta]) => ruta === "/api/radicados")[1].body;
    expect(datos.has("dependencia_remitente_id")).toBe(false);
    expect(datos.get("remitente_tipo_persona")).toBe("juridica");
    expect(datos.get("remitente_nit")).toBe("123456789");
    expect(crearPdfComprobante).toHaveBeenCalledWith(expect.objectContaining({ remitente_tipo_persona: "juridica" }));
  }, 10_000);

  it.each(["generación", "descarga"])(
    "confirma el guardado si falla la %s y reintenta solo el comprobante",
    async (fallo) => {
      const catalogos = solicitarApi.getMockImplementation();
      solicitarApi.mockImplementation(async (ruta, opciones) => {
        if (ruta === "/api/radicados") {
          return { json: async () => ({
            success: true, radicado: "RAD-PRUEBA-001",
            tipo_comunicacion: "Externa", usuario_recibe: "Ana Pérez",
          }) };
        }
        return catalogos(ruta, opciones);
      });
      const error = new Error("Fallo de PDF simulado");
      if (fallo === "generación") crearPdfComprobante.mockRejectedValueOnce(error);
      else guardarPdf.mockImplementationOnce(() => { throw error; });
      const user = userEvent.setup();
      await abrirRadicacion();
      await completarFormulario(user);
      await user.upload(screen.getByLabelText("Documentos PDF de soporte"),
        new File(["PDF"], "solicitud.pdf", { type: "application/pdf" }));
      await user.click(screen.getByRole("button", { name: "Generar radicado y registrar" }));

      expect(await screen.findByText(/Radicado RAD-PRUEBA-001 guardado/)).toBeTruthy();
      expect(screen.getByRole("alert").textContent).toContain("Fallo de PDF simulado");
      expect(screen.getByRole("alert").textContent).toContain("No vuelvas a registrar");
      expect(screen.getByLabelText(/nombre completo del remitente/i).value).toBe("");
      expect(screen.queryByRole("list", { name: "Archivos de radicación seleccionados" })).toBeNull();
      const datos = crearPdfComprobante.mock.calls[0][0];
      await user.type(screen.getByLabelText(/nombre completo del remitente/i), "Otro remitente");
      crearPdfComprobante.mockImplementationOnce(() => { throw new Error("Fallo al reintentar"); });
      await user.click(screen.getByRole("button", { name: "Reintentar comprobante" }));
      expect(screen.getByRole("alert").textContent).toContain("Fallo al reintentar");
      await user.click(screen.getByRole("button", { name: "Reintentar comprobante" }));
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(crearPdfComprobante.mock.calls.at(-1)[0]).toEqual(datos);
      expect(guardarPdf).toHaveBeenLastCalledWith("Comprobante_RAD-PRUEBA-001.pdf");
      expect(solicitarApi.mock.calls.filter(([ruta]) => ruta === "/api/radicados")).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "Reintentar comprobante" })).toBeNull();
    }, 10_000,
  );

  it("mantiene bloqueado el registro mientras espera el comprobante sin duplicar la radicación", async () => {
    const catalogos = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => ruta === "/api/radicados"
      ? { json: async () => ({ success: true, radicado: "RAD-MARCA", tipo_comunicacion: "Externa" }) }
      : catalogos(ruta, opciones));
    let terminar;
    crearPdfComprobante.mockImplementationOnce(() => new Promise(resolve => { terminar = resolve; }));
    const user = userEvent.setup({ delay: null });
    await abrirRadicacion();
    await completarFormulario(user);
    await user.upload(screen.getByLabelText("Documentos PDF de soporte"),
      new File(["PDF"], "solicitud.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Generar radicado y registrar" }));
    await screen.findByText("Generando comprobante…");
    expect(guardarPdf).not.toHaveBeenCalled();
    const boton = screen.getByRole("button", { name: "Preparando comprobante…" });
    expect(boton.disabled).toBe(true);
    terminar({ save: guardarPdf });
    await waitFor(() => expect(guardarPdf).toHaveBeenCalledWith("Comprobante_RAD-MARCA.pdf"));
    expect(solicitarApi.mock.calls.filter(([ruta]) => ruta === "/api/radicados")).toHaveLength(1);
  });

  it.each(["rechazo", "red", "cifrado"])("conserva el formulario ante un fallo de %s y no ofrece comprobante", async (fallo) => {
    const mensajeCifrado = "El archivo PDF está cifrado o protegido con contraseña y no se puede validar. Adjunta una copia sin protección, si tienes autorización para hacerlo.";
    const mensajeEsperado = fallo === "red" ? "Sin conexión" : fallo === "cifrado" ? mensajeCifrado : "Registro rechazado";
    const catalogos = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta === "/api/radicados") {
        if (fallo === "red") throw new Error("Sin conexión");
        if (fallo === "cifrado") throw new Error(mensajeCifrado);
        return { json: async () => ({ success: false, message: "Registro rechazado" }) };
      }
      return catalogos(ruta, opciones);
    });
    const user = userEvent.setup();
    await abrirRadicacion();
    await completarFormulario(user);
    await user.upload(screen.getByLabelText("Documentos PDF de soporte"),
      new File(["PDF"], "solicitud.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Generar radicado y registrar" }));
    expect(await screen.findByText(mensajeEsperado)).toBeTruthy();
    expect(screen.getByLabelText(/nombre completo del remitente/i).value).toBe("María Torres");
    expect(crearPdfComprobante).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Reintentar comprobante" })).toBeNull();
  }, 10_000);

  it("carga los catálogos y exige adjuntar el PDF antes de registrar", async () => {
    const user = userEvent.setup();
    await abrirRadicacion();
    await completarFormulario(user);

    await user.click(
      screen.getByRole("button", { name: "Generar radicado y registrar" }),
    );

    expect(
      await screen.findByText("Adjunta al menos un archivo PDF."),
    ).toBeTruthy();
    expect(solicitarApi).not.toHaveBeenCalledWith(
      "/api/radicados",
      expect.anything(),
    );
  });

  it("inicia la clase de comunicación vacía y la exige", async () => {
    await abrirRadicacion();
    const selector = screen.getByLabelText(/clase de comunicación/i);
    expect(selector.value).toBe("");
    expect(selector.required).toBe(true);
    expect(selector.checkValidity()).toBe(false);
  });

  it("ofrece el destino compartido sin cambiar los IDs de dependencias", async () => {
    await abrirRadicacion();
    expect(
      screen.getByRole("option", { name: "Todas las dependencias" }).value,
    ).toBe("todas");
    expect(
      screen.getByRole("option", { name: "Secretaría de Gobierno" }).value,
    ).toBe("3");
  });

  it("envía y muestra en el comprobante el destino de todas las dependencias", async () => {
    solicitarApi.mockImplementation(async (ruta) => {
      if (ruta === "/api/radicados") {
        return {
          json: async () => ({
            success: true,
            radicado: "RAD-20261013-0002",
            dependencia_destino: "Todas las dependencias",
            destino_todas_dependencias: true,
            tipo_comunicacion: "Externa",
            usuario_recibe: "Luis Gómez",
          }),
        };
      }
      const respuestas = {
        "/api/tipos-tramite": {
          tipos_tramite: [
            { id: 10, nombre: "Solicitud general", termino_legal_id: 22 },
          ],
        },
        "/api/dependencias": {
          dependencias: [{ id: 3, nombre: "Secretaría de Gobierno" }],
        },
        "/api/usuarios/ventanilla": {
          usuarios: [{ id: 8, nombre: "Luis Gómez" }],
        },
      };
      if (!respuestas[ruta]) throw new Error(`Ruta inesperada: ${ruta}`);
      return { json: async () => respuestas[ruta] };
    });
    const user = userEvent.setup();
    await abrirRadicacion();
    await completarFormulario(user, "todas");
    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(["contenido PDF"], "circular.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Generar radicado y registrar" }));

    await screen.findByText(/Radicado RAD-20261013-0002 guardado/);
    const [, opcionesRegistro] = solicitarApi.mock.calls.find(
      ([ruta]) => ruta === "/api/radicados",
    );
    expect(opcionesRegistro.body.get("dependencia_destino_id")).toBe("todas");
    expect(crearPdfComprobante).toHaveBeenCalledWith(
      expect.objectContaining({
        dependencia_destino: "Todas las dependencias",
      }),
    );
  });

  it("rechaza un archivo que no sea PDF", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await abrirRadicacion();

    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(["texto"], "solicitud.txt", { type: "text/plain" }),
    );

    expect(
      await screen.findByText('El archivo "solicitud.txt" no tiene extensión PDF. Selecciona un documento .pdf.'),
    ).toBeTruthy();
    expect(solicitarApi).not.toHaveBeenCalledWith(
      "/api/radicados",
      expect.anything(),
    );
  });

  it("acepta un PDF de exactamente 10 MB", async () => {
    const user = userEvent.setup();
    await abrirRadicacion();

    await user.upload(
      document.querySelector('input[type="file"]'),
      new File([new Uint8Array(10 * 1024 * 1024)], "solicitud.pdf", {
        type: "application/pdf",
      }),
    );

    expect(await screen.findByText("solicitud.pdf (10.00 MB)")).toBeTruthy();
  });

  it("rechaza un PDF que supera el límite de 10 MB", async () => {
    const user = userEvent.setup();
    await abrirRadicacion();

    await user.upload(
      document.querySelector('input[type="file"]'),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "solicitud.pdf", {
        type: "application/pdf",
      }),
    );

    expect(
      await screen.findByText('El archivo "solicitud.pdf" pesa 10.00 MB (10485761 bytes) y supera el máximo de 10 MB (10485760 bytes) por archivo.'),
    ).toBeTruthy();
    expect(solicitarApi).not.toHaveBeenCalledWith(
      "/api/radicados",
      expect.anything(),
    );
  });

  it("rechaza un PDF vacío y asocia el error al selector", async () => {
    const user = userEvent.setup();
    await abrirRadicacion();
    const selector = screen.getByLabelText("Documentos PDF de soporte");
    await user.upload(selector, new File([], "vacio.pdf", { type: "application/pdf" }));

    expect(await screen.findByText(
      'El archivo "vacio.pdf" está vacío. Selecciona un PDF con contenido.',
    )).toBeTruthy();
    expect(selector.getAttribute("aria-invalid")).toBe("true");
    expect(selector.getAttribute("aria-describedby")).toBe("error-archivos");
    expect(selector.value).toBe("");
    expect(solicitarApi).not.toHaveBeenCalledWith("/api/radicados", expect.anything());
  });

  it("mantiene el motivo del rechazo y los campos con un asunto mayor de 500 caracteres", async () => {
    const user = userEvent.setup();
    await abrirRadicacion();
    await completarFormulario(user);
    const asunto = screen.getByLabelText(/asunto \/ resumen/i);
    fireEvent.change(asunto, { target: { value: "a".repeat(1184) } });
    const selector = screen.getByLabelText("Documentos PDF de soporte");
    await user.upload(selector, new File(
      [new Uint8Array(12169228)], "portadas para cuaderno.pdf",
      { type: "application/pdf" },
    ));
    const error = 'El archivo "portadas para cuaderno.pdf" pesa 11.61 MB (12169228 bytes) y supera el máximo de 10 MB (10485760 bytes) por archivo.';
    expect(await screen.findByText(error)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Generar radicado y registrar" }));
    expect(screen.getByText(error)).toBeTruthy();
    expect(screen.queryByText("Adjunta al menos un archivo PDF.")).toBeNull();
    expect(asunto.value).toBe("a".repeat(1184));
    expect(screen.getByLabelText(/nombre completo del remitente/i).value).toBe("María Torres");
    expect(screen.getByLabelText(/dependencia de destino/i).value).toBe("3");
    expect(solicitarApi).not.toHaveBeenCalledWith("/api/radicados", expect.anything());

    await user.upload(selector, new File(["PDF"], "valido.pdf", { type: "application/pdf" }));
    expect(await screen.findByText(/valido.pdf/)).toBeTruthy();
    expect(screen.queryByText(error)).toBeNull();
    expect(selector.getAttribute("aria-invalid")).toBe("false");
    expect(asunto.value).toBe("a".repeat(1184));
  }, 10_000);

  it("descarta toda la selección si contiene un archivo inválido y permite corregirla por arrastre", async () => {
    await abrirRadicacion();
    const selector = screen.getByLabelText("Documentos PDF de soporte");
    const zona = selector.closest(".upload-field");
    const valido = new File(["PDF"], "valido.pdf", { type: "application/pdf" });
    const invalido = new File(["texto"], "invalido.txt", { type: "text/plain" });
    fireEvent.drop(zona, { dataTransfer: { files: [valido, invalido] } });
    expect(await screen.findByText(/"invalido.txt" no tiene extensión PDF/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Archivos de radicación seleccionados" })).toBeNull();
    expect(solicitarApi).not.toHaveBeenCalledWith("/api/radicados", expect.anything());
    fireEvent.drop(zona, { dataTransfer: { files: [valido] } });
    expect(await screen.findByText(/valido.pdf/)).toBeTruthy();
    expect(screen.queryByText(/"invalido.txt" no tiene extensión PDF/)).toBeNull();
  });

  it("rechaza más de cinco archivos y acepta una selección corregida de cinco", async () => {
    const user = userEvent.setup();
    await abrirRadicacion();
    const selector = screen.getByLabelText("Documentos PDF de soporte");
    const archivos = Array.from({ length: 6 }, (_, indice) =>
      new File(["PDF"], `adjunto-${indice}.pdf`, { type: "application/pdf" }),
    );
    await user.upload(selector, archivos);
    expect(await screen.findByText("Puedes adjuntar máximo 5 archivos PDF.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Archivos de radicación seleccionados" })).toBeNull();
    expect(solicitarApi).not.toHaveBeenCalledWith("/api/radicados", expect.anything());
    await user.upload(selector, archivos.slice(0, 5));
    expect(await screen.findByRole("list", { name: "Archivos de radicación seleccionados" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Quitar" })).toHaveLength(5);
    expect(screen.queryByText("Puedes adjuntar máximo 5 archivos PDF.")).toBeNull();
  });

  it("envía el formulario y genera el comprobante después del registro exitoso", async () => {
    solicitarApi.mockImplementation(async (ruta, opciones) => {
      if (ruta === "/api/radicados") {
        return {
          json: async () => ({
            success: true,
            radicado: "RAD-20261013-0001",
            tipo_comunicacion: "Externa",
            usuario_recibe: "Luis Gómez",
          }),
        };
      }
      const respuestas = {
        "/api/tipos-tramite": {
          tipos_tramite: [
            { id: 10, nombre: "Solicitud general", termino_legal_id: 22 },
          ],
        },
        "/api/dependencias": {
          dependencias: [{ id: 3, nombre: "Secretaría de Gobierno" }],
        },
        "/api/usuarios/ventanilla": {
          usuarios: [{ id: 8, nombre: "Luis Gómez" }],
        },
      };
      if (!respuestas[ruta]) throw new Error(`Ruta inesperada: ${ruta}`);
      return { json: async () => respuestas[ruta] };
    });
    const user = userEvent.setup();
    await abrirRadicacion();
    await completarFormulario(user);
    const archivo = new File(["contenido PDF"], "solicitud.pdf", {
      type: "application/pdf",
    });
    await user.upload(document.querySelector('input[type="file"]'), archivo);
    await user.click(
      screen.getByRole("button", { name: "Generar radicado y registrar" }),
    );

    await screen.findByText(/Radicado RAD-20261013-0001 guardado/);
    const [rutaRegistro, opcionesRegistro] = solicitarApi.mock.calls.find(
      ([ruta]) => ruta === "/api/radicados",
    );
    expect(rutaRegistro).toBe("/api/radicados");
    expect(opcionesRegistro.method).toBe("POST");
    expect(opcionesRegistro.body.get("tipo_tramite_id")).toBe("10");
    expect(opcionesRegistro.body.get("tipo_comunicacion")).toBe("Externa");
    expect(opcionesRegistro.body.get("dependencia_destino_id")).toBe("3");
    expect(opcionesRegistro.body.get("usuario_recibe")).toBe("8");
    expect(opcionesRegistro.body.get("archivos").name).toBe("solicitud.pdf");
    expect(crearPdfComprobante).toHaveBeenCalledWith(
      expect.objectContaining({
        numero_radicado: "RAD-20261013-0001",
        tipo_comunicacion: "Externa",
        dependencia_destino: "Secretaría de Gobierno",
        usuario_recibe: "Luis Gómez",
      }),
    );
    expect(guardarPdf).toHaveBeenCalledWith("Comprobante_RAD-20261013-0001.pdf");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generar radicado y registrar" })
          .disabled,
      ).toBe(false),
    );
  }, 10_000);
});
