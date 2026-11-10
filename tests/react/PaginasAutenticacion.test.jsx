import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PaginaInicioSesion,
  PaginaRegistroUsuarios,
} from "../../src/paginas/PaginasAutenticacion.jsx";
import {
  confirmarSesion,
  guardarSesion,
  limpiarSesion,
  solicitarApi,
} from "../../src/servicios/api.js";
import { contrasenaValida, POLITICA_CONTRASENA } from "../../src/servicios/contrasenas.js";

vi.mock("../../src/servicios/api.js", () => ({
  confirmarSesion: vi.fn(),
  guardarSesion: vi.fn(),
  limpiarSesion: vi.fn(),
  solicitarApi: vi.fn(),
}));

function simularRedireccion() {
  const reemplazar = vi.fn();
  const ventanaPrueba = Object.create(window);
  Object.defineProperty(ventanaPrueba, "location", {
    value: { replace: reemplazar },
  });
  vi.stubGlobal("window", ventanaPrueba);
  return reemplazar;
}

async function completarCredenciales(user) {
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "persona@ejemplo.com",
  );
  await user.type(screen.getByLabelText("Contraseña"), "clave-de-prueba");
}

const administrador = {
  id: 1,
  nombre: "Administradora",
  rol: "administrador",
  dependencia_id: null,
};
const funcionario = {
  id: 53,
  nombre: "Ana Perez",
  email: "ana@example.com",
  rol: "funcionario",
  dependencia_id: 2,
  activo: 1,
};
const dependencias = [{ id: 2, nombre: "Planeación" }];

const metodosDialogo = ["showModal", "close"].map(nombre => [
  nombre, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, nombre),
]);
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true, value() { this.setAttribute("open", ""); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true, value() { this.removeAttribute("open"); },
  });
});
afterAll(() => {
  for (const [nombre, descriptor] of metodosDialogo) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, nombre, descriptor);
    else delete HTMLDialogElement.prototype[nombre];
  }
});

function respuestaJson(resultado) {
  return { json: async () => resultado };
}

function configurarApiGestion({ lista = [funcionario] } = {}) {
  let usuarios = lista;
  solicitarApi.mockImplementation(async (ruta, opciones = {}) => {
    if (ruta === "/api/usuarios" && !opciones.method) {
      return respuestaJson({ success: true, usuarios });
    }
    if (ruta === "/api/dependencias") {
      return respuestaJson({ success: true, dependencias });
    }
    if (ruta === "/api/usuarios/53" && !opciones.method) {
      return respuestaJson({ success: true, usuario: funcionario });
    }
    if (ruta === "/api/usuarios" && opciones.method === "POST") {
      return respuestaJson({ success: true, message: "Usuario creado." });
    }
    if (ruta === "/api/usuarios/53" && opciones.method === "PUT") {
      return respuestaJson({ success: true, message: "Usuario actualizado." });
    }
    if (ruta === "/api/usuarios/53/estado" && opciones.method === "PATCH") {
      usuarios = [{ ...funcionario, activo: JSON.parse(opciones.body).activo }];
      return respuestaJson({ success: true, message: "Estado actualizado." });
    }
    throw new Error(`Ruta inesperada: ${ruta}`);
  });
}

describe("inicio de sesión React", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("envía las credenciales y guarda la sesión ante una respuesta exitosa", async () => {
    const reemplazar = simularRedireccion();
    const usuario = { id: 7, nombre: "Ana", rol: "administrador" };
    solicitarApi.mockResolvedValue({
      json: async () => ({ token: "token-de-prueba", usuario }),
    });
    const user = userEvent.setup();

    render(<PaginaInicioSesion />);
    await completarCredenciales(user);
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(solicitarApi).toHaveBeenCalledWith("/api/auth/login", {
      requiereSesion: false,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "persona@ejemplo.com",
        password: "clave-de-prueba",
      }),
    });
    expect(guardarSesion).toHaveBeenCalledWith("token-de-prueba", usuario);
    expect(reemplazar).toHaveBeenCalledWith("index.html");
  });

  it("muestra el error del servidor y no guarda sesión si falla el inicio", async () => {
    solicitarApi.mockRejectedValue(new Error("Credenciales incorrectas"));
    const user = userEvent.setup();

    render(<PaginaInicioSesion />);
    await completarCredenciales(user);
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Credenciales incorrectas")).toBeTruthy();
    expect(guardarSesion).not.toHaveBeenCalled();
  });

  it("deshabilita el botón mientras espera la respuesta del servidor", async () => {
    let rechazarSolicitud;
    solicitarApi.mockReturnValue(
      new Promise((_, reject) => {
        rechazarSolicitud = reject;
      }),
    );
    const user = userEvent.setup();

    render(<PaginaInicioSesion />);
    await completarCredenciales(user);
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    const boton = screen.getByRole("button", { name: "Verificando…" });
    expect(boton.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(
      "Verificando tus credenciales…",
    );

    rechazarSolicitud(new Error("Servidor no disponible"));
    expect(await screen.findByText("Servidor no disponible")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Iniciar sesión" }).disabled,
    ).toBe(false);
  });

  it("muestra el error 403 de una cuenta inactiva sin guardar una sesión", async () => {
    solicitarApi.mockRejectedValue(
      Object.assign(new Error("La cuenta está inactiva."), { status: 403 }),
    );
    const user = userEvent.setup();

    render(<PaginaInicioSesion />);
    await completarCredenciales(user);
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("La cuenta está inactiva.")).toBeTruthy();
    expect(guardarSesion).not.toHaveBeenCalled();
  });
});

