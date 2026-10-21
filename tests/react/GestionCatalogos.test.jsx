import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaginaGestionCatalogos } from "../../src/paginas/GestionCatalogos.jsx";
import { confirmarSesion, solicitarApi } from "../../src/servicios/api.js";

vi.mock("../../src/servicios/api.js", () => ({
  confirmarSesion: vi.fn(),
  limpiarSesion: vi.fn(),
  solicitarApi: vi.fn(),
}));

const administrador = {
  id: 1,
  nombre: "Admin",
  rol: "administrador",
  dependencia_id: null,
};
const funcionario = {
  id: 2,
  nombre: "Funcionario",
  rol: "funcionario",
  dependencia_id: 3,
};
const dependencia = { id: 3, nombre: "Planeación", activo: 1 };
const tipoTramite = {
  id: 10,
  codigo: "peticion_general",
  nombre: "Petición general",
  categoria_general: "peticion_general",
  termino_legal_id: 22,
  dias: 15,
  tipo_dias: "habiles",
  activo: 1,
};

function respuestaJson(resultado) {
  return { json: async () => resultado };
}

function prepararApi() {
  let dependencias = [{ ...dependencia }];
  solicitarApi.mockImplementation(async (ruta, opciones = {}) => {
    if (
      (ruta.startsWith("/api/dependencias?") ||
        ruta === "/api/dependencias") &&
      !opciones.method
    ) {
      return respuestaJson({ success: true, dependencias });
    }
    if (ruta === "/api/dependencias/3" && !opciones.method) {
      return respuestaJson({ success: true, dependencia });
    }
    if (ruta === "/api/dependencias/3" && opciones.method === "PUT") {
      return { status: 204, json: async () => {
        throw new Error("204 No Content has no JSON body");
      } };
    }
    if (
      (ruta.startsWith("/api/tipos-tramite?") ||
        ruta === "/api/tipos-tramite") &&
      !opciones.method
    ) {
      return respuestaJson({ success: true, tipos_tramite: [tipoTramite] });
    }
    if (ruta === "/api/dependencias" && opciones.method === "POST") {
      return respuestaJson({ success: true, message: "Dependencia creada." });
    }
    if (ruta === "/api/tipos-tramite" && opciones.method === "POST") {
      return respuestaJson({ success: true, message: "Trámite creado." });
    }
    if (ruta === "/api/tipos-tramite/10" && !opciones.method) {
      return respuestaJson({ success: true, tipo_tramite: tipoTramite });
    }
    if (ruta === "/api/tipos-tramite/10" && opciones.method === "PUT") {
      return respuestaJson({ success: true, message: "Trámite actualizado." });
    }
    if (ruta === "/api/dependencias/3/estado" && opciones.method === "PATCH") {
      dependencias = [
        { ...dependencia, activo: JSON.parse(opciones.body).activo },
      ];
      return respuestaJson({ success: true, message: "Estado actualizado." });
    }
    if (ruta === "/api/terminos-legales?tipo_tramite_id=10") {
      return respuestaJson({
        success: true,
        terminos_legales: [{ id: 22, dias: 15, tipo_dias: "habiles" }],
      });
    }
    if (ruta === "/api/terminos-legales" && opciones.method === "POST") {
      return respuestaJson({ success: true, message: "Término registrado." });
    }
    throw new Error(`Ruta inesperada: ${ruta} ${opciones.method || "GET"}`);
  });
}

