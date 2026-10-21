import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crearPdfComprobante } from "../../src/servicios/comprobante.js";

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
  }));
});

function soporteImagen() {
  return {
    getImageProperties: () => ({ width: 350, height: 355 }),
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    saveGraphicsState() {}, restoreGraphicsState() {}, setGState() {},
    GState: function (estado) { Object.assign(this, estado); },
    addImage() {},
  };
}

it.each(["Planeación histórica", null])("incluye el origen interno guardado %s y pagina asuntos largos", async (origen) => {
  let paginas = 1;
  const textos = [];
  const pdf = {
    ...soporteImagen(),
    setFont() {}, setFontSize() {}, setTextColor() {}, setFillColor() {},
    rect() {}, line() {}, setPage() {},
    text(texto, x, y) { textos.push({ texto, y }); },
    splitTextToSize: (texto) => texto.split("\n"),
    addPage() { paginas++; },
    getNumberOfPages: () => paginas,
  };
  vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });
  expect(await crearPdfComprobante({
    tipo_comunicacion: "Interna", dependencia_remitente: origen,
    asunto_documento: Array(90).fill("Línea del asunto").join("\n"),
  })).toBe(pdf);
  expect(textos.some(({ texto }) => texto === `• Dependencia Remitente: ${origen || "No registrada"}`)).toBe(true);
  expect(paginas).toBeGreaterThan(1);
  expect(textos.filter(({ texto }) => texto === "Línea del asunto").every(({ y }) => y <= 255)).toBe(true);
});

it.each([false, 0, true, undefined])("incluye datos externos y solo imprime la regla explícita sin respuesta (%s)", async (regla) => {
  const textos = [];
  const pdf = {
    ...soporteImagen(),
    setFont() {}, setFontSize() {}, setTextColor() {}, setFillColor() {},
    rect() {}, line() {}, setPage() {},
    text(texto) { textos.push(texto); },
    splitTextToSize: (texto) => [texto],
    getNumberOfPages: () => 1,
  };
  vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });
  await crearPdfComprobante({
    requiere_respuesta: regla,
    tipo_comunicacion: "Externa", remitente_tipo_persona: "juridica",
    remitente_entidad: "Empresa", remitente_nit: "123", remitente_email: "a@example.com",
    dependencia_remitente: "No corresponde",
  });
  expect(textos).toEqual(expect.arrayContaining([
    "• Tipo de Persona: Jurídica", "• Entidad / Razón Social: Empresa",
    "• NIT: 123", "• Correo: a@example.com",
  ]));
  expect(textos.some((texto) => texto.includes("Dependencia Remitente"))).toBe(false);
  expect(textos.some((texto) => texto.includes("No requiere respuesta"))).toBe(regla === false || regla === 0);
});

  it("dibuja una marca centrada al 10 % antes del texto en cada página y restaura opacidad", async () => {
    const eventos = [];
    let pagina = 1;
    let opacidad = 1;
    const pdf = {
      ...soporteImagen(),
      setFont() {}, setFontSize() {}, setTextColor() {}, setFillColor() {},
      rect() {}, line() {}, setPage() {},
      saveGraphicsState() { eventos.push(["guardar", pagina]); },
      setGState(estado) { opacidad = estado.opacity; },
      restoreGraphicsState() { opacidad = 1; eventos.push(["restaurar", pagina]); },
      addImage(...args) { eventos.push(["imagen", pagina, opacidad, ...args]); },
      text() { eventos.push(["texto", pagina, opacidad]); },
      splitTextToSize: texto => texto.split("\n"),
      addPage() { pagina++; },
      getNumberOfPages: () => pagina,
    };
    vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });
    await crearPdfComprobante({ asunto_documento: Array(90).fill("Detalle legible").join("\n") });
    const imagenes = eventos.filter(e => e[0] === "imagen");
    expect(imagenes).toHaveLength(pagina);
    expect(pagina).toBeGreaterThan(1);
    for (let numero = 1; numero <= pagina; numero++) {
      const imagen = imagenes[numero - 1];
      expect(imagen.slice(1, 3)).toEqual([numero, 0.1]);
      expect(imagen[4]).toBe("PNG");
      expect(imagen[5]).toBe(55);
      expect(imagen[6]).toBeCloseTo((297 - 100 * 355 / 350) / 2);
      expect(imagen[7]).toBe(100);
      expect(imagen[8]).toBeCloseTo(100 * 355 / 350);
      const eventosPagina = eventos.filter(e => e[1] === numero);
      expect(eventosPagina.findIndex(e => e[0] === "imagen")).toBeLessThan(eventosPagina.findIndex(e => e[0] === "texto"));
      expect(eventosPagina.filter(e => e[0] === "restaurar")).toHaveLength(1);
    }
    expect(eventos.filter(e => e[0] === "texto").every(e => e[2] === 1)).toBe(true);
    expect(fetch).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}img/escudo-miranda.png`);
  });

  it("rechaza la carga fallida del escudo y permite reintentar sin PDF incompleto", async () => {
    const pdf = { ...soporteImagen(), addImage: vi.fn(), text: vi.fn() };
    vi.stubGlobal("jspdf", { jsPDF: function () { return pdf; } });
    fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(crearPdfComprobante({})).rejects.toThrow(/escudo institucional.*404/);
    expect(pdf.addImage).not.toHaveBeenCalled();
    expect(pdf.text).not.toHaveBeenCalled();
    fetch.mockRejectedValueOnce(new Error("Sin conexión"));
    await expect(crearPdfComprobante({})).rejects.toThrow("Sin conexión");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
