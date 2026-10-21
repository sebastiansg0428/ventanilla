import { afterEach, expect, it, vi } from "vitest";
import { crearPdfComprobante } from "../../src/servicios/comprobante.js";

afterEach(() => vi.unstubAllGlobals());

it.each(["Planeación histórica", null])("incluye el origen interno guardado %s y pagina asuntos largos", (origen) => {
  let paginas = 1;
  const textos = [];
  const pdf = {
    setFont() {}, setFontSize() {}, setTextColor() {}, setFillColor() {},
    rect() {}, line() {}, setPage() {},
    text(texto, x, y) { textos.push({ texto, y }); },
    splitTextToSize: (texto) => texto.split("\n"),
    addPage() { paginas++; },
    getNumberOfPages: () => paginas,
  };
  vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });
  expect(crearPdfComprobante({
    tipo_comunicacion: "Interna", dependencia_remitente: origen,
    asunto_documento: Array(90).fill("Línea del asunto").join("\n"),
  })).toBe(pdf);
  expect(textos.some(({ texto }) => texto === `• Dependencia Remitente: ${origen || "No registrada"}`)).toBe(true);
  expect(paginas).toBeGreaterThan(1);
  expect(textos.filter(({ texto }) => texto === "Línea del asunto").every(({ y }) => y <= 255)).toBe(true);
});

it("incluye clasificación jurídica, razón social, NIT y correo sin origen interno", () => {
  const textos = [];
  const pdf = {
    setFont() {}, setFontSize() {}, setTextColor() {}, setFillColor() {},
    rect() {}, line() {}, setPage() {},
    text(texto) { textos.push(texto); },
    splitTextToSize: (texto) => [texto],
    getNumberOfPages: () => 1,
  };
  vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });
  crearPdfComprobante({
    tipo_comunicacion: "Externa", remitente_tipo_persona: "juridica",
    remitente_entidad: "Empresa", remitente_nit: "123", remitente_email: "a@example.com",
    dependencia_remitente: "No corresponde",
  });
  expect(textos).toEqual(expect.arrayContaining([
    "• Tipo de Persona: Jurídica", "• Entidad / Razón Social: Empresa",
    "• NIT: 123", "• Correo: a@example.com",
  ]));
  expect(textos.some((texto) => texto.includes("Dependencia Remitente"))).toBe(false);
});
