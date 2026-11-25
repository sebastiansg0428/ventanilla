# Spec 083 — Modales genéricos CSS

**Estado:** completed

## Objetivo

Extraer de `legacy.css` el fallback visual de los modales genéricos,
conservando su distribución, cierre, foco, teclado y comportamiento responsive.

## Alcance

- Estructura de `.modal-dialog`.
- Encabezado, cierre, contenido, resumen, valores y footer.
- Estados visuales de `.modal-status` y `.modal-subject`.
- Animación, responsive y `prefers-reduced-motion` del modal genérico.

## Fuera de alcance

No se modifican JSX, JavaScript, APIs, permisos, payloads, contratos, datos,
`dist/`, `.modal-field` compartido, comprobantes, respuesta institucional,
timeline, detalle específico ni drawers.

## Compatibilidad

- Se conservan selectores, valores, clases y estructura HTML existentes.
- El módulo se importa después de los módulos específicos y antes de
  `legacy.css`.
- El comportamiento de apertura, cierre por botón, teclado y backdrop no cambia.
- `.modal-field` permanece en `legacy.css` porque también es compartido por
  otros modales.

## Verificación

- `npm run test:react -- tests/react/ConsultaRadicados.test.jsx`.
- `npm run test:react -- tests/react/Traslados.test.jsx`.
- `npm run test:react -- tests/react/GestionCatalogos.test.jsx`.
- `npm run test:legacy`.
- `npm run build`.
- `git diff --check`.
- Confirmar ausencia de duplicación innecesaria de los selectores trasladados.

## Revisión visual humana aprobada

El usuario confirmó la revisión de los modales de detalle, solicitud de
traslado y consulta, incluyendo encabezado, contenido, resumen, footer, cierre,
foco, teclado y textos largos. También confirmó la validación responsive en
320, 375, 440 px y escritorio, con `scrollWidth <= clientWidth` y menús
nativos cerrados, sin regresiones visuales.
