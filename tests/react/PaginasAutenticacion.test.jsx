import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(screen.getByLabelText("Contraseña (opcional)").value).toBe("");
    await user.clear(screen.getByLabelText("Nombre completo *"));
    await user.type(screen.getByLabelText("Nombre completo *"), "Ana Pérez");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

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
