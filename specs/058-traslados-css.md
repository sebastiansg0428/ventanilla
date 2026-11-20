# Modularización CSS de traslados

**Estado:** completed

## Objetivo

Separar los estilos propios de la bandeja y los formularios de traslados en un
módulo de página independiente, manteniendo la apariencia y la cascada actual.

## Alcance

- Mover las reglas encapsuladas por `.traslados-panel` y las clases auxiliares
  de traslados a `css/pages/traslados.css`.
- Mantener en `consulta.css` únicamente los ajustes que dependen del contexto
  `.consulta-dependencia` o `.consulta-ventanilla`.
- Conservar la integración de traslados en consulta, respuestas internas,
  resumen de traslados y modales existentes.

## Compatibilidad

No se modifican JSX, APIs, endpoints, permisos, estados, payloads, datos ni
acciones. Las clases públicas, los estados responsive, los tamaños táctiles,
los focos visibles y los mensajes accesibles permanecen iguales.

## Criterios de aceptación

- Las reglas base de traslados existen una sola vez en `pages/traslados.css`.
- Los ajustes scoped de consulta continúan funcionando sin cambios visuales.
- La bandeja conserva filtros, paginación, carga, errores, decisiones y avisos.
- Pasan las pruebas de traslados y consulta, el build, la suite legacy y
  `git diff --check`.

## Revisión visual aprobada

Se validaron la bandeja de traslados, filtros, estados, paginación, acciones,
formularios de decisión, estados de carga/error/vacío, alertas y avisos. Se
confirmaron el foco visible, la navegación por teclado, la revisión en
escritorio y en 320, 375 y 440 px, además de la comprobación
`clientWidth`/`scrollWidth`. No se observaron regresiones visuales ni
desbordamiento horizontal.
