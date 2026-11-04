import { beforeEach, expect, it, vi } from "vitest";
import { guardarSesion, solicitarApi } from "../../src/servicios/api.js";

beforeEach(() => {
  sessionStorage.clear();
  guardarSesion("token-ficticio", { id: 7, rol: "ventanilla" });
});

it("conserva la clave del intento junto con la autenticación y el FormData", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ success: true, radicado: "RAD-FICTICIO" }),
    { headers: { "content-type": "application/json" } },
  ));
  vi.stubGlobal("fetch", fetchMock);
  const body = new FormData();
  body.append("asunto_documento", "Ficticio");
  const respuesta = await solicitarApi("/api/radicados", {
    method: "POST", headers: { "Idempotency-Key": "clave-ficticia" }, body,
  });
  const [, opciones] = fetchMock.mock.calls[0];
  expect(opciones.headers.get("Idempotency-Key")).toBe("clave-ficticia");
  expect(opciones.headers.get("Authorization")).toBe("Bearer token-ficticio");
  expect(opciones.body).toBe(body);
  expect(await respuesta.json()).toEqual({ success: true, radicado: "RAD-FICTICIO" });
});

it("marca como incierto un fallo de transporte sin inventar éxito", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Conexión perdida")));
  await expect(solicitarApi("/api/radicados", { method: "POST" }))
    .rejects.toMatchObject({ resultadoIncierto: true, message: expect.stringContaining("Conexión perdida") });
});

it("marca como incierta una confirmación JSON ilegible", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{", {
    headers: { "content-type": "application/json" },
  })));
  await expect(solicitarApi("/api/radicados", { method: "POST" }))
    .rejects.toMatchObject({ resultadoIncierto: true, message: expect.stringContaining("interpretar") });
});

it.each([409, 422, 503])("conserva el código HTTP %s y su mensaje para decidir el reintento", async (status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ success: false, message: "Rechazo explícito" }),
    { status, headers: { "content-type": "application/json" } },
  )));
  await expect(solicitarApi("/api/radicados", { method: "POST" }))
    .rejects.toMatchObject({ status, message: "Rechazo explícito" });
});
