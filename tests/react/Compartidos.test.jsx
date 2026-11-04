import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CeldaAdaptable, EncabezadoAplicacion } from "../../src/componentes/Compartidos.jsx";

it.each([
  ["administrador", "radicar"],
  ["administrador", "consultar"],
  ["administrador", "usuarios"],
  ["administrador", "catalogos"],
  ["ventanilla", "radicar"],
  ["funcionario", "consultar"],
])("muestra escudo accesible sin alterar navegación para %s en %s", (rol, pantallaActual) => {
  render(
    <EncabezadoAplicacion
      usuario={{ nombre: "María del Carmen Apellidos de prueba", rol }}
      pantallaActual={pantallaActual}
    />,
  );
  const escudo = screen.getByRole("img", { name: "Escudo del municipio de Miranda" });
  expect(escudo.getAttribute("src")).toBe(`${import.meta.env.BASE_URL}img/escudo-miranda.png`);
  expect(escudo.getAttribute("width")).toBe("350");
  expect(escudo.getAttribute("height")).toBe("355");
  expect(escudo.closest("header")).toBe(screen.getByRole("banner"));
  expect(screen.getByRole("heading", { name: "Alcaldía Municipal" })).toBeTruthy();
  expect(screen.getByText("María del Carmen Apellidos de prueba")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Radicar documento" }) !== null).toBe(rol !== "funcionario");
  expect(screen.queryByRole("link", { name: "Gestión de usuarios" }) !== null).toBe(rol === "administrador");
  expect(screen.queryByRole("link", { name: "Gestión de catálogos" }) !== null).toBe(rol === "administrador");
  expect(screen.getByRole("navigation").querySelector('[aria-current="page"]')).toBeTruthy();
});

it("abre el menú, expone su estado y lo cierra con Escape devolviendo el foco", () => {
  render(<EncabezadoAplicacion usuario={{ nombre: "Actor", rol: "administrador" }} />);
  const boton = screen.getByRole("button", { name: "Abrir menú" });
  const enlaces = document.getElementById(boton.getAttribute("aria-controls"));
  expect(boton.getAttribute("aria-expanded")).toBe("false");
  expect(enlaces.dataset.abierto).toBe("false");
  fireEvent.click(boton);
  expect(boton.getAttribute("aria-expanded")).toBe("true");
  expect(boton.textContent).toBe("Cerrar menú");
  expect(enlaces.dataset.abierto).toBe("true");
  const consultar = within(enlaces).getByRole("link", { name: "Consultar radicados" });
  consultar.focus();
  fireEvent.keyDown(consultar, { key: "Escape" });
  expect(document.activeElement).toBe(boton);
  expect(boton.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(boton);
  fireEvent.click(boton);
  expect(enlaces.dataset.abierto).toBe("false");
});

it("restablece el menú al cambiar entre móvil y escritorio y limpia su escucha", () => {
  const eventos = new EventTarget();
  const addEventListener = vi.spyOn(eventos, "addEventListener");
  const removeEventListener = vi.spyOn(eventos, "removeEventListener");
  vi.stubGlobal("matchMedia", vi.fn(() => eventos));
  const vista = render(<EncabezadoAplicacion usuario={{ nombre: "Actor", rol: "ventanilla" }} />);
  const boton = screen.getByRole("button", { name: "Abrir menú" });
  fireEvent.click(boton);
  act(() => eventos.dispatchEvent(new Event("change")));
  expect(boton.getAttribute("aria-expanded")).toBe("false");
  vista.unmount();
  expect(removeEventListener).toHaveBeenCalledWith("change", addEventListener.mock.calls[0][1]);
});

it("presenta la etiqueta móvil sin duplicar la acción ni el valor accesible de una celda", () => {
  const accion = vi.fn();
  render(
    <table><thead><tr><th scope="col">Acciones</th></tr></thead><tbody><tr>
      <CeldaAdaptable etiqueta="Acciones"><button onClick={accion}>Editar</button></CeldaAdaptable>
    </tr></tbody></table>,
  );
  expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(1);
  const celda = screen.getByRole("cell", { name: "Editar" });
  expect(celda.querySelector(".tarjeta-etiqueta").getAttribute("aria-hidden")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  expect(accion).toHaveBeenCalledTimes(1);
});
