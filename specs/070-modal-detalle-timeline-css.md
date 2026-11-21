# Spec 070 — Modal de detalle y timeline CSS

**Estado:** completed

## Objetivo

Extraer los estilos exclusivos del modal `#modal-detalle` y su timeline de
trazabilidad desde `legacy.css`, conservando la apariencia y la cascada actual.

## Alcance

- Estructura del modal de detalle, encabezado, contenido, footer y backdrop.
- Resumen, grids, badges y documentos del detalle.
- Timeline, eventos de entrega, anulaciones, respuestas internas y cierres
  informativos.
- Foco, legibilidad, contenido largo e iframe del detalle.

## Fuera de alcance

No se modifican JSX, clases HTML, APIs, endpoints, payloads, permisos,
validaciones ni lógica. Los estilos generales de `.respuesta-dialog`,
`.receipt-dialog`, `.modal-field` y el fallback legacy permanecen en
`legacy.css`.

## Criterios de aceptación

- Las reglas exclusivas de `#modal-detalle` existen una sola vez en el nuevo
  módulo.
- Las reglas combinadas con `.respuesta-dialog` conservan su rama del modal
  institucional sin cambios funcionales.
- Se conservan timeline, documentos, badges, focus visible y textos largos.
- No aparece overflow horizontal en 320, 375, 440 px ni escritorio con
  menús nativos cerrados.
- Pasan las pruebas React relacionadas, build, suite legacy y `git diff --check`.

## Revisión visual aprobada

Se validó la apertura y cierre del detalle con roles Administrador, Ventanilla
y Funcionario, sin errores en consola. El resumen, badges, documentos e iframe
se visualizaron legibles, proporcionados y sin cortes.

El timeline de trazabilidad y los eventos de entrega, anulación y respuesta
interna quedaron ordenados y sin encimamientos. La navegación con
`Tab`/`Shift+Tab` funcionó con foco visible dentro del detalle.

La revisión responsive fue aprobada con menús nativos cerrados:

- 320 px: `scrollWidth <= clientWidth` → `true`.
- 375 px: `scrollWidth <= clientWidth` → `true`.
- 440 px: `scrollWidth <= clientWidth` → `true`.
- Escritorio: `scrollWidth <= clientWidth` → `true`.

Resultado: revisión aprobada sin regresiones visuales.
