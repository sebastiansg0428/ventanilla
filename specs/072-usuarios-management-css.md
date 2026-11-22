# Spec 072 — Gestión de usuarios CSS

**Estado:** implementing

## Objetivo

Extraer los estilos específicos de la pantalla de gestión de usuarios desde
`legacy.css`, conservando formularios, tabla, acciones y drawer.

## Alcance

- Layout de gestión de usuarios.
- Tabla, toolbar, descripción, estados y acciones.
- Formulario de registro y acciones del formulario.
- Campos y acciones del drawer de edición.
- Responsive específico de usuarios.

## Fuera de alcance

No se modifican JSX, APIs, payloads, permisos, validaciones ni lógica. Los
estilos compartidos de autenticación, formularios, botones, tablas y modales
permanecen en sus módulos actuales.

## Criterios de aceptación

- Las reglas específicas de usuarios existen una sola vez en el nuevo módulo.
- Se conservan tabla, estados activo/inactivo, acciones y drawer.
- Se mantienen foco visible, teclado, tamaños táctiles y responsive.
- No aparece overflow horizontal en 320, 375, 440 px ni escritorio.
- Pasan las pruebas React, build, suite legacy y `git diff --check`.

## Revisión visual pendiente

Validar gestión de usuarios, registro, edición, estados, acciones, teclado,
foco y responsive con rol Administrador.
