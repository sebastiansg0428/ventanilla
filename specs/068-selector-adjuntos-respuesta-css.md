---
id: FE-068
title: Modularización CSS del selector de adjuntos de respuesta
status: completed
risk: low
repository: ventanilla
backend_specs: []
---

# Contexto

Los estilos del selector de adjuntos de la respuesta institucional permanecen
en `css/compatibility/legacy.css`, aunque el bloque está delimitado por sus
clases específicas y estados visuales.

# Objetivo

Extraer el selector de adjuntos a `css/components/response-attachments.css`
sin modificar el comportamiento de selección, arrastre, validación o envío.

# Alcance

- Superficie, botón, foco, contador e input oculto del selector.
- Adjuntos opcionales: la respuesta puede enviarse sin PDF cuando el contenido
  escrito cumple la validación vigente.
- Estados de arrastre y error.
- Lista de archivos y botones `Quitar`.
- Mensajes contextuales de error de adjuntos.
- Responsive y `prefers-reduced-motion` del selector.

# Fuera de alcance

- JSX, componentes, APIs, payloads, permisos y validaciones.
- Estilos generales del modal de respuesta.
- Mensajes generales, trazabilidad, documentos y entregas.
- Backend y `dist/`.

# Criterios de aceptación

- Las reglas exclusivas del selector existen una sola vez en el nuevo módulo.
- `legacy.css` conserva únicamente reglas generales o no confirmadas como
  exclusivas.
- Se mantienen selección por teclado, cancelación del selector, arrastre,
  contador, lista, botones `Quitar` y errores existentes.
- Se mantienen foco visible, responsive y reducción de movimiento.
- Pasan las pruebas React relacionadas, build, suite legacy y
  `git diff --check`.
- La spec queda en `completed` únicamente después de la revisión visual humana.

# Revisión visual aprobada

Se validó manualmente la respuesta institucional con y sin PDF. Los adjuntos
son opcionales y se conservaron los límites y validaciones existentes: máximo
cinco archivos, 10 MB por archivo, extensiones PDF y rechazo de PDF cifrados.
También se revisaron selección por teclado, cancelación del selector nativo,
arrastre, contador, lista, botones `Quitar`, mensajes de error y foco único en
`Seleccionar archivos PDF`.

La revisión responsive en 320, 375, 440 px y escritorio fue aprobada, sin
desbordamiento horizontal.
