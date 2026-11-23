---
id: FE-076
title: Estilos del modal de respuesta institucional
status: completed
risk: medium
repository: ventanilla
backend_specs: []
---

# Contexto

Los estilos restantes del modal de respuesta institucional permanecen en
`legacy.css`, aunque los adjuntos, el seguimiento de entregas y el detalle
general ya cuentan con módulos CSS propios.

# Objetivo

Extraer el bloque específico de `.respuesta-dialog` y `.recepcion-interna`
para reducir el monolito sin cambiar la apariencia ni el comportamiento.

# Fuera de alcance

No se modificarán JSX, JavaScript, APIs, payloads, permisos, backend, lógica,
validaciones ni los módulos ya extraídos de adjuntos, entregas o detalle.

# Comportamiento esperado

El modal conservará sus encabezado, contenido, footer, controles, mensajes,
estados de recepción interna, foco, cierre, teclado y adaptación responsive.
Los estilos genéricos o compartidos permanecerán en sus módulos actuales o en
`legacy.css`.

# Accesibilidad y responsive

Se conservarán el foco visible, los estados disabled, la legibilidad, la
navegación por teclado y la adaptación en 320, 375, 440 px y escritorio. Con
menús nativos cerrados se comprobará `scrollWidth <= clientWidth`.

# Criterios de aceptación

- Los selectores exclusivos de respuesta institucional se cargan desde
  `components/institutional-response.css`.
- Adjuntos, entregas y detalle conservan sus módulos fuente.
- No quedan definiciones duplicadas de los selectores trasladados.
- No cambian las consultas, permisos, estados ni contratos.

# Plan de pruebas

- React: `RespuestasInternas.test.jsx`, `ConsultaRadicados.test.jsx` y
  `SeguimientoEntrega.test.jsx`.
- Suite legacy: `npm run test:legacy`.
- Build: `npm run build`.
- Revisión visual manual por roles y tamaños responsive.

# Trazabilidad

- Frontend: `css/components/institutional-response.css`.
- Backend relacionado: ninguno.
- Tests: respuestas internas, consulta y seguimiento de entrega.
- Documentación: esta spec.

# Revisión visual aprobada

Se revisó el modal de respuesta institucional con los roles Administrador,
Ventanilla y Funcionario. Se validaron adjuntos, documentos, trazabilidad,
estados de carga, éxito, error, vacío y reintento, además del cierre, foco y
navegación por teclado.

La revisión se realizó en 320, 375 y 440 px y en escritorio. No se observaron
regresiones visuales ni desbordamiento horizontal; con los menús nativos
cerrados se confirmó `scrollWidth <= clientWidth`.
