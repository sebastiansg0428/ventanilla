---
id: FE-063
title: Modularización CSS del shell institucional
status: implementing
risk: medium
repository: ventanilla
backend_specs: []
---

# Contexto

El shell institucional compartido por las páginas React está definido
principalmente en `css/compatibility/legacy.css`, mientras que
`css/layout/shell.css`, `css/layout/header.css` y
`css/layout/responsive.css` están reservados para una extracción gradual.
El shell es utilizado por `Compartidos.jsx` en las vistas de autenticación,
radicación, consulta y catálogos.

# Objetivo

Separar los estilos exclusivos del shell institucional en los módulos de
layout correspondientes, conservando exactamente las clases públicas, valores
visuales, foco, navegación, responsive y orden efectivo de cascada.

# Fuera de alcance

- No modificar componentes React, JSX, HTML, APIs, rutas, payloads, permisos ni
  lógica de negocio.
- No mover estilos específicos de `.page-register`, `.page-consult` ni de
  páginas concretas.
- No mover bloques responsive que mezclen reglas del shell con otros módulos
  hasta aislar únicamente sus declaraciones del shell.
- No modificar `dist/` ni iniciar la extracción antes de clasificar la revisión
  visual de la spec 061.

# Comportamiento esperado

Los estilos de `.app-page`, `.app-shell-container`, `.skip-link`,
`.app-header`, `.app-session`, `.app-nav`, `.app-nav-links`, `.app-nav-toggle`,
`.app-nav__inner` y `.app-footer` deben quedar organizados en los módulos de
layout sin duplicarse en `legacy.css`.

El encabezado, la sesión, la navegación, el enlace para saltar al contenido,
el cierre de sesión y el footer deben conservar sus estados normal, `hover`,
`focus-visible`, móvil y `prefers-reduced-motion`.

# Contrato backend relacionado

No aplica. El cambio es exclusivamente CSS y no altera contratos del backend.

# Accesibilidad y responsive

- Mantener el foco visible del skip link, enlaces, botones y navegación.
- Conservar el menú responsive y sus tamaños táctiles.
- Revisar 320, 375, 440 px y escritorio.
- Con los menús nativos cerrados, comprobar:

  ```js
  const anchoVisible = document.documentElement.clientWidth;
  const anchoContenido = document.documentElement.scrollWidth;

  anchoContenido <= anchoVisible
  ```

# Criterios de aceptación

- Los estilos exclusivos del shell existen en los módulos de layout
  correspondientes y no aparecen duplicados en `legacy.css`.
- Las páginas React conservan apariencia, navegación, foco y responsive.
- No se modifican clases, estructura, APIs ni comportamiento funcional.
- La spec 061 fue clasificada antes de iniciar esta extracción.
- Pasan las pruebas React relacionadas, el build, la suite legacy y
  `git diff --check`.
- La spec permanece en `implementing` hasta la revisión visual humana.

# Plan de pruebas

- Pruebas React: `PaginasAutenticacion`, `Radicacion`, `GestionCatalogos`,
  `ConsultaRadicados`, `RespuestasInternas` y `Traslados`.
- Build: `npm run build`.
- Suite legacy: `npm run test:legacy`.
- Integridad: `git diff --check`.
- Revisión visual manual: encabezado, navegación, sesión, skip link y footer
  con los roles disponibles en escritorio y 320, 375 y 440 px.

# Trazabilidad

- Frontend: `src/componentes/Compartidos.jsx`.
- Backend relacionado: ninguno.
- Tests: suites React de las páginas que usan el shell.
- Documentación: esta spec y `AGENTS.md` del frontend.
