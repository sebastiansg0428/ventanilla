---
id: 090
title: Compatibilidad legacy final y verificación visual automatizada
status: completed
risk: low
scope: frontend
---

# Objetivo

Reducir el bloque residual de `css/compatibility/legacy.css` moviendo reglas
con propietario claro a los módulos CSS existentes, sin cambiar la cascada,
los selectores ni el comportamiento visual.

## Alcance

- Reglas generales de campos de modales.
- Comprobante, encabezado e iframe del recibo.
- Botones y responsive de alertas.
- Botón del toolbar de términos legales.
- Responsive específico de radicación y catálogos.
- Frontera explícita de compatibilidad para reglas compartidas no confirmadas.

## Fuera de alcance

- JSX, JavaScript, APIs, permisos, payloads y datos.
- Cambios de nombres de clases o IDs.
- Modificación de `dist/`.
- Eliminación completa de `legacy.css`.
- Cambios visuales intencionales.

## Criterios de aceptación

- `legacy.css` conserva las reglas globales y compartidas cuya cascada no esté
  confirmada.
- Las reglas trasladadas existen una sola vez en su módulo responsable.
- La precedencia de imports se conserva mediante `legacy-compatibility.css`
  inmediatamente antes de `legacy.css`.
- Consulta, radicación, autenticación, usuarios, catálogos, alertas, modales y
  comprobantes conservan su apariencia, foco, teclado y responsive.
- Las pruebas React, legacy, Stylelint, build y Playwright pasan.

## Verificación visual automatizada

Playwright usa Microsoft Edge, Vite en `127.0.0.1:5173` y mocks HTTP estables.
La suite cubre 11 escenarios en 320, 375, 440 y 1280 px: autenticación,
usuarios, catálogos, consulta, detalle, comprobante, traslados, respuestas
internas, estados vacío/error y accesibilidad.

`--list` solo demuestra descubrimiento. La aprobación requiere una ejecución
real de los 44 casos o del total vigente si la suite crece.

## Resultado automatizado registrado

- Stylelint: aprobado.
- Pruebas React, legacy y build: aprobadas; Consulta Radicados ejecutó 116/116
  pruebas y la suite legacy 39/39.
- Playwright: 44/44 aprobadas al ejecutar cada proyecto con Vite limpio:
  320 (11/11), 375 (11/11), 440 (11/11) y escritorio (11/11).
- La ejecución única de los cuatro proyectos perdió el servidor Vite después
  del primer proyecto y produjo `ERR_CONNECTION_REFUSED` en
  `127.0.0.1:5173`; se clasifica como limitación de infraestructura del ciclo
  de vida de `webServer`, no como fallo funcional de CSS.

## Revisión humana aprobada

Se revisaron visualmente la consulta, radicación, autenticación, registro,
usuarios, catálogos, alertas, tablas, formularios, modales y comprobantes.

La validación se realizó en 320, 375 y 440 px, además de escritorio, con los
menús nativos cerrados. En todos los tamaños se confirmó:

- `document.documentElement.scrollWidth <=
  document.documentElement.clientWidth`.
- Foco visible y navegación con teclado.
- Textos largos sin recortes ni solapamientos.
- Ausencia de regresiones visuales y funcionales observables.

La revisión visual humana queda aprobada y la spec pasa a `completed`.

La spec 031 continúa en `implementing` por la prueba física pendiente con la
DigitalPOS DIG-2406T Pro.
