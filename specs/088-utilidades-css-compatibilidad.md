---
id: 088
title: Utilidades CSS de compatibilidad y verificación visual automatizada
status: completed
scope: frontend
---

# Objetivo

Separar de `css/compatibility/legacy.css` las utilidades CSS compartidas por
formularios y páginas protegidas, y automatizar las comprobaciones visuales que
se realizaban manualmente con Playwright y respuestas HTTP simuladas.

## Alcance

- `.form-ayuda` y `.contador-caracteres`.
- Restricciones compartidas de `min-width`, límites de controles de formulario
  y `overflow-wrap` de textos largos en `.app-page`.
- Configuración de Playwright con el motor Chromium, usando el ejecutable
  local disponible como respaldo cuando no esté instalado el navegador
  administrado por Playwright, Vite en `127.0.0.1:5173` y los viewports 320,
  375, 440 px y escritorio.
- Fixtures HTTP reutilizables para sesión, autenticación, usuarios, catálogos,
  consulta, respuestas internas y estados vacío/error.
- Comprobaciones de overflow, límites del viewport, teclado, foco y llamadas
  HTTP esperadas sin acceder a MariaDB ni a datos persistentes.

## Fuera de alcance

- JSX, JavaScript de negocio, APIs, permisos, contratos, datos y `dist/`.
- Cambios en el backend o en la base de datos.
- Corrección automática de dependencias o actualización de paquetes.
- Marcar la spec como completada antes de la revisión visual automatizada y la
  confirmación humana.

## Compatibilidad

El módulo `css/foundations/compatibility-utilities.css` se importa antes de
`legacy.css`. Los selectores y declaraciones conservan su comportamiento y
precedencia efectiva. Los artefactos de Playwright se excluyen de Git y solo se
generan como evidencia de fallo.

## Criterios de aceptación

- Las suites React y legacy existentes continúan pasando.
- Playwright puede iniciar Vite localmente o clasifica un bloqueo de loopback
  como infraestructura con evidencia explícita.
- Cada viewport comprueba `scrollWidth <= clientWidth` con menús nativos
  cerrados.
- Login, registro, usuarios, catálogos, consulta, detalle y sesión no disponible
  tienen una comprobación automatizada de estructura, estados y foco.
- No se detectan llamadas HTTP fuera de las rutas simuladas esperadas.

## Verificación y revisión

La suite automatizada quedó preparada para ejecutar autenticación, registro,
usuarios, catálogos, sesión no disponible, consulta, detalle, comprobante,
insignia, estados vacío/error y llamadas HTTP esperadas en los cuatro tamaños.
La ejecución completa final pasó 44 casos: 11 escenarios en cada uno de los
cuatro viewports configurados
automatizado previsto.

## Revisión visual humana aprobada

El usuario confirmó la revisión de autenticación, registro, estado de sesión,
consulta, detalle, comprobante, catálogos y tablas en 320, 375, 440 px y
escritorio. Con menús nativos cerrados, `scrollWidth <= clientWidth` se mantuvo
verdadero y no se observaron regresiones visuales.

