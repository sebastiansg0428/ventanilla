import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumenTraslados } from "../../src/componentes/ResumenTraslados";
import { solicitarApi } from "../../src/servicios/api";

vi.mock("../../src/servicios/api", () => ({ solicitarApi: vi.fn() }));
const respuesta = (total = 0, visitadas = []) => ({ json: async () => ({ success: true, resumen: {
  total_aprobados: total, umbral_reiteracion: 3, dependencias_visitadas_ids: visitadas,
} }) });
function diferida() {
  let resolve;
  const promise = new Promise((ok) => { resolve = ok; });
  return { promise, resolve };
}
beforeEach(() => vi.resetAllMocks());

describe("antecedentes de traslados", () => {
  it.each([0, 1, 2, 3, 35])("advierte desde el tercer movimiento propuesto con %i aprobados previos", async (total) => {
    solicitarApi.mockResolvedValue(respuesta(total, [3]));
    render(<ResumenTraslados numero="RAD-001" destino="4" prospectivo />);
    expect(await screen.findByText(String(total), { selector: "strong" })).toBeTruthy();
    expect(Boolean(screen.queryByText("Reiteración de traslados."))).toBe(total >= 2);
    if (total >= 2) expect(screen.getByText(new RegExp(`sería el traslado número ${total + 1}`))).toBeTruthy();
    expect(screen.queryByText("Regreso a una dependencia anterior.")).toBeNull();
  });

  it("recalcula devolución por ID sin recargar, incluida oficina inicial e intermedia", async () => {
    solicitarApi.mockResolvedValue(respuesta(2, [3, 4, 5]));
    const vista = render(<ResumenTraslados numero="RAD-001" destino="4" prospectivo />);
    await screen.findByText("Regreso a una dependencia anterior.");
    expect(screen.getByText("Reiteración de traslados.")).toBeTruthy();
    vista.rerender(<ResumenTraslados numero="RAD-001" destino="5" prospectivo />);
    expect(screen.getByText("Regreso a una dependencia anterior.")).toBeTruthy();
    vista.rerender(<ResumenTraslados numero="RAD-001" destino="9" prospectivo />);
    expect(screen.queryByText("Regreso a una dependencia anterior.")).toBeNull();
    vista.rerender(<ResumenTraslados numero="RAD-001" destino="" prospectivo />);
    expect(screen.queryByText("Regreso a una dependencia anterior.")).toBeNull();
    expect(solicitarApi).toHaveBeenCalledTimes(1);
  });

  it("muestra solo contador al rechazar o consultar detalle", async () => {
    solicitarApi.mockResolvedValue(respuesta(35, [3]));
    const vista = render(<ResumenTraslados numero="RAD-001" destino="3" prospectivo />);
    await screen.findByText("Reiteración de traslados.");
    vista.rerender(<ResumenTraslados numero="RAD-001" destino="3" prospectivo={false} />);
    expect(screen.getByText("35", { selector: "strong" })).toBeTruthy();
    expect(screen.queryByText("Reiteración de traslados.")).toBeNull();
    expect(screen.queryByText("Regreso a una dependencia anterior.")).toBeNull();
  });

  it("distingue carga y error de cero, permite reintento sin bloquear decisiones", async () => {
    const lenta = diferida();
    solicitarApi.mockReturnValueOnce(lenta.promise).mockResolvedValueOnce(respuesta(2, [4]));
    render(<ResumenTraslados numero="RAD-001" destino="4" prospectivo />);
    expect(screen.getByRole("status").textContent).toBe("Consultando antecedentes de traslados…");
    await act(async () => lenta.resolve({ json: async () => { throw new Error("Servicio no disponible"); } }));
    expect(screen.getByRole("alert").textContent).toContain("Servicio no disponible");
    expect(screen.queryByText(/Traslados aprobados registrados:/)).toBeNull();
    expect(screen.getByText(/Puedes continuar/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar antecedentes de traslados" }));
    await screen.findByText("Regreso a una dependencia anterior.");
    expect(solicitarApi).toHaveBeenCalledTimes(2);
  });

  it.each([
    { success: false }, { success: true, resumen: { total_aprobados: 0 } },
    { success: true, resumen: { total_aprobados: -1, umbral_reiteracion: 3, dependencias_visitadas_ids: [] } },
    { success: true, resumen: { total_aprobados: 0, umbral_reiteracion: 3, dependencias_visitadas_ids: ["4"] } },
  ])("no oculta un contrato inválido como cero aprobaciones: %j", async (resultado) => {
    solicitarApi.mockResolvedValue({ json: async () => resultado });
    render(<ResumenTraslados numero="RAD-001" />);
    expect((await screen.findByRole("alert")).textContent).toContain("inválida");
    expect(screen.queryByText(/Traslados aprobados registrados:/)).toBeNull();
  });

  it("ignora resultados tardíos al cambiar expediente o desmontar", async () => {
    const lenta = diferida();
    solicitarApi.mockReturnValueOnce(lenta.promise).mockResolvedValueOnce(respuesta(1, [9]));
    const vista = render(<ResumenTraslados numero="RAD-001" destino="4" prospectivo />);
    vista.rerender(<ResumenTraslados numero="RAD-002" destino="4" prospectivo />);
    await screen.findByText("1", { selector: "strong" });
    await act(async () => lenta.resolve(respuesta(35, [4])));
    expect(screen.getByText("1", { selector: "strong" })).toBeTruthy();
    expect(screen.queryByText("Regreso a una dependencia anterior.")).toBeNull();
    expect(solicitarApi.mock.calls.map(([ruta]) => ruta)).toEqual([
      "/api/radicados/RAD-001/traslados/resumen", "/api/radicados/RAD-002/traslados/resumen",
    ]);
    const final = diferida();
    solicitarApi.mockReturnValueOnce(final.promise);
    vista.rerender(<ResumenTraslados numero="RAD-003" />);
    vista.unmount();
    await act(async () => final.resolve(respuesta(9, [4])));
    await waitFor(() => expect(screen.queryByLabelText("Antecedentes de traslados")).toBeNull());
  });
});
