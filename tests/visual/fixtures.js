import { expect } from "@playwright/test";

export const ADMIN_USER = {
  id: 1,
  nombre: "Administrador Visual",
  email: "admin.visual@example.com",
  rol: "administrador",
  dependencia_id: null,
};

export const FUNCIONARIO_USER = {
  id: 2,
  nombre: "Funcionario Visual",
  email: "funcionario.visual@example.com",
  rol: "funcionario",
  dependencia_id: 3,
};

const DEPENDENCIAS = [
  { id: 3, nombre: "Talento Humano", activo: 1 },
  { id: 8, nombre: "Oficina de Planeación", activo: 1 },
];

const TIPOS_TRAMITE = [
  {
    id: 1,
    codigo: "peticion_general",
    nombre: "Petición general",
    categoria_general: "peticion_general",
    requiere_respuesta: true,
    activo: 1,
    orden: 1,
  },
];

export const RADICADO = {
  numero_radicado: "RAD-20261124-0001",
  estado: "Recibido",
  asunto: "Solicitud visual con un texto suficientemente largo para comprobar el ajuste responsive.",
  fecha_hora_recepcion: "2026-11-24 10:15:00",
  tipo_comunicacion: "interna",
  tipo_recepcion: "digital",
  remitente_nombre: "Persona remitente para revisión visual",
  remitente_documento: "1111111111",
  remitente_telefono: "3000000000",
  remitente_correo: "persona.visual@example.com",
  dependencia_remitente_id: 3,
  dependencia_remitente_nombre: "Talento Humano",
  dependencia_destino_id: 8,
  dependencia_destino_nombre: "Oficina de Planeación",
  tipo_tramite_id: 1,
  tipo_tramite_nombre: "Petición general",
  requiere_respuesta: 1,
  semaforo: { nivel: "a_tiempo", texto: "A tiempo" },
  fundamento_legal: "Ley 1755 de 2015.",
  fecha_limite: "2026-12-15",
};

const RADICADO_ENVIADO = {
  ...RADICADO,
  estado: "Respondido",
  dependencia_destino: "Oficina de Planeación",
  fecha_respuesta: "2026-11-24 15:00:00",
  radicado_dependencia_id: 1,
};

