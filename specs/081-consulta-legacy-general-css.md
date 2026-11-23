# Spec 081 — Consulta legacy general CSS

**Estado:** implementing

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

## Revisión visual pendiente

Validar filtros, búsqueda, tarjetas, tabla, semáforos, estados vacíos y
errores; detalle y comprobante; teclado, foco y responsive en roles
Administrador, Ventanilla y Funcionario; 320, 375, 440 px y escritorio; y
`scrollWidth <= clientWidth` con menús nativos cerrados.
