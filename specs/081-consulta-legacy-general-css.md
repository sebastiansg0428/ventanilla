# Spec 081 — Consulta legacy general CSS

**Estado:** completed

## Objetivo

Extraer de `legacy.css` los estilos específicos de la bandeja de consulta
legacy, conservando la apariencia y el comportamiento de las entradas legacy y
de la consulta React.

## Alcance

- Estructura `.page-consult` y encabezado legacy.
- Tarjetas de resumen, búsqueda y filtros.
- Tabla `#tabla-radicados`, semáforos, estados y badges.
- Mensajes vacíos, errores, responsive y reglas de consulta asociadas.

## Fuera de alcance

No se modifican JSX, JavaScript, APIs, permisos, payloads, contratos, datos,
`dist/` ni estilos globales no confirmados como exclusivos de consulta.

## Compatibilidad

- Se conservan selectores, valores, clases e IDs existentes.
- El módulo se importa inmediatamente antes de `legacy.css`.
- `legacy/js/consultar.js` continúa usando la misma estructura legacy.
- La consulta React conserva sus estados, filtros, tabla, foco y responsive.

## Verificación

- `npm run test:react -- tests/react/ConsultaRadicados.test.jsx`.
- `npm run test:legacy`.
- `npm run build`.
- `git diff --check`.
- Confirmar ausencia de selectores trasladados duplicados.

## Revisión visual aprobada

- Filtros, búsqueda, tarjetas, tabla y semáforos validados sin cortes ni
  solapamientos.
- Estados vacíos y errores comprobados sin romper el layout.
- Detalle, comprobante y respuestas revisados y contenidos dentro de la vista.
- Navegación con `Tab`/`Shift+Tab` y foco visible verificados.
- Responsive validado en 320, 375, 440 px y escritorio.
- Con menús nativos cerrados, `scrollWidth <= clientWidth` fue `true` en todos
  los tamaños revisados.
- Resultado: revisión visual aprobada, sin regresiones.
