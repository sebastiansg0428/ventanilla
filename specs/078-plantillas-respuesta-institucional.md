---
id: FE-078
title: Plantillas de respuesta institucional
status: completed
risk: low
repository: ventanilla
backend_specs: []
---

# Contexto

El modal de respuesta institucional tenía una plantilla llamada «Traslado por
competencia», aunque los traslados reales se gestionan en una bandeja aparte
con sus propios permisos, formularios y trazabilidad.

# Objetivo

Limitar el selector a plantillas de redacción y aclarar visualmente que no
inicia acciones de traslado.

# Comportamiento esperado

- El selector muestra `Sin plantilla`, `Respuesta general` y `Entrega de información`.
- Las dos plantillas preparan texto editable para la respuesta.
- La ayuda contextual explica que los traslados se gestionan desde su bandeja.
- Respuestas históricas con `plantilla: "traslado"` siguen mostrando una etiqueta legible.

# Fuera de alcance

No se modificarán APIs, payloads, backend, permisos, validaciones, rutas ni el
flujo independiente de traslados.

# Accesibilidad y responsive

El selector conserva su etiqueta, foco visible, navegación por teclado y
`aria-describedby`. La ayuda contextual es legible en 320, 375, 440 px y
escritorio, sin overflow horizontal.

# Criterios de aceptación

- La opción visible de traslado no aparece en el selector.
- Las plantillas general e información conservan sus textos iniciales.
- El contenido generado continúa siendo editable.
- El envío con y sin adjuntos no cambia.
- No se generan llamadas API adicionales por seleccionar una plantilla.

# Plan de pruebas

- `tests/react/ConsultaRadicados.test.jsx`.
- `tests/react/RespuestasInternas.test.jsx`.
- `npm run build`.
- `npm run test:legacy`.
- Revisión visual manual por roles y viewports.

# Revisión visual aprobada

- El selector no muestra la opción de traslado ni mezcla el flujo independiente.
- Las plantillas generan textos editables que actualizan el formulario con normalidad.
- La ayuda contextual es clara, legible y no presenta cortes ni solapamientos.
- Selector, área de texto y botones operables con teclado y foco visible.
- `scrollWidth <= clientWidth` con menús nativos cerrados:
  - 320 px: `true`;
  - 375 px: `true`;
  - 440 px: `true`;
  - escritorio: `true`.
- Resultado: revisión visual aprobada sin regresiones.

# Trazabilidad

- Frontend: `src/paginas/ConsultaRadicados.jsx`.
- Estilos: `css/components/institutional-response.css`.
- Flujo relacionado: bandeja independiente de traslados.
