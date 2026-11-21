---
id: FE-067
title: Navegación al resultado de búsqueda en catálogos
status: completed
risk: low
repository: ventanilla
backend_specs: []
---

# Contexto

La búsqueda de Dependencias y Tipos de trámite filtra localmente los registros,
pero al confirmar con `Enter` el listado puede quedar fuera del viewport.

# Objetivo

Permitir que `Enter` en el buscador desplace suavemente al listado filtrado y
mejorar la identificación accesible del buscador según la pestaña activa.

# Alcance

- Filtrado local existente de Dependencias y Tipos de trámite.
- Desplazamiento de `.catalog-list-panel` con `scrollIntoView` al presionar
  `Enter`.
- Etiqueta `Buscar Dependencia` para Dependencias.
- Etiqueta `Buscar tramites` para Tipos de trámite.
- Navegación por teclado, foco visible y responsive.

# Fuera de alcance

- Consultas, endpoints, payloads, permisos y backend.
- Carga de catálogos y lógica de filtrado existente.
- Formularios de creación, edición y términos legales.
- Cambios generales de CSS o de contratos públicos.

# Criterios de aceptación

- `Enter` desplaza al listado con comportamiento suave y alineación inicial.
- El filtro se conserva y el resultado permanece visible.
- No se generan llamadas API adicionales por presionar `Enter`.
- Las etiquetas accesibles cambian correctamente entre ambas pestañas.
- Las pruebas de catálogos, build, suite legacy y `git diff --check` pasan.
- La spec queda en `completed` únicamente después de la revisión visual humana.

# Revisión visual manual aprobada

Se validó como Administrador la búsqueda de Dependencias y Tipos de trámite.
El filtro local, la confirmación con `Enter`, el desplazamiento al listado,
las etiquetas `Buscar Dependencia` y `Buscar tramites`, el foco visible y la
navegación por teclado funcionan correctamente.

La revisión en 320, 375, 440 px y escritorio confirmó ausencia de overflow
horizontal con menús nativos cerrados y ausencia de llamadas API adicionales
al confirmar la búsqueda.
