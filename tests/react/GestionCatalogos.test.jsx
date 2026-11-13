import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

async function pegarTexto(user, control, texto) {
  await user.click(control);
  await user.paste(texto);
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

  it("etiqueta las tarjetas de dependencias, trámites e historial sin duplicar acciones", async () => {
    render(<PaginaGestionCatalogos />);
    const etiquetas = (fila) => Array.from(fila.querySelectorAll(".tarjeta-etiqueta"), (nodo) => nodo.textContent);
    const dependenciaFila = (await screen.findByRole("cell", { name: "Planeación" })).closest("tr");
    expect(etiquetas(dependenciaFila)).toEqual(["Nombre", "Estado", "Acciones"]);
    expect(within(dependenciaFila).getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Tipos de trámite" }));
    const tramiteFila = screen.getByRole("cell", { name: "Petición general" }).closest("tr");
    expect(etiquetas(tramiteFila)).toEqual(["Nombre", "Código", "Categoría", "Término vigente", "Estado", "Acciones"]);
    expect(within(tramiteFila).getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    fireEvent.click(within(tramiteFila).getByRole("button", { name: "Actualizar plazo" }));
    const historial = await screen.findByRole("table", { name: "Términos legales" });
    const filaTermino = within(historial).getAllByRole("row")[1];
    expect(etiquetas(filaTermino)).toEqual(["Días", "Tipo", "Fundamento legal", "Vigente desde", "Vigente hasta"]);
    expect(within(historial).getAllByRole("columnheader")).toHaveLength(5);
    expect(screen.getByRole("region", { name: "Historial de términos legales" }).tabIndex).toBe(0);
  });

  it("muestra el resumen y filtra localmente por nombre, código o categoría", async () => {
    const user = userEvent.setup({ delay: null });
    const dependencias = [
      { ...dependencia },
      { id: 4, nombre: "Control Disciplinario", activo: 0 },
    ];
    const tramites = [
      { ...tipoTramite },
      {
        id: 11,
        codigo: "licencia_urbanistica",
        nombre: "Licencia urbanística",
        categoria_general: "consulta",
        termino_legal_id: null,
        activo: 1,
      },
    ];
    solicitarApi.mockImplementation(async (ruta) => {
      if (ruta.startsWith("/api/dependencias")) {
        return respuestaJson({ success: true, dependencias });
      }
      if (ruta.startsWith("/api/tipos-tramite")) {
        return respuestaJson({ success: true, tipos_tramite: tramites });
      }
      throw new Error(`Ruta inesperada: ${ruta}`);
    });

    render(<PaginaGestionCatalogos />);
    await screen.findByText("Control Disciplinario");
    expect(
      Array.from(document.querySelectorAll(".catalog-summary-card strong"),
        (nodo) => nodo.textContent),
    ).toEqual(["2", "1", "1"]);
    expect(screen.getByRole("searchbox", { name: "Buscar en el catálogo" })).toBeTruthy();

    await user.type(
      screen.getByRole("searchbox", { name: "Buscar en el catálogo" }),
      "disciplinario",
    );
    expect(screen.getByRole("cell", { name: "Control Disciplinario" })).toBeTruthy();
    expect(screen.queryByRole("cell", { name: "Planeación" })).toBeNull();
    expect(screen.getByText("1 resultado para tu búsqueda.")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Tipos de trámite" }));
    expect(screen.getByRole("searchbox", { name: "Buscar en el catálogo" }).placeholder)
      .toBe("Buscar por nombre, código o categoría");
    await user.type(
      screen.getByRole("searchbox", { name: "Buscar en el catálogo" }),
      "consulta",
    );
    expect(screen.getByRole("cell", { name: "Licencia urbanística" })).toBeTruthy();
    expect(screen.getByText("1 resultado para tu búsqueda.")).toBeTruthy();
  });

  it("comunica un catálogo vacío y conserva el estado de error de carga", async () => {
    solicitarApi.mockImplementation(async (ruta) => {
      if (ruta.startsWith("/api/dependencias")) {
        return respuestaJson({ success: true, dependencias: [] });
      }
      if (ruta.startsWith("/api/tipos-tramite")) {
        return respuestaJson({ success: true, tipos_tramite: [] });
      }
      throw new Error(`Ruta inesperada: ${ruta}`);
    });
    const { unmount } = render(<PaginaGestionCatalogos />);
    expect(await screen.findByText("No hay registros para mostrar.")).toBeTruthy();
    unmount();

    solicitarApi.mockRejectedValue(new Error("No fue posible cargar los catálogos."));
    render(<PaginaGestionCatalogos />);
    expect(await screen.findByText("No fue posible cargar los catálogos.")).toBeTruthy();
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

    await pegarTexto(user,
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

    await pegarTexto(user, screen.getByLabelText("Nombre *"), "Petición consulta");
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
    await pegarTexto(user,
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
    await pegarTexto(user, screen.getByLabelText("Nombre *"), "Petición actualizada");
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
    await screen.findByRole("cell", { name: "Planeación" });
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
    await pegarTexto(user, campoNombre, "Planeación actualizada");
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
      within(row).getByRole("button", { name: "Actualizar plazo" }),
    );
    await user.type(screen.getByLabelText("Plazo (días) *"), "20");
    await user.selectOptions(document.getElementById("termino-tipo-dias"), "calendario");
    await pegarTexto(user,
      document.getElementById("termino-fundamento"),
      "Nueva norma",
    );
    await user.click(
      screen.getByRole("button", { name: "Guardar plazo" }),
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
    expect(await screen.findByText(/Término registrado\. Se aplicará a nuevas radicaciones/)).toBeTruthy();
  });

  it.each(["habiles", "calendario"])("configura el primer plazo en %s sin cambiar los datos del trámite", async tipoDias => {
    const user = userEvent.setup({ delay: null });
    const base = solicitarApi.getMockImplementation();
    let configurado = false;
    solicitarApi.mockImplementation(async (ruta, opciones = {}) => {
      if (ruta.startsWith("/api/tipos-tramite?")) return respuestaJson({
        success: true, tipos_tramite: [{ ...tipoTramite, requiere_respuesta: 1,
          termino_legal_id: configurado ? 23 : null }],
      });
      if (ruta === "/api/terminos-legales?tipo_tramite_id=10") {
        return respuestaJson({ success: true, terminos_legales: [] });
      }
      if (ruta === "/api/terminos-legales" && opciones.method === "POST") configurado = true;
      return base(ruta, opciones);
    });
    render(<PaginaGestionCatalogos />);
    await screen.findByText("Planeación");
    await user.click(screen.getByRole("tab", { name: "Tipos de trámite" }));
    await user.click(screen.getByRole("button", { name: "Configurar plazo" }));
    expect(screen.getByRole("heading", { name: "Configurar plazo: Petición general" })).toBeTruthy();
    const dias = screen.getByLabelText("Plazo (días) *");
    const fundamento = screen.getByLabelText("Fundamento legal *");
    expect(dias.required).toBe(true);
    expect(fundamento.required).toBe(true);
    expect(dias.min).toBe("1");
    await user.click(screen.getByRole("button", { name: "Guardar plazo" }));
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "POST")).toBe(false);
    await user.type(dias, "12");
    await user.selectOptions(screen.getByLabelText("Tipo de días *"), tipoDias);
    await pegarTexto(user, fundamento, "Norma de prueba validada");
    fireEvent.change(screen.getByLabelText("Vigente desde (opcional)"), { target: { value: "2099-01-01" } });
    expect(screen.getByText(/Una vigencia futura no habilita/)).toBeTruthy();
    expect(within(dias.closest("form")).getByText(/Hábiles: no cuentan sábados, domingos ni festivos\. Calendario: cuenta todos los días\./)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Guardar plazo" }));
    await waitFor(() => expect(solicitarApi).toHaveBeenCalledWith("/api/terminos-legales", expect.objectContaining({
      method: "POST", body: JSON.stringify({ tipo_tramite_id: 10, dias: 12, tipo_dias: tipoDias,
        fundamento_legal: "Norma de prueba validada", vigente_desde: "2099-01-01" }),
    })));
    expect(await screen.findByRole("button", { name: "Actualizar plazo" })).toBeTruthy();
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "PUT")).toBe(false);
  });

  it("impide entrar a funcionarios y evita solicitar los catálogos", async () => {
    confirmarSesion.mockResolvedValue(funcionario);
    render(<PaginaGestionCatalogos />);

    expect(await screen.findByText("Acceso restringido")).toBeTruthy();
    expect(solicitarApi).not.toHaveBeenCalled();
  });
});
