---
id: FE-066
title: Estilos del editor de términos legales de catálogos
status: completed
risk: low
repository: ventanilla
backend_specs: []
---

# Contexto

El editor inline de términos legales de Gestión de catálogos conserva estilos
exclusivos dentro de `css/compatibility/legacy.css`, junto con reglas de otros
formularios y módulos.

# Objetivo

Extraer únicamente los estilos propios del panel de términos legales a un
módulo de página, conservando apariencia, cascada, responsive, foco y
comportamiento actuales.

# Alcance

- `.catalog-term-panel`.
- `.catalog-term-panel .users-table-toolbar`.
- `.catalog-term-intro`.
- `.catalog-term-form-card` y su formulario.
- Ajustes responsive exclusivos del panel.

# Fuera de alcance

- Componentes React, JSX, HTML y comportamiento funcional.
- APIs, rutas, permisos, payloads y backend.
- Formularios y estilos compartidos de catálogos, usuarios y tablas.
- Drawers de edición y modales.
- `dist/`.

# Criterios de aceptación

- Las reglas exclusivas del editor existen una sola vez en
  `css/pages/catalogos-terminos.css`.
- `legacy.css` conserva reglas compartidas y contextuales no extraídas.
- El historial, formulario, validaciones, guardado, cierre, desplazamiento y
  foco del editor no cambian.
- La apariencia se conserva en Dependencias y Tipos de trámite.
- Pasan la prueba React de catálogos, build, suite legacy y
  `git diff --check`.
- La spec queda en `completed` únicamente después de la revisión visual humana.

# Revisión visual pendiente

# Revisión visual manual aprobada

Se revisó como Administrador el editor de términos legales en las pestañas
Dependencias y Tipos de trámite. Se confirmaron el historial, el formulario,
las validaciones, el guardado, el cierre, el desplazamiento automático y el
foco del encabezado.

La revisión responsive en 320, 375, 440 px y escritorio no mostró regresiones
visuales ni desbordamiento horizontal con los menús nativos cerrados.
