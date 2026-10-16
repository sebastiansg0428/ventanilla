import { render, screen, waitFor } from "@testing-library/react";
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
  await screen.findByRole("option", { name: "Solicitud general" });
  await screen.findByRole("option", { name: "Secretaría de Gobierno" });
  await screen.findByRole("option", { name: "Luis Gómez" });
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
  await user.type(
    screen.getByLabelText(/nombre completo del remitente/i),
    "María Torres",
  );
  await user.type(screen.getByLabelText(/cédula/i), "12345678");
  await user.type(screen.getByLabelText(/teléfono/i), "3001234567");
  await user.type(
    screen.getByLabelText(/entidad \/ empresa/i),
    "Persona natural",
  );
  await user.selectOptions(
    screen.getByLabelText(/dependencia de destino/i),
    destino,
  );
  await user.selectOptions(
    screen.getByLabelText(/funcionario \/ quién registra/i),
    "8",
  );
  await user.type(
    screen.getByLabelText(/asunto \/ resumen/i),
    "Solicitud de información",
  );
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
      await screen.findByText("Selecciona solo archivos PDF de hasta 10 MB cada uno."),
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
      await screen.findByText("Selecciona solo archivos PDF de hasta 10 MB cada uno."),
    ).toBeTruthy();
    expect(solicitarApi).not.toHaveBeenCalledWith(
      "/api/radicados",
      expect.anything(),
    );
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
