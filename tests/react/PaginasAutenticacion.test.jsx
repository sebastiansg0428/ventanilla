import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaginaInicioSesion } from "../../src/paginas/PaginasAutenticacion.jsx";
import { guardarSesion, solicitarApi } from "../../src/servicios/api.js";

vi.mock("../../src/servicios/api.js", () => ({
  guardarSesion: vi.fn(),
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

describe("inicio de sesión React", () => {
  beforeEach(() => {
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
});