function jsonResponse(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function mockApi(page, {
  user = ADMIN_USER,
  sessionError = false,
  emptyRadicados = false,
  errorRadicados = false,
  pendingInternas = 0,
  pendingTraslado = false,
} = {}) {
  const calls = [];
  let trasladoPendiente = pendingTraslado ? {
    id: 1,
    numero_radicado: RADICADO.numero_radicado,
    origen_id: 3,
    origen_nombre: "Talento Humano",
    destino_sugerido_id: 8,
    destino_sugerido_nombre: "Oficina de Planeación",
    solicitante_nombre: "Funcionario Visual",
    motivo_solicitud: "La dependencia actual no es competente para continuar el trámite.",
    estado: "pendiente",
    creado_en_utc: "2026-11-24 20:00:00",
    fecha_limite_conservada: "2026-12-15",
  } : null;
  await page.addInitScript(({ sessionUser }) => {
    sessionStorage.setItem(
      "ventanilla.sesion",
      JSON.stringify({ token: "visual-token", usuario: sessionUser }),
    );
  }, { sessionUser: user });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    calls.push(`${method} ${path}${url.search}`);

    if (path === "/api/auth/me") {
      if (sessionError) return jsonResponse(route, { success: false, message: "Sesión visual no disponible." }, 503);
      return jsonResponse(route, { success: true, usuario: user });
    }
    if (path === "/api/auth/logout") return jsonResponse(route, { success: true });
    if (path === "/api/auth/login") return jsonResponse(route, { success: true, token: "visual-token", usuario: user });
    if (path === "/api/dependencias" || path === "/api/dependencias/") {
      return jsonResponse(route, { success: true, dependencias: DEPENDENCIAS });
    }
    if (/^\/api\/dependencias\/\d+$/.test(path)) {
      return jsonResponse(route, { success: true, dependencia: DEPENDENCIAS[0] });
    }
    if (path === "/api/tipos-tramite" || path === "/api/tipos-tramite/") {
      return jsonResponse(route, { success: true, tipos_tramite: TIPOS_TRAMITE });
    }
    if (/^\/api\/tipos-tramite\/\d+$/.test(path)) {
      return jsonResponse(route, { success: true, tipo_tramite: TIPOS_TRAMITE[0] });
    }
    if (path === "/api/terminos-legales") {
      return jsonResponse(route, { success: true, terminos_legales: [] });
    }
    if (path === "/api/usuarios") {
      return jsonResponse(route, {
        success: true,
        usuarios: [{ id: 4, nombre: "Usuario Visual", email: "usuario@example.com", rol: "funcionario", dependencia_id: 3, dependencia_nombre: "Talento Humano", activo: 1 }],
        total: 1,
        paginas: 1,
      });
    }
    if (/^\/api\/usuarios\/\d+$/.test(path)) {
      return jsonResponse(route, { success: true, usuario: { id: 4, nombre: "Usuario Visual", email: "usuario@example.com", rol: "funcionario", dependencia_id: 3, activo: 1 } });
    }
    if (path === "/api/alertas") {
      return jsonResponse(route, { success: true, alertas: [], total: 0, paginas: 0 });
    }
    if (path === "/api/traslados/dependencias") {
      return jsonResponse(route, { success: true, dependencias: DEPENDENCIAS });
    }
    if (/^\/api\/traslados\/\d+\/decision$/.test(path) && method === "POST") {
      trasladoPendiente = null;
      return jsonResponse(route, {
        success: true,
        traslado: { id: 1, numero_radicado: RADICADO.numero_radicado, estado: "aprobada" },
      });
    }
    if (path === "/api/traslados") {
      const traslados = trasladoPendiente ? [trasladoPendiente] : [];
      return jsonResponse(route, {
        success: true,
        traslados,
        total: traslados.length,
        paginas: traslados.length ? 1 : 0,
        pendientes: traslados.filter((traslado) => traslado.estado === "pendiente").length,
      });
    }
    if (path.startsWith("/api/radicados/") && path.endsWith("/traslados/resumen")) {
      return jsonResponse(route, {
        success: true,
        resumen: { total_aprobados: 0, umbral_reiteracion: 3, dependencias_visitadas_ids: [] },
      });
    }
    if (path === "/api/respuestas-internas") {
      return jsonResponse(route, {
        success: true,
        registros: [],
        pagina: 1,
        total: 0,
        paginas: 0,
        resumen: { total: pendingInternas, pendientes: pendingInternas, leidas: 0 },
      });
    }
    if (path.startsWith("/api/radicados/") && path.endsWith("/recepcion-interna")) {
      return jsonResponse(route, {
        success: true,
        recepcion: {
          id: 9,
          respuesta_id: 10,
          dependencia_origen_id: 3,
          numero_radicado: RADICADO_ENVIADO.numero_radicado,
          contenido: "Respuesta visual de prueba.",
          disponible_en_utc: "2026-11-24 20:00:00",
          primera_apertura_utc: null,
          actor_nombre: "",
          dependencia_remitente: "Talento Humano",
          dependencia_destino: "Oficina de Planeación",
          tipo_recepcion: "digital",
          radicado_estado: "Respondido",
        },
      });
    }
    if (path.startsWith("/api/radicados/") && path.endsWith("/documentos")) {
      return jsonResponse(route, { success: true, documentos: [] });
    }
    if (path.startsWith("/api/radicados/") && path.endsWith("/historial")) {
      return jsonResponse(route, { success: true, historial: [], eventos: [], cursor: null, hayMas: false });
    }
    if (path.startsWith("/api/radicados/") && path.endsWith("/respuesta")) {
      return jsonResponse(route, { success: true, respuesta: null });
    }
    if (path === "/api/radicados") {
      if (errorRadicados) return jsonResponse(route, { success: false, message: "Error visual de consulta." }, 503);
      const enviados = url.searchParams.get("vista") === "generados";
      const radicados = emptyRadicados ? [] : [enviados ? RADICADO_ENVIADO : RADICADO];
      return jsonResponse(route, {
        success: true,
        radicados,
        total: radicados.length,
        paginas: radicados.length ? 1 : 0,
        resumen: { total: radicados.length, hoy: radicados.length, criticos: 0 },
      });
    }
    return jsonResponse(route, { success: true });
  });

  await page.route("**/uploads/**", (route) => route.fulfill({ status: 404, body: "" }));
  return calls;
}

export async function assertNoHorizontalOverflow(page) {
  await page.waitForLoadState("domcontentloaded");
  const result = await page.evaluate(() => ({
    valid: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (!result.valid) throw new Error(`Overflow horizontal: ${JSON.stringify(result)}`);
}

export async function assertWithinViewport(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("El elemento esperado no tiene caja visible.");
  const width = page.viewportSize().width;
  if (box.x < -1 || box.x + box.width > width + 1) {
    throw new Error(`Elemento fuera del viewport: x=${box.x}, ancho=${box.width}, viewport=${width}`);
  }
}

export async function assertVisibleFocus(page, locator, { cycle = true } = {}) {
  await locator.focus();
  await expect(locator).toBeFocused();
  if (cycle) {
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(locator).toBeFocused();
  } else {
    await page.keyboard.press("ArrowRight");
    await expect(locator).toBeFocused();
  }
  const visible = await locator.evaluate((element) => {
    if (element.matches(":focus-visible")) return true;
    const styles = getComputedStyle(element);
    const outlineVisible = styles.outlineStyle !== "none" && parseFloat(styles.outlineWidth) > 0;
    return outlineVisible || styles.boxShadow !== "none";
  });
  if (!visible) {
    throw new Error("El foco regresó al control, pero no se observó un indicador visual.");
  }
}

export function assertAllowedCalls(calls, allowedPatterns) {
  const unexpected = calls.filter((call) => !allowedPatterns.some((pattern) => pattern.test(call)));
  if (unexpected.length) throw new Error(`Llamadas HTTP no esperadas: ${unexpected.join(", ")}`);
}
