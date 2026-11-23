---
id: FE-075
title: Estilos legacy de registro
status: completed
risk: low
repository: ventanilla
backend_specs: []
---

# Contexto

`legacy.css` conserva estilos históricos específicos de la página de registro
junto con reglas compartidas de autenticación y consulta.

# Objetivo

Separar el bloque delimitado por `.page-register` para reducir el monolito sin
alterar la apariencia ni el comportamiento de la página.

# Fuera de alcance

No se modificarán JSX, JavaScript, APIs, formularios, validaciones, permisos,
backend, estilos compartidos de autenticación ni archivos generados.

# Comportamiento esperado

La página de registro conservará su encabezado legacy, navegación, tarjeta,
contenido, estados de foco y footer.

# Accesibilidad y responsive

Se conservarán foco visible, teclado, textos largos y adaptación en 320, 375,
440 px y escritorio. Con menús nativos cerrados se comprobará
`scrollWidth <= clientWidth`.

# Criterios de aceptación

- Las reglas `.page-register` se cargan desde `registro-legacy.css`.
- Las reglas compartidas de autenticación permanecen en sus módulos actuales.
- Login, registro y radicación no presentan cambios visuales.
- No aparecen desbordamientos horizontales ni controles recortados.

# Plan de pruebas

- React: `PaginasAutenticacion.test.jsx` y `Radicacion.test.jsx`.
- Suite legacy: `npm run test:legacy`.
- Build: `npm run build`.
- Revisión visual manual en 320, 375, 440 px y escritorio.

# Trazabilidad

- Frontend: `css/pages/registro-legacy.css`.
- Backend relacionado: ninguno.
- Tests: autenticación, radicación y suite legacy.
- Documentación: esta spec.

# Revisión visual aprobada

Se verificó manualmente `registro_usuario.html` con el formulario de registro,
encabezado, navegación, tarjeta Registrar usuario, campos de nombre, correo,
rol, dependencia y contraseña, botón de registro, estados de carga, error y
éxito, foco visible, navegación por teclado y footer.

La revisión se realizó en 320, 375 y 440 px y en escritorio. Los campos y
botones no presentan recortes ni regresiones visuales; con los menús nativos
cerrados, `scrollWidth <= clientWidth` se confirmó en todos los tamaños.
