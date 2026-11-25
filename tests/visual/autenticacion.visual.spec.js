import { test, expect } from "@playwright/test";
import {
  ADMIN_USER,
  assertAllowedCalls,
  assertNoHorizontalOverflow,
  assertVisibleFocus,
  assertWithinViewport,
  mockApi,
} from "./fixtures.js";

test("login conserva formulario, foco y ausencia de overflow", async ({ page }) => {
  const calls = await mockApi(page, { user: ADMIN_USER });
  await page.goto("/login.html");
  await expect(page.getByRole("heading", { name: "Bienvenido de nuevo" })).toBeVisible();
  const form = page.locator(".auth-form");
  await expect(form).toBeVisible();
  await assertWithinViewport(page, form);
  await assertVisibleFocus(page, page.getByLabel("Correo electrónico"));
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, [/^GET \/api\/auth\/me$/]);
});

test("gestión de usuarios conserva tabla, controles y foco", async ({ page }) => {
  const calls = await mockApi(page, { user: ADMIN_USER });
  await page.goto("/registro_usuario.html");
  await expect(page.getByRole("heading", { name: "Gestión de usuarios" })).toBeVisible();
  await expect(page.locator("#tabla-usuarios")).toBeVisible();
  await assertWithinViewport(page, page.locator("#tabla-usuarios"));
  await assertVisibleFocus(page, page.getByRole("button", { name: "Registrar usuario" }));
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, [/^GET \/api\/auth\/me$/, /^GET \/api\/usuarios(?:\?.*)?$/, /^GET \/api\/dependencias(?:\?.*)?$/]);
});

test("catálogos conserva pestañas, tabla y formulario", async ({ page }) => {
  const calls = await mockApi(page, { user: ADMIN_USER });
  await page.goto("/catalogos.html");
  await expect(page.getByRole("heading", { name: "Gestión de catálogos" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Dependencias/ })).toBeVisible();
  await expect(page.locator("#tabla-catalogos")).toBeVisible();
  await assertWithinViewport(page, page.locator("#tabla-catalogos"));
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, [/^GET \/api\/auth\/me$/, /^GET \/api\/dependencias(?:\?.*)?$/, /^GET \/api\/tipos-tramite(?:\?.*)?$/]);
});

test("estado de sesión no disponible muestra error accesible", async ({ page }) => {
  const calls = await mockApi(page, { sessionError: true });
  await page.goto("/registro_usuario.html");
  await expect(page.locator('[data-state="error"]')).toContainText("Sesión visual no disponible");
  await assertNoHorizontalOverflow(page);
  assertAllowedCalls(calls, [/^GET \/api\/auth\/me$/]);
});