describe("gestión de catálogos React", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    confirmarSesion.mockResolvedValue(administrador);
    prepararApi();
  });

  it("carga los catálogos incluyendo inactivos y crea una dependencia", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PaginaGestionCatalogos />);
    await screen.findByText("Planeación");

    expect(solicitarApi).toHaveBeenCalledWith(
      "/api/dependencias?incluir_inactivos=1",
    );
    expect(solicitarApi).toHaveBeenCalledWith(
      "/api/tipos-tramite?incluir_inactivos=1",
    );

    await user.type(
      screen.getByLabelText("Nombre de la dependencia *"),
      "Secretaría General",
    );
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(solicitarApi).toHaveBeenCalledWith(
        "/api/dependencias",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ nombre: "Secretaría General" }),
        }),
      );
    });
    expect(await screen.findByText("Dependencia creada.")).toBeTruthy();
  });

  it("crea un tipo de trámite con su término legal inicial", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PaginaGestionCatalogos />);
    await screen.findByText("Planeación");
    await user.click(screen.getByRole("tab", { name: "Tipos de trámite" }));

    expect(screen.getByText("Identificación del trámite")).toBeTruthy();
    expect(screen.getByText("Clasificación")).toBeTruthy();
    expect(screen.getByText("Plazo legal inicial")).toBeTruthy();
    expect(
      screen.getByText("Si la dejas vacía, el plazo aplicará desde hoy."),
    ).toBeTruthy();

    await user.type(screen.getByLabelText("Nombre *"), "Petición consulta");
    expect(screen.getByLabelText("Código técnico *").value).toBe(
      "peticion_consulta",
    );
    await user.selectOptions(
      screen.getByLabelText("Categoría general *"),
      "consulta",
    );
    await user.type(
      screen.getByLabelText("Cantidad de días para responder *"),
      "15",
    );
    await user.selectOptions(
      screen.getByLabelText("Cómo contar los días *"),
      "calendario",
    );
    await user.type(
      screen.getByLabelText("Norma que establece el plazo *"),
      "Ley aplicable",
    );
    await user.type(
      screen.getByLabelText("Fecha desde la que aplica (opcional)"),
      "2026-01-01",
    );
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(solicitarApi).toHaveBeenCalledWith(
        "/api/tipos-tramite",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            codigo: "peticion_consulta",
            nombre: "Petición consulta",
            categoria_general: "consulta",
            requiere_respuesta: true,
            dias: 15,
            tipo_dias: "calendario",
            fundamento_legal: "Ley aplicable",
            vigente_desde: "2026-01-01",
          }),
        }),
      );
    });
    expect(await screen.findByText("Trámite creado.")).toBeTruthy();
  });

  it("conserva el código manual al seguir cambiando el nombre", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PaginaGestionCatalogos />);
    await screen.findByText("Planeación");
    await user.click(screen.getByRole("tab", { name: "Tipos de trámite" }));

    const campoNombre = screen.getByLabelText("Nombre *");
    const campoCodigo = screen.getByLabelText("Código técnico *");
    await user.type(campoNombre, "Acción de tutela");
    expect(campoCodigo.value).toBe("accion_de_tutela");

    await user.clear(campoCodigo);
    await user.type(campoCodigo, "tutela_especial");
    await user.clear(campoNombre);
    await user.type(campoNombre, "Acción constitucional");

    expect(campoCodigo.value).toBe("tutela_especial");
    const categoria = screen.getByLabelText("Categoría general *");
    expect(categoria.tagName).toBe("SELECT");
    expect(
      within(categoria).getByRole("option", { name: "Trámite especial" }).value,
    ).toBe("especial");
  });

  it("edita los datos del tipo sin intentar modificar el término legal", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PaginaGestionCatalogos />);
    await screen.findByText("Planeación");
    await user.click(screen.getByRole("tab", { name: "Tipos de trámite" }));
    const row = within(screen.getByRole("table")).getAllByRole("row")[1];
    await user.click(
      within(row).getByRole("button", { name: "Editar" }),
    );

    await user.clear(screen.getByLabelText("Nombre *"));
    await user.type(screen.getByLabelText("Nombre *"), "Petición actualizada");
    await user.clear(screen.getByLabelText("Orden (opcional)"));
    await user.type(screen.getByLabelText("Orden (opcional)"), "4");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      const llamada = solicitarApi.mock.calls.find(
        ([ruta, opciones]) =>
          ruta === "/api/tipos-tramite/10" && opciones?.method === "PUT",
      );
      expect(llamada).toBeTruthy();
      expect(JSON.parse(llamada[1].body)).toEqual({
        codigo: "peticion_general",
        nombre: "Petición actualizada",
        categoria_general: "peticion_general",
        requiere_respuesta: true,
        orden: 4,
      });
    });
  });

  it("crea un tipo sin respuesta sin pedir plazo ni enviar término ficticio", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PaginaGestionCatalogos />);
    await screen.findByText("Planeación", { selector: "td" });
    await user.click(screen.getByRole("tab", { name: "Tipos de trámite" }));
    const nombre = screen.getByLabelText("Nombre *");
    await user.click(nombre);
    await user.paste("Informativo nuevo");
    await user.selectOptions(screen.getByLabelText(/Categoría general/), "peticion_general");
    await user.click(screen.getByLabelText("Requiere respuesta"));
    expect(screen.queryByLabelText(/Cantidad de días para responder/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Crear" }));
    await waitFor(() => {
      const llamada = solicitarApi.mock.calls.find(([ruta, opciones]) =>
        ruta === "/api/tipos-tramite" && opciones?.method === "POST");
      expect(llamada).toBeTruthy();
      expect(JSON.parse(llamada[1].body)).toEqual({
        codigo: "informativo_nuevo", nombre: "Informativo nuevo",
        categoria_general: "peticion_general", requiere_respuesta: false,
      });
    });
  });

  it("inactiva la dependencia vía baja lógica y refleja el estado confirmado", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<PaginaGestionCatalogos />);
    const row = (await screen.findByText("Planeación")).closest("tr");

    await user.click(
      within(row).getByRole("button", { name: "Inactivar" }),
    );

    await waitFor(() => {
      expect(solicitarApi).toHaveBeenCalledWith(
        "/api/dependencias/3/estado",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ activo: 0 }),
        }),
      );
      expect(within(row).getByText("Inactivo")).toBeTruthy();
    });
  });

  it("muestra el formulario al editar y acepta PUT confirmado con HTTP 204", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PaginaGestionCatalogos />);
    const row = (await screen.findByText("Planeación")).closest("tr");

    await user.click(within(row).getByRole("button", { name: "Editar" }));

    const campoNombre = await screen.findByDisplayValue("Planeación");
    expect(campoNombre).toBeTruthy();
    expect(document.activeElement).toBe(campoNombre);
    await user.clear(campoNombre);
    await user.type(campoNombre, "Planeación actualizada");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(solicitarApi).toHaveBeenCalledWith(
        "/api/dependencias/3",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ nombre: "Planeación actualizada" }),
        }),
      );
      expect(screen.getByRole("button", { name: "Crear" })).toBeTruthy();
    });
    expect(
      screen.getByText("Cambios guardados correctamente."),
    ).toBeTruthy();
  });

  it("registra una versión de término usando tipo_tramite_id", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PaginaGestionCatalogos />);
    await screen.findByText("Planeación");
    await user.click(screen.getByRole("tab", { name: "Tipos de trámite" }));
    const row = within(screen.getByRole("table")).getAllByRole("row")[1];
    await user.click(
      within(row).getByRole("button", { name: "Nueva versión de término" }),
    );
    await user.type(screen.getByLabelText("Plazo (días) *"), "20");
    await user.selectOptions(document.getElementById("termino-tipo-dias"), "calendario");
    await user.type(
      document.getElementById("termino-fundamento"),
      "Nueva norma",
    );
    await user.click(
      screen.getByRole("button", { name: "Registrar nueva versión" }),
    );

    await waitFor(() => {
      expect(solicitarApi).toHaveBeenCalledWith(
        "/api/terminos-legales",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            tipo_tramite_id: 10,
            dias: 20,
            tipo_dias: "calendario",
            fundamento_legal: "Nueva norma",
          }),
        }),
      );
    });
    expect(await screen.findByText("Término registrado.")).toBeTruthy();
  });

  it("impide entrar a funcionarios y evita solicitar los catálogos", async () => {
    confirmarSesion.mockResolvedValue(funcionario);
    render(<PaginaGestionCatalogos />);

    expect(await screen.findByText("Acceso restringido")).toBeTruthy();
    expect(solicitarApi).not.toHaveBeenCalled();
  });
});
