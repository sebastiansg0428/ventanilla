import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaginaConsultaRadicados } from "../../src/paginas/ConsultaRadicados.jsx";
import { confirmarSesion, solicitarApi } from "../../src/servicios/api.js";

vi.mock("../../src/servicios/api.js", () => ({
  confirmarSesion: vi.fn(),
  solicitarApi: vi.fn(),
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
  await screen.findByRole("button", { name: "RAD-001" });
  await screen.findByRole("button", { name: "RAD-002" });
  await screen.findByRole("button", { name: "RAD-003" });
}

function simularAlerta() {
  const alertar = vi.fn();
  const ventanaPrueba = Object.create(window);
  Object.defineProperty(ventanaPrueba, "alert", { value: alertar });
  vi.stubGlobal("window", ventanaPrueba);
  return alertar;
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

  it("combina filtros, permite quitarlos por badge y reinicia todo con Total", async () => {
    const user = userEvent.setup();
    await abrirConsulta();

    await user.click(screen.getByRole("button", { name: /Registrados hoy/ }));
    expect(screen.getByRole("button", { name: "RAD-001" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "RAD-002" })).toBeNull();
    expect(screen.getByRole("button", { name: "RAD-003" })).toBeTruthy();
    expect(
      screen.getByText("Mostrando 2 de 3. Hay filtros activos."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Quitar filtro Fecha: hoy/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Registrados hoy/ }));

    await user.type(
      screen.getByRole("textbox", { name: "Buscar radicados" }),
      "garcia",
    );
    await user.selectOptions(
      screen.getByLabelText("Tipo de comunicación"),
      "externa",
    );
    await user.click(screen.getByRole("button", { name: /Críticos/ }));

    expect(screen.getByRole("button", { name: "RAD-001" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "RAD-002" })).toBeNull();
    expect(screen.queryByRole("button", { name: "RAD-003" })).toBeNull();
    expect(
      screen.getByText("Mostrando 1 de 3. Hay filtros activos."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Quitar filtro Críticos: alerta y vencido/ }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Quitar filtro Tipo: Externa/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Quitar filtro Búsqueda: garcia/ })).toBeTruthy();

    await user.click(
      screen.getByRole("button", { name: /Quitar filtro Búsqueda: garcia/ }),
    );
    expect(screen.getByRole("button", { name: "RAD-001" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "RAD-003" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Total/ }));

    expect(screen.getByRole("button", { name: "RAD-001" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "RAD-002" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "RAD-003" })).toBeTruthy();
    expect(
      screen.getByText("Mostrando 3 de 3. Sin filtros activos."),
    ).toBeTruthy();
  });

  it("envía un cambio de estado y muestra el estado confirmado por el servidor", async () => {
    const user = userEvent.setup();
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
    const user = userEvent.setup();
    await abrirConsulta();
    const selectorEstado = screen.getByRole("combobox", {
      name: "Estado de RAD-001",
    });

    await user.selectOptions(selectorEstado, "Respondido");

    await waitFor(() => expect(selectorEstado.value).toBe("Recibido"));
    expect(alertar).toHaveBeenCalledWith("No se pudo guardar el estado.");
  });
});
