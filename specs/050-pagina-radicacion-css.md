# Modularización CSS: pantalla de radicación

**Estado:** completed

## Objetivo

Extraer los estilos exclusivos del formulario de radicación a
`ventanilla/css/pages/radicacion.css`, manteniendo la apariencia,
accesibilidad y comportamiento actuales.

## Alcance

- Mover los estilos usados exclusivamente por `Radicacion.jsx` para la tarjeta,
  secciones, grillas, campos obligatorios, carga de archivos y envío.
- Mantener en `legacy.css` las reglas combinadas con autenticación, dashboards,
  alertas y otros módulos compartidos.
- No modificar componentes React, HTML, rutas, APIs, permisos, payloads ni
  lógica de negocio.

## Compatibilidad

`css/style.css` continúa siendo el punto de entrada global e importa
`pages/radicacion.css` antes de `compatibility/legacy.css`. Los selectores y
valores visuales se conservarán para evitar cambios de especificidad,
responsive o comportamiento.

## Verificación

- Ejecutar las pruebas React de radicación, autenticación y catálogos.
- Ejecutar build, pruebas legacy y `git diff --check`.
- Revisión visual manual aprobada con roles Administrador y Ventanilla:
  formulario completo, campos obligatorios, ayudas, selección de trámite,
  carga y validación de PDF, estados de carga y error, teclado y vista móvil.
- Se confirmaron cinco PDF válidos, rechazo completo de seis archivos,
  rechazo de archivos mayores de 10 MB y rechazo de PDF cifrados.
- Se validaron contador, lista, botones `Quitar`, selección por explorador y
  arrastre, sin llamadas `POST` inválidas ni desbordamiento horizontal.
