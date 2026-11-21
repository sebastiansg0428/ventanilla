---
id: FE-065
title: Estilos compartidos de autenticación
status: completed
risk: low
repository: ventanilla
backend_specs: []
---

# Contexto

Los estilos genéricos de autenticación están mezclados en
`css/compatibility/legacy.css`, aunque son utilizados por login, registro,
gestión de usuarios y catálogos.

# Objetivo

Extraer los estilos compartidos de autenticación a
`css/components/auth.css`, conservando clases, valores visuales, cascada,
responsive y accesibilidad.

# Alcance

- `.auth-card`.
- `.auth-brand` y `.auth-brand__mark`.
- `.auth-heading` y `.auth-eyebrow`.
- `.auth-switch`.
- `.auth-footnote`.
- Reglas responsive compartidas de tarjetas, encabezados y formularios.

# Fuera de alcance

- Componentes React, JSX, HTML y comportamiento funcional.
- APIs, rutas, permisos, payloads y backend.
- `.page-auth`, `.auth-shell` y estilos específicos de registro.
- Modales, drawers y estilos de páginas concretas.
- `dist/`.

# Compatibilidad

El import del nuevo módulo se mantiene antes de `legacy.css`. Las reglas
contextuales y específicas permanecen en la capa legacy para conservar la
cascada efectiva y evitar cambios visuales accidentales.

# Criterios de aceptación

- Los estilos compartidos existen una sola vez en `css/components/auth.css`.
- `legacy.css` conserva únicamente los estilos contextuales no extraídos.
- Login, registro, usuarios y catálogos mantienen apariencia y responsive.
- El foco visible, teclado, estados de carga, error y éxito no cambian.
- Pasan las pruebas React relacionadas, build, suite legacy y
  `git diff --check`.
- La spec queda en `completed` después de la revisión visual humana aprobada.

# Revisión visual manual aprobada

Se revisaron las vistas de Login, Registro, Usuarios y Catálogos. El layout,
los formularios, las tablas/listados y los botones se observaron limpios,
legibles y sin encimamientos.

Con los menús nativos cerrados, la comprobación `scrollWidth <= clientWidth`
resultó verdadera en todos los tamaños revisados:

- 320 px: `true`.
- 375 px: `true`.
- 440 px: `true`.
- Escritorio: `true`.

Resultado: revisión aprobada sin regresiones visuales.
