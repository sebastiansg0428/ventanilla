import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { EncabezadoAplicacion } from "../../src/componentes/Compartidos.jsx";

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