describe("gestión de usuarios React", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    confirmarSesion.mockResolvedValue(administrador);
    configurarApiGestion();
  });

  it("separa el encabezado, la tarjeta del formulario y el listado sin duplicar campos", async () => {
    render(<PaginaRegistroUsuarios />);
    await screen.findByText("Ana Perez");
    const formulario = screen.getByRole("region", { name: "Registrar usuario" });
    const listado = screen.getByRole("region", { name: "Usuarios registrados en el sistema" });
    expect(formulario.parentElement).toBe(listado.parentElement);
    expect(formulario.contains(listado)).toBe(false);
    expect(formulario.previousElementSibling.contains(
      screen.getByRole("heading", { name: "Gestión de usuarios" }),
    )).toBe(true);
    expect(formulario.nextElementSibling).toBe(listado);
    for (const etiqueta of ["Nombre completo *", "Correo electrónico *", "Rol en el sistema *", "Dependencia asignada"]) {
      const campo = within(formulario).getByLabelText(etiqueta).closest(".auth-field");
      expect(campo.classList.contains("auth-field--full")).toBe(false);
    }
    const contrasena = within(formulario).getByLabelText("Contraseña *");
    expect(contrasena.closest(".auth-field").classList.contains("auth-field--full")).toBe(true);
    expect(contrasena.getAttribute("aria-describedby")).toBe("politica-contrasena");
    expect(screen.getAllByLabelText("Nombre completo *")).toHaveLength(1);
  });

  it("mantiene los datos y una sola acción por usuario en el listado adaptable", async () => {
    render(<PaginaRegistroUsuarios />);
    const fila = (await screen.findByText("Ana Perez")).closest("tr");
    expect(Array.from(fila.querySelectorAll(".tarjeta-etiqueta"), (nodo) => nodo.textContent)).toEqual([
      "Nombre", "Correo", "Rol", "Dependencia", "Estado", "Acciones",
    ]);
    expect(within(fila).getAllByRole("cell")).toHaveLength(6);
    expect(within(fila).getAllByRole("button", { name: "Editar" })).toHaveLength(1);
    expect(within(screen.getByRole("table", { name: "Usuarios" })).getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.getByRole("region", { name: "Listado de usuarios" }).tabIndex).toBe(0);
  });

  it("muestra etiquetas legibles para los tres roles en lugar de sus valores internos", async () => {
    configurarApiGestion({ lista: [
      { ...administrador, email: "admin@example.com", activo: 1 },
      { ...funcionario, id: 54, nombre: "Cuenta de Ventanilla", rol: "ventanilla", dependencia_id: null },
      funcionario,
    ] });
    render(<PaginaRegistroUsuarios />);
    const tabla = await screen.findByRole("table", { name: "Usuarios" });
    await within(tabla).findByText("Ana Perez");
    for (const etiqueta of ["Administrador", "Ventanilla Única", "Funcionario de dependencia"]) {
      expect(within(tabla).getByText(etiqueta)).toBeTruthy();
    }
    expect(within(tabla).queryByText("funcionario")).toBeNull();
    expect(screen.getByRole("option", { name: "Funcionario de dependencia" }).value).toBe("funcionario");
  });

  it.each([0, 1])("mantiene el badge actual hasta confirmar el cambio del servidor, activo=%s", async activo => {
    configurarApiGestion({ lista: [{ ...funcionario, activo }] });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const base = solicitarApi.getMockImplementation();
    let confirmarCambio;
    solicitarApi.mockImplementation((ruta, opciones = {}) => {
      if (opciones.method === "PATCH") return new Promise(resolve => {
        confirmarCambio = () => resolve(base(ruta, opciones));
      });
      return base(ruta, opciones);
    });
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    const fila = (await screen.findByText("Ana Perez")).closest("tr");
    const estado = activo ? "Activo" : "Inactivo";
    const badge = within(fila).getByText(estado);
    expect(badge.classList.contains(`users-status-badge--${activo ? "active" : "inactive"}`)).toBe(true);
    await user.click(within(fila).getByRole("button", { name: activo ? "Inactivar" : "Activar" }));
    expect(window.confirm).toHaveBeenCalledWith(`¿Deseas ${activo ? "inactivar" : "activar"} la cuenta de Ana Perez?`);
    expect(within(fila).getByText(estado)).toBe(badge);
    expect(within(fila).getByRole("button", { name: "Editar" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Actualizar lista" }).disabled).toBe(true);
    confirmarCambio();
    const nuevoBadge = await within(screen.getByRole("table", { name: "Usuarios" })).findByText(activo ? "Inactivo" : "Activo");
    expect(nuevoBadge.classList.contains(`users-status-badge--${activo ? "inactive" : "active"}`)).toBe(true);
    expect(solicitarApi).toHaveBeenCalledWith("/api/usuarios/53/estado", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ activo: activo ? 0 : 1 }),
    }));
  });

  it.each([0, 1])("no cambia estado si se cancela la confirmación, activo=%s", async activo => {
    configurarApiGestion({ lista: [{ ...funcionario, activo }] });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    const fila = (await screen.findByText("Ana Perez")).closest("tr");
    await user.click(within(fila).getByRole("button", { name: activo ? "Inactivar" : "Activar" }));
    expect(within(fila).getByText(activo ? "Activo" : "Inactivo")).toBeTruthy();
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "PATCH")).toBe(false);
  });

  it("conserva carga, vacío y actualización explícita de la lista", async () => {
    const base = solicitarApi.getMockImplementation();
    let resolverLista;
    let listaVacia = true;
    solicitarApi.mockImplementation((ruta, opciones) => ruta === "/api/usuarios" && !opciones?.method
      ? new Promise(resolve => { resolverLista = () => resolve(respuestaJson({ usuarios: listaVacia ? [] : [funcionario] })); })
      : base(ruta, opciones));
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    await screen.findByText("Cargando usuarios…");
    expect(screen.getByRole("button", { name: "Actualizar lista" }).disabled).toBe(true);
    await waitFor(() => expect(resolverLista).toBeTypeOf("function"));
    await act(async () => resolverLista());
    await screen.findByText("No hay usuarios para mostrar.");
    listaVacia = false;
    await user.click(screen.getByRole("button", { name: "Actualizar lista" }));
    expect(screen.getByText("Cargando usuarios…")).toBeTruthy();
    resolverLista();
    await screen.findByText("Ana Perez");
    expect(screen.getByRole("button", { name: "Actualizar lista" }).disabled).toBe(false);
  });

  it("expone un fallo de cambio de estado sin mostrar éxito ni alterar el badge", async () => {
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => opciones?.method === "PATCH"
      ? Promise.reject(new Error("No se pudo cambiar el estado."))
      : base(ruta, opciones));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    const fila = (await screen.findByText("Ana Perez")).closest("tr");
    await user.click(within(fila).getByRole("button", { name: "Inactivar" }));
    expect(await screen.findByText("No se pudo cambiar el estado.")).toBeTruthy();
    expect(within(fila).getByText("Activo")).toBeTruthy();
    expect(within(fila).getByRole("button", { name: "Inactivar" }).disabled).toBe(false);
    expect(screen.queryByText("Estado actualizado.")).toBeNull();
  });

  it.each([
    "abcdefghij1!", "ABCDEFGHIJ1!", "Abcdefghij!!", "Abcdefghij12",
    "Abcdefghij12 ", "Abcdefghij1!\0", `Aa1!${"x".repeat(69)}`,
    `Aa1!${"é".repeat(35)}`, "Aa1!😀😀😀😀😀",
  ])("rechaza la contraseña inválida %j antes de enviar", async (password) => {
    render(<PaginaRegistroUsuarios />);
    await screen.findByText("Ana Perez");
    const entrada = screen.getByLabelText("Contraseña *");
    fireEvent.change(entrada, { target: { value: password } });
    fireEvent.submit(entrada.closest("form"));
    expect(screen.getByRole("status").textContent).toBe(POLITICA_CONTRASENA);
    expect(entrada.getAttribute("aria-invalid")).toBe("true");
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "POST")).toBe(false);
  });

  it("acepta 72 bytes Unicode y rechaza 73 bytes sin truncar", async () => {
    const password = `Aa1!${"é".repeat(34)}`;
    expect(contrasenaValida(password)).toBe(true);
    expect(contrasenaValida(`${password}x`)).toBe(false);
    expect(contrasenaValida("Árbol-largo-123")).toBe(true);
    render(<PaginaRegistroUsuarios />);
    await screen.findByText("Ana Perez");
    const entrada = screen.getByLabelText("Contraseña *");
    fireEvent.change(entrada, { target: { value: password } });
    fireEvent.submit(entrada.closest("form"));
    await waitFor(() => {
      const llamada = solicitarApi.mock.calls.find(([, opciones]) => opciones?.method === "POST");
      expect(JSON.parse(llamada[1].body).password).toBe(password);
    });
  });

  it("rechaza una clave debil al editar pero permite dejarla vacia", async () => {
    const user = userEvent.setup();
    render(<PaginaRegistroUsuarios />);
    const fila = (await screen.findByText("Ana Perez")).closest("tr");
    await user.click(within(fila).getByRole("button", { name: "Editar" }));
    const entrada = await screen.findByLabelText("Contraseña (opcional)");
    fireEvent.change(entrada, { target: { value: "abcdefghijk" } });
    fireEvent.submit(entrada.closest("form"));
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "PUT")).toBe(false);
    fireEvent.change(entrada, { target: { value: "" } });
    fireEvent.submit(entrada.closest("form"));
    await waitFor(() => {
      const llamada = solicitarApi.mock.calls.find(([, opciones]) => opciones?.method === "PUT");
      expect(JSON.parse(llamada[1].body).password).toBeUndefined();
    });
  });

  it("crea un funcionario con dependencia y carga la lista desde respuesta.usuarios", async () => {
    const user = userEvent.setup();
    render(<PaginaRegistroUsuarios />);

    await screen.findByText("Ana Perez");
    await user.type(screen.getByLabelText("Nombre completo *"), "Luis Díaz");
    await user.type(
      screen.getByLabelText("Correo electrónico *"),
      "luis@example.com",
    );
    await user.type(
      screen.getByLabelText("Contraseña *"),
      "Una-clave-larga-123",
    );
    await user.selectOptions(
      screen.getByLabelText("Rol en el sistema *"),
      "funcionario",
    );
    await user.selectOptions(
      screen.getByLabelText("Dependencia asignada"),
      "2",
    );
    await user.click(screen.getByRole("button", { name: "Registrar usuario" }));

    await waitFor(() => {
      expect(solicitarApi).toHaveBeenCalledWith(
        "/api/usuarios",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            nombre: "Luis Díaz",
            email: "luis@example.com",
            rol: "funcionario",
            dependencia_id: 2,
            password: "Una-clave-larga-123",
          }),
        }),
      );
    });
    expect(await screen.findByText("Usuario creado.")).toBeTruthy();
  });

  it("edita un usuario sin enviar contraseña vacía", async () => {
    const user = userEvent.setup();
    render(<PaginaRegistroUsuarios />);
    const filaAna = await screen.findByText("Ana Perez");
    await user.click(
      within(filaAna.closest("tr")).getByRole("button", { name: "Editar" }),
    );

    expect(await screen.findByDisplayValue("ana@example.com")).toBeTruthy();
    const drawer = within(screen.getByRole("dialog", { name: "Editar usuario" }));
    expect(drawer.getByLabelText("Contraseña (opcional)").value).toBe("");
    await user.clear(drawer.getByLabelText("Nombre completo *"));
    await user.type(drawer.getByLabelText("Nombre completo *"), "Ana Pérez");
    await user.click(drawer.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      const llamada = solicitarApi.mock.calls.find(
        ([ruta, opciones]) =>
          ruta === "/api/usuarios/53" && opciones?.method === "PUT",
      );
      expect(llamada).toBeTruthy();
      const datosEnviados = JSON.parse(llamada[1].body);
      expect(datosEnviados.nombre).toBe("Ana Pérez");
      expect(datosEnviados).not.toHaveProperty("password");
    });
  });

  it.each(["Cerrar edición", "Cancelar edición", "Escape"])("cierra con %s y conserva el borrador de alta y el foco de origen", async cierre => {
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    const fila = (await screen.findByText("Ana Perez")).closest("tr");
    const registro = within(screen.getByRole("region", { name: "Registrar usuario" }));
    fireEvent.change(registro.getByLabelText("Nombre completo *"), { target: { value: "Borrador de alta" } });
    fireEvent.change(registro.getByLabelText("Contraseña *"), { target: { value: "Borrador-seguro-123" } });
    const editar = within(fila).getByRole("button", { name: "Editar" });
    await user.click(editar);
    const dialogo = screen.getByRole("dialog", { name: "Editar usuario" });
    await within(dialogo).findByDisplayValue("ana@example.com");
    expect(document.activeElement).toBe(within(dialogo).getByRole("heading", { name: "Editar usuario" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.change(within(dialogo).getByLabelText("Nombre completo *"), { target: { value: "Edición descartada" } });
    if (cierre === "Escape") fireEvent(dialogo, new Event("cancel", { cancelable: true }));
    else await user.click(within(dialogo).getByRole("button", { name: cierre }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(editar);
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(registro.getByLabelText("Nombre completo *").value).toBe("Borrador de alta");
    expect(registro.getByLabelText("Contraseña *").value).toBe("Borrador-seguro-123");
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "PUT")).toBe(false);
  });

  it("descarta una carga tardía tras cerrar y abrir otra cuenta", async () => {
    const base = solicitarApi.getMockImplementation();
    let resolverAnterior;
    configurarApiGestion({ lista: [funcionario, { ...funcionario, id: 54, nombre: "Otra cuenta", email: "otra@example.com" }] });
    const listado = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (ruta === "/api/usuarios/53") return new Promise(resolve => { resolverAnterior = resolve; });
      if (ruta === "/api/usuarios/54") return Promise.resolve(respuestaJson({
        usuario: { ...funcionario, id: 54, nombre: "Otra cuenta", email: "otra@example.com" },
      }));
      return ruta === "/api/usuarios" ? listado(ruta, opciones) : base(ruta, opciones);
    });
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    await user.click(within((await screen.findByText("Ana Perez")).closest("tr")).getByRole("button", { name: "Editar" }));
    expect(within(screen.getByRole("dialog")).getByText("Cargando los datos del usuario…")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cerrar edición" }));
    await user.click(within(screen.getByText("Otra cuenta").closest("tr")).getByRole("button", { name: "Editar" }));
    await within(screen.getByRole("dialog")).findByDisplayValue("otra@example.com");
    await act(async () => resolverAnterior(respuestaJson({ usuario: funcionario })));
    expect(within(screen.getByRole("dialog")).getByLabelText("Correo electrónico *").value).toBe("otra@example.com");
  });

  it("muestra el error de carga dentro del drawer y permite cerrarlo", async () => {
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => ruta === "/api/usuarios/53"
      ? Promise.reject(new Error("No se pudo consultar la cuenta.")) : base(ruta, opciones));
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    await user.click(within((await screen.findByText("Ana Perez")).closest("tr")).getByRole("button", { name: "Editar" }));
    const drawer = within(screen.getByRole("dialog"));
    expect(await drawer.findByText("No se pudo consultar la cuenta.")).toBeTruthy();
    expect(drawer.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    await user.click(drawer.getByRole("button", { name: "Cerrar edición" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("rechaza datos de una cuenta distinta a la solicitada sin habilitar el guardado", async () => {
    const base = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => ruta === "/api/usuarios/53"
      ? Promise.resolve(respuestaJson({ usuario: { ...funcionario, id: 54 } })) : base(ruta, opciones));
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    await user.click(within((await screen.findByText("Ana Perez")).closest("tr")).getByRole("button", { name: "Editar" }));
    const drawer = within(screen.getByRole("dialog"));
    expect(await drawer.findByText("La respuesta no incluye los datos del usuario solicitado.")).toBeTruthy();
    expect(drawer.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
  });

  it("mantiene el ciclo de foco y limpia el bloqueo de scroll también en StrictMode", async () => {
    const user = userEvent.setup({ delay: null });
    render(<StrictMode><PaginaRegistroUsuarios /></StrictMode>);
    const editar = within((await screen.findByText("Ana Perez")).closest("tr")).getByRole("button", { name: "Editar" });
    await user.click(editar);
    const panel = screen.getByRole("dialog");
    const drawer = within(panel);
    await drawer.findByDisplayValue("ana@example.com");
    const cerrar = drawer.getByRole("button", { name: "Cerrar edición" });
    const cancelar = drawer.getByRole("button", { name: "Cancelar edición" });
    cancelar.focus();
    fireEvent.keyDown(cancelar, { key: "Tab" });
    expect(document.activeElement).toBe(cerrar);
    fireEvent.keyDown(cerrar, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancelar);
    await user.click(cerrar);
    expect(document.activeElement).toBe(editar);
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("informa que el PUT se guardó si falla la recarga posterior, sin repetir la edición", async () => {
    const base = solicitarApi.getMockImplementation();
    let guardado = false;
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (opciones?.method === "PUT") guardado = true;
      if (ruta === "/api/usuarios" && guardado) return Promise.reject(new Error("Sin conexión para consultar usuarios."));
      return base(ruta, opciones);
    });
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    await user.click(within((await screen.findByText("Ana Perez")).closest("tr")).getByRole("button", { name: "Editar" }));
    const drawer = within(screen.getByRole("dialog"));
    await drawer.findByDisplayValue("ana@example.com");
    await user.click(drawer.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const aviso = screen.getByText(/Los cambios se guardaron, pero no se pudo actualizar la lista/);
    expect(aviso.textContent).toContain("Sin conexión para consultar usuarios.");
    expect(aviso.getAttribute("data-state")).toBe("error");
    expect(solicitarApi.mock.calls.filter(([, opciones]) => opciones?.method === "PUT")).toHaveLength(1);
  });

  it("conserva la edición ante fallo de PUT y permite reintentar sin borrar el alta", async () => {
    const base = solicitarApi.getMockImplementation();
    let fallar = true;
    solicitarApi.mockImplementation((ruta, opciones) => opciones?.method === "PUT" && fallar
      ? Promise.reject(new Error("Correo ya registrado.")) : base(ruta, opciones));
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    const registro = within(await screen.findByRole("region", { name: "Registrar usuario" }));
    fireEvent.change(registro.getByLabelText("Nombre completo *"), { target: { value: "Alta sin terminar" } });
    await user.click(within((await screen.findByText("Ana Perez")).closest("tr")).getByRole("button", { name: "Editar" }));
    const drawer = within(screen.getByRole("dialog"));
    await drawer.findByDisplayValue("ana@example.com");
    fireEvent.change(drawer.getByLabelText("Nombre completo *"), { target: { value: "Ana editada" } });
    await user.click(drawer.getByRole("button", { name: "Guardar cambios" }));
    expect(await drawer.findByText("Correo ya registrado.")).toBeTruthy();
    expect(drawer.getByLabelText("Nombre completo *").value).toBe("Ana editada");
    fallar = false;
    await user.click(drawer.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Usuario actualizado.")).toBeTruthy();
    expect(registro.getByLabelText("Nombre completo *").value).toBe("Alta sin terminar");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Editar" }));
  });

  it("bloquea Escape, cierres y envíos repetidos durante el guardado", async () => {
    const base = solicitarApi.getMockImplementation();
    let resolverGuardado;
    solicitarApi.mockImplementation((ruta, opciones) => opciones?.method === "PUT"
      ? new Promise(resolve => { resolverGuardado = () => resolve(base(ruta, opciones)); })
      : base(ruta, opciones));
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    await user.click(within((await screen.findByText("Ana Perez")).closest("tr")).getByRole("button", { name: "Editar" }));
    const panel = screen.getByRole("dialog");
    const drawer = within(panel);
    await drawer.findByDisplayValue("ana@example.com");
    const form = drawer.getByRole("button", { name: "Guardar cambios" }).closest("form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent(panel, new Event("cancel", { cancelable: true }));
    expect(drawer.getByRole("button", { name: "Cerrar edición" }).disabled).toBe(true);
    expect(drawer.getByRole("button", { name: "Cancelar edición" }).disabled).toBe(true);
    expect(drawer.getByRole("button", { name: "Guardando…" }).disabled).toBe(true);
    expect(drawer.getByLabelText("Nombre completo *").closest("fieldset").disabled).toBe(true);
    expect(solicitarApi.mock.calls.filter(([, opciones]) => opciones?.method === "PUT")).toHaveLength(1);
    await act(async () => resolverGuardado());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("valida la contraseña opcional y conserva los valores internos de rol y dependencia", async () => {
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    await user.click(within((await screen.findByText("Ana Perez")).closest("tr")).getByRole("button", { name: "Editar" }));
    const drawer = within(screen.getByRole("dialog"));
    await drawer.findByDisplayValue("ana@example.com");
    const password = drawer.getByLabelText("Contraseña (opcional)");
    fireEvent.change(password, { target: { value: "invalida" } });
    fireEvent.submit(password.closest("form"));
    expect(drawer.getByRole("status").textContent).toBe(POLITICA_CONTRASENA);
    expect(solicitarApi.mock.calls.some(([, opciones]) => opciones?.method === "PUT")).toBe(false);
    fireEvent.change(password, { target: { value: "Nueva-clave-123" } });
    await user.selectOptions(drawer.getByLabelText("Rol en el sistema *"), "ventanilla");
    expect(drawer.getByLabelText("Dependencia asignada").value).toBe("");
    expect(drawer.getByLabelText("Dependencia asignada").disabled).toBe(true);
    await user.click(drawer.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(solicitarApi).toHaveBeenCalledWith("/api/usuarios/53", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ nombre: "Ana Perez", email: "ana@example.com",
        rol: "ventanilla", dependencia_id: null, password: "Nueva-clave-123" }),
    })));
  });

  it("mantiene el cierre de sesión al editar la propia cuenta", async () => {
    const reemplazar = simularRedireccion();
    configurarApiGestion({ lista: [{ ...administrador, email: "admin@example.com", activo: 1 }] });
    const lista = solicitarApi.getMockImplementation();
    solicitarApi.mockImplementation((ruta, opciones) => ruta === "/api/usuarios/1"
      ? Promise.resolve(respuestaJson(opciones?.method === "PUT"
        ? { success: true } : { usuario: { ...administrador, email: "admin@example.com" } }))
      : lista(ruta, opciones));
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    await user.click(within((await screen.findByText("admin@example.com")).closest("tr")).getByRole("button", { name: "Editar" }));
    const drawer = within(screen.getByRole("dialog"));
    await drawer.findByDisplayValue("admin@example.com");
    await user.click(drawer.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(reemplazar).toHaveBeenCalledWith("login.html"));
    expect(limpiarSesion).toHaveBeenCalledOnce();
  });

  it("vuelve a Actualizar lista si desaparece la fila tras guardar", async () => {
    const base = solicitarApi.getMockImplementation();
    let guardado = false;
    solicitarApi.mockImplementation((ruta, opciones) => {
      if (opciones?.method === "PUT") guardado = true;
      if (ruta === "/api/usuarios" && guardado) return Promise.resolve(respuestaJson({ usuarios: [] }));
      return base(ruta, opciones);
    });
    const user = userEvent.setup({ delay: null });
    render(<PaginaRegistroUsuarios />);
    await user.click(within((await screen.findByText("Ana Perez")).closest("tr")).getByRole("button", { name: "Editar" }));
    const drawer = within(screen.getByRole("dialog"));
    await drawer.findByDisplayValue("ana@example.com");
    await user.click(drawer.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actualizar lista" }));
  });

  it("inactiva solo después de confirmación del servidor y deshabilita la propia cuenta admin", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    configurarApiGestion({
      lista: [
        { ...administrador, email: "admin@example.com", activo: 1 },
        funcionario,
      ],
    });
    render(<PaginaRegistroUsuarios />);

    const filaAdmin = await screen.findByText("admin@example.com");
    expect(
      within(filaAdmin.closest("tr")).getByRole("button", {
        name: "Inactivar",
      }).disabled,
    ).toBe(true);

    const filaAna = screen.getByText("Ana Perez").closest("tr");
    await user.click(
      within(filaAna).getByRole("button", { name: "Inactivar" }),
    );

    await waitFor(() => {
      expect(solicitarApi).toHaveBeenCalledWith(
        "/api/usuarios/53/estado",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ activo: 0 }),
        }),
      );
      expect(within(filaAna).getByText("Inactivo")).toBeTruthy();
    });
  });
});
