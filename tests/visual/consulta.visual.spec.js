import { test, expect } from "@playwright/test";
import {
  ADMIN_USER,
  FUNCIONARIO_USER,
  assertAllowedCalls,
  assertNoHorizontalOverflow,
  assertVisibleFocus,
  assertWithinViewport,
  mockApi,
} from "./fixtures.js";

const CONSULTA_CALLS = [
  /^GET \/api\/auth\/me$/,
  /^GET \/api\/radicados\?/, 
  /^GET \/api\/dependencias(?:\?.*)?$/,
  /^GET \/api\/alertas\?/,
  /^GET \/api\/traslados(?:\/dependencias|\?).*$/,
  /^GET \/api\/respuestas-internas\?/,
];

test("consulta conserva tarjetas, filtros, tabla y navegación por teclado", async ({ page }) => {
  const calls = await mockApi(page, { user: ADMIN_USER });
  await page.goto("/consultar.html");
  await expect(page.getByRole("heading", { name: "Consultar radicados" })).toBeVisible();
  await expect(page.locator("#tabla-radicados")).toBeVisible();
  await expect(page.locator(".dashboard-cards")).toBeVisible();
  await assertWithinViewport(page, page.locator("#tabla-radicados"));
  await assertVisibleFocus(page, page.getByLabel("Buscar radicados"));
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, CONSULTA_CALLS);
});

test("consulta muestra detalle y permite cerrarlo sin llamadas fuera del contrato", async ({ page }) => {
  const calls = await mockApi(page, { user: ADMIN_USER });
  await page.goto("/consultar.html");
  const detalle = page.getByRole("button", { name: /RAD-20261124-0001/ }).first();
  await expect(detalle).toBeVisible();
  await detalle.click();
  await expect(page.getByRole("dialog", { name: /Detalle del radicado/ })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.getByRole("button", { name: /Cerrar detalle/ }).click();
  await expect(page.getByRole("dialog", { name: /Detalle del radicado/ })).toBeHidden();
  assertAllowedCalls(calls, [
    ...CONSULTA_CALLS,
    /^GET \/api\/radicados\/[^/]+\/documentos$/,
    /^GET \/api\/radicados\/[^/]+\/historial\?/,
    /^GET \/api\/radicados\/[^/]+\/traslados\/resumen$/,
  ]);
});

test("consulta genera y visualiza el comprobante", async ({ page }) => {
  const calls = await mockApi(page, { user: ADMIN_USER });
  await page.goto("/consultar.html");
  await page.getByRole("button", { name: "Ver comprobante" }).first().click();
  const comprobante = page.locator(".receipt-dialog");
  await expect(comprobante).toBeVisible();
  await expect(page.getByTitle("Vista previa del comprobante")).toBeVisible();
  await expect(page.locator(".comprobante-cerrar")).toBeVisible();
  await assertVisibleFocus(page, page.locator(".comprobante-cerrar"), { cycle: false });
  await assertWithinViewport(page, comprobante);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(comprobante).toBeHidden();
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, CONSULTA_CALLS);
});

test("Ventanilla conserva la bandeja abierta después de aprobar un traslado", async ({ page }) => {
  const calls = await mockApi(page, { user: ADMIN_USER, pendingTraslado: true });
  await page.goto("/consultar.html");
  await page.getByRole("button", { name: "Gestionar traslados" }).click();
  await expect(page.getByRole("button", { name: "Resolver traslado" })).toBeVisible();
  await page.getByRole("button", { name: "Resolver traslado" }).click();
  await expect(page.getByRole("form", { name: /Resolver traslado/ })).toBeVisible();
  await page.getByLabel("Justificación de la decisión").fill("La dependencia actual no es competente para continuar el trámite.");
  await page.getByRole("button", { name: "Confirmar decisión" }).click();
  await expect(page.getByText(/Decisión confirmada para RAD-20261124-0001: Aprobada\./)).toBeVisible();
  await expect(page.getByText("Sin traslados pendientes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ocultar traslados" })).toBeVisible();
  await assertWithinViewport(page, page.locator("#bandeja-traslados"));
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, [
    /^GET \/api\/auth\/me$/,
    /^GET \/api\/radicados\?/,
    /^GET \/api\/dependencias(?:\?.*)?$/,
    /^GET \/api\/alertas\?/,
    /^GET \/api\/traslados(?:\/dependencias|\?).*$/,
    /^GET \/api\/radicados\/[^/]+\/traslados\/resumen$/,
    /^POST \/api\/traslados\/\d+\/decision$/,
    /^GET \/api\/respuestas-internas\?/,
  ]);
});

test("consulta mantiene la insignia previa de respuestas sin abrir", async ({ page }) => {
  const calls = await mockApi(page, { user: FUNCIONARIO_USER, pendingInternas: 2 });
  await page.goto("/consultar.html");
  const pestaña = page.getByRole("tab", { name: /Respuestas internas/ });
  await expect(pestaña).toContainText("2 nuevas");
  await expect(pestaña).toHaveAccessibleName(/2 respuestas internas sin abrir/);
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, CONSULTA_CALLS);
});

test("consulta conserva el estado vacío con mensaje visible", async ({ page }) => {
  const calls = await mockApi(page, { user: ADMIN_USER, emptyRadicados: true });
  await page.goto("/consultar.html");
  await expect(page.locator("#tabla-radicados")).toBeVisible();
  await expect(page.locator("#tabla-radicados")).toContainText(/no hay|sin resultados|no se encontraron/i);
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, CONSULTA_CALLS);
});

test("consulta conserva el estado de error con mensaje visible", async ({ page }) => {
  const calls = await mockApi(page, { user: ADMIN_USER, errorRadicados: true });
  await page.goto("/consultar.html");
  await expect(page.getByRole("status").filter({ hasText: "Error visual de consulta" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, CONSULTA_CALLS);
});
