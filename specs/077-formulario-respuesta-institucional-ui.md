---
id: FE-077
title: Mejora visual del formulario de respuesta institucional
status: completed
risk: low
repository: ventanilla
backend_specs: []
---

# Contexto

El modal de respuesta institucional funciona correctamente, pero el resumen,
la redacción y los adjuntos tienen una jerarquía visual demasiado uniforme.

# Objetivo

Mejorar la lectura del formulario con una composición institucional sobria,
una sola columna y una zona de redacción claramente protagonista.

# Comportamiento esperado

- El contexto del radicado se muestra compacto y fácil de identificar.
- La sección Redacción destaca el selector de plantilla, el textarea y su contador.
- Los documentos de soporte permanecen visibles y opcionales.
- El footer mantiene `Cancelar` y `Enviar respuesta` como acciones principales.
- El envío con o sin adjuntos conserva el comportamiento actual.

# Fuera de alcance

No se modificarán APIs, payloads, permisos, validaciones, endpoints, reglas de
negocio, contratos ni estados de carga y envío.

# Accesibilidad y responsive

Se conservarán etiquetas, relaciones ARIA, orden de teclado, foco visible,
tamaños táctiles y `prefers-reduced-motion`. Se validará en 320, 375, 440 px y
escritorio, sin overflow horizontal.

# Criterios de aceptación

- Las tres zonas del formulario tienen jerarquía visual diferenciada.
- El textarea es cómodo de usar y el contador sigue siendo legible.
- Los adjuntos opcionales siguen visibles y funcionales.
- Carga, éxito, error, reintento y envío sin PDF no presentan regresiones.
- No se generan llamadas API adicionales por cambios visuales.

# Plan de pruebas

- `tests/react/RespuestasInternas.test.jsx`.
- `tests/react/ConsultaRadicados.test.jsx`.
- `npm run test:legacy` y `npm run build`.
- Revisión manual por roles y viewports.

# Revisión visual aprobada

- Jerarquía del formulario clara, con títulos y acciones diferenciados.
- Redacción cómoda y legible.
- Contador visible, actualizado al escribir y borrar, sin solapamientos.
- Adjuntos claramente opcionales; selección y remoción ordenadas.
- Navegación con Tab/Shift+Tab coherente y foco visible.
- `scrollWidth <= clientWidth` con menús nativos cerrados:
  - 320 px: `true`;
  - 375 px: `true`;
  - 440 px: `true`;
  - escritorio: `true`.
- Resultado: revisión visual aprobada sin regresiones.

# Trazabilidad

- Frontend: `src/paginas/ConsultaRadicados.jsx` y
  `css/components/institutional-response.css`.
- Backend relacionado: ninguno.
- Spec anterior: FE-076.
