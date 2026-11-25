# Modularización CSS de respuestas internas

**Estado:** implementing

## Objetivo

Separar los estilos exclusivos de la bandeja de respuestas internas en su
módulo CSS propio, manteniendo la apariencia, accesibilidad y comportamiento
actuales.

## Alcance

- Mover a `ventanilla/css/pages/respuestas-internas.css` el bloque scoped de
  `.internas-bandeja` y sus clases anidadas.
- Conservar encabezados, controles, subpestañas, tarjetas recibidas y enviadas,
  filtros, indicadores, estados de carga/error/vacío, adjuntos, paginación,
  foco y reglas responsive.
- Mantener en `legacy.css` los estilos compartidos de recepción interna,
  modales, detalles, trazabilidad y respuestas institucionales.

## Compatibilidad

- No se modifican JSX, clases públicas, rutas, APIs, payloads, permisos,
  consultas, datos ni lógica de negocio por esta extracción CSS.
- Se conserva el orden de imports de `style.css`.
- La regla contextual de `.consulta-dependencia` para `.internas-bandeja`
  permanece sin cambios.
- Las specs 050, 051 y 054 mantienen sus estados y contenido actuales.

## Criterios de aceptación

- Las reglas exclusivas de `.internas-bandeja` aparecen únicamente en
  `respuestas-internas.css`.
- La bandeja conserva apariencia equivalente en dependencias, Ventanilla y
  Administrador.
- Subpestañas, filtros, paginación, tarjetas, adjuntos y acciones mantienen su
  comportamiento y foco visible.
- Los estados de carga, error y vacío continúan siendo legibles y responsive.
- Las pruebas relacionadas, el build, la suite legacy y `git diff --check`
  pasan.
- La spec permanece en `implementing` hasta completar la revisión visual
  humana.

## Revisión visual aprobada

Se validaron manualmente respuestas recibidas y radicados enviados, tarjetas,
filtros, subpestañas, paginación, estados vacío/carga/error, apertura de PDF,
acciones, foco visible, navegación por teclado y adaptación móvil sin
desbordamiento horizontal.
