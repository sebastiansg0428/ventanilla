# Modularización inicial de estilos de catálogos

**Estado:** completed

## Objetivo

Extraer de forma incremental los estilos visuales propios de la pantalla de
catálogos, comenzando por sus pestañas, encabezado y tarjetas de resumen.

## Alcance

- Mover a `ventanilla/css/pages/catalogos.css` las reglas de:
  - `.catalog-tabs` y sus estados;
  - `.catalog-tab-count`;
  - `.catalog-header` y sus elementos;
  - `.catalog-summary-grid` y sus tarjetas.
- Mantener temporalmente en `legacy.css` los formularios, tablas, paneles de
  edición, términos legales, estilos compartidos con usuarios y responsive
  común.

## Compatibilidad

- No se modifican JSX, clases públicas, rutas, APIs, payloads, permisos, datos
  ni lógica de negocio.
- Se conserva el orden de imports de `style.css` y los valores visuales
  existentes.
- La extracción es reversible y no cambia el comportamiento de las pestañas ni
  la carga de catálogos.

## Criterios de aceptación

- Las reglas extraídas aparecen únicamente en `pages/catalogos.css`.
- Las pestañas, encabezado y tarjetas conservan apariencia, foco y responsive.
- Formularios, tablas y estilos de usuarios no presentan regresiones.
- Las pruebas relacionadas, build, suite legacy y `git diff --check` pasan.
- La revisión visual humana fue aprobada.

## Revisión visual aprobada

Con rol Administrador se validaron las pestañas de Dependencias y Tipos de
trámite, contadores, encabezado, vista móvil, escritorio, 320, 375 y 440 px,
navegación por teclado, foco visible y la comprobación
`clientWidth`/`scrollWidth`. Formularios, tablas, usuarios y editor de
términos no presentaron regresiones.
