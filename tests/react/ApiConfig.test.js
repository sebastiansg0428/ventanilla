import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  sessionStorage.setItem(
    "ventanilla.sesion",
    JSON.stringify({ token: "token-ficticio", usuario: { id: 7 } }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function solicitarConBaseConfigurada(valor) {
  if (valor !== undefined) vi.stubEnv("VITE_API_URL", valor);
  const { solicitarApi } = await import("../../src/servicios/api.js");
  const fetchMock = vi.fn().mockResolvedValue(new Response(
    JSON.stringify({ success: true }),
    { headers: { "content-type": "application/json" } },
  ));
  vi.stubGlobal("fetch", fetchMock);
  await solicitarApi("/api/auth/me");
  return fetchMock.mock.calls[0][0];
}

it("usa VITE_API_URL como base de las solicitudes", async () => {
  const url = await solicitarConBaseConfigurada("https://api.ejemplo.test");
  expect(url.toString()).toBe("https://api.ejemplo.test/api/auth/me");
});

it("conserva localhost:3000 cuando VITE_API_URL no está definida", async () => {
  const url = await solicitarConBaseConfigurada(undefined);
  expect(url.toString()).toBe("http://localhost:3000/api/auth/me");
});
