# Spec 086 — Estilos compartidos de consulta React

**Estado:** completed

## Objetivo

Extraer de `css/compatibility/legacy.css` el bloque de estilos compartidos de
la consulta React, conservando la distribución, los filtros, las tarjetas, la
tabla de radicados y su adaptación responsive.

## Alcance

- Estructura de `.consult-main` y `.consult-heading`.
- Tarjetas `.dashboard-cards` y `.dashboard-card`.
- Filtros activos y `.consult-filters`.
- Reglas generales de `#tabla-radicados`.
- Estados, botones y controles exclusivos de la consulta React.
- Ramas responsive específicas de la consulta.

## Compatibilidad y límites

- `consulta-shared.css` se importa inmediatamente antes de `legacy.css`.
- Los selectores combinados con alertas, autenticación, radicación o catálogos
  se separan conservando sus declaraciones y especificidad efectivas.
- `.tabla-ayuda`, controles de alertas y reglas globales permanecen en
  `legacy.css` porque son compartidos por otras páginas.
- No se modifican JSX, JavaScript, APIs, permisos, contratos, datos ni `dist/`.

## Verificación

- `npm run test:react -- tests/react/ConsultaRadicados.test.jsx`.
- `npm run test:legacy`.
- `npm run build`.
- `git diff --check`.
- Confirmar ausencia de duplicación innecesaria y conservación del orden de
  importación.

## Revisión visual aprobada

La revisión visual confirmó:

- `.consult-main`, `.consult-heading`, `.consult-filters`, tarjetas de resumen
  y `#tabla-radicados` sin anomalías visuales;
- filtros, tarjetas, tabla, estados vacíos y errores, detalle, respuestas y
  comprobantes sin regresiones;
- navegación por teclado y foco visible en los controles;
- `scrollWidth <= clientWidth` igual a `true` con menús nativos cerrados en
  320 px (`clientWidth: 320`, `scrollWidth: 320`), 375 px
  (`clientWidth: 375`, `scrollWidth: 375`), 440 px
  (`clientWidth: 440`, `scrollWidth: 440`) y escritorio.

Resultado: revisión visual aprobada.
