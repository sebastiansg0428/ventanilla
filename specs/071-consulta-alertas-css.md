# Spec 071 — Alertas de consulta CSS

**Estado:** completed

## Objetivo

Extraer los estilos específicos de la sección `#seccion-alertas` desde
`legacy.css`, conservando estados, foco, responsive y la apariencia actual.

## Alcance

- Estructura y encabezado de alertas por dependencia.
- Selector de dependencia y botón de actualización.
- Estados de carga, vacío, éxito y error.
- Grupos próximos a vencer y vencidos.
- Tarjetas, etiquetas, contadores y paginación.
- Responsive y foco visible específicos de la sección.

## Fuera de alcance

Se mantienen en `legacy.css` los selectores legacy globales, los estilos
compartidos de `.alerts-card`, `.alerts-controls` y `.alerts-columns`, además
de componentes, APIs, endpoints, permisos, payloads y lógica.

## Criterios de aceptación

- Las reglas exclusivas de `#seccion-alertas` existen una sola vez en el nuevo
  módulo.
- Se conservan los estados de carga, vacío, éxito y error.
- Se mantienen foco visible, teclado, paginación y tamaños táctiles.
- No aparece overflow horizontal en 320, 375, 440 px ni escritorio con
  menús nativos cerrados.
- No se generan llamadas adicionales por la extracción CSS.
- Pasan las pruebas React, build, suite legacy y `git diff --check`.

## Revisión visual aprobada

Se validó manualmente con roles Administrador, Ventanilla y Funcionario la
carga automática, actualización manual, estados vacío, éxito y error, grupos
de vencimiento, paginación, foco y navegación por teclado.

La revisión responsive en 320, 375, 440 px y escritorio fue aprobada con
menús nativos cerrados, sin overflow horizontal ni regresiones visuales.
