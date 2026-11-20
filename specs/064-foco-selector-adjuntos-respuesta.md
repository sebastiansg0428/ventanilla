---
id: FE-064
title: Foco del selector de adjuntos en respuesta institucional
status: completed
risk: low
repository: ventanilla
backend_specs: []
---

# Contexto

El modal `Respuesta institucional` conserva un input real para seleccionar
PDF, pero ese input está visualmente oculto porque la interfaz usa el botón
`Seleccionar archivos PDF`. Al mantenerlo dentro del orden natural de
tabulación, el navegador puede enfocarlo después del botón y mostrar el texto
nativo del selector fuera de la composición visual del modal.

# Objetivo

Mantener el input real para selección, arrastre y pruebas de carga, pero dejar
el foco secuencial únicamente en los controles visibles del modal.

# Fuera de alcance

- No modificar endpoints, payloads, permisos, validaciones ni backend.
- No eliminar el input `adjunto-respuesta`.
- No cambiar límites de cantidad o tamaño, mensajes, arrastre, cancelación del
  selector nativo ni devolución del foco al botón visible.
- No agregar un focus trap JavaScript mientras el diálogo nativo mantenga el
  foco dentro del modal.

# Comportamiento esperado

- El input `adjunto-respuesta` conserva `id`, `accept`, `multiple`,
  `aria-invalid` y `aria-describedby`.
- El input tiene `tabIndex={-1}` para no aparecer en la navegación secuencial.
- El botón `Seleccionar archivos PDF` abre el input programáticamente.
- Después de seleccionar o cancelar, el foco vuelve al botón visible.
- Con archivos seleccionados, los botones `Quitar` siguen siendo alcanzables.
- `Cancelar` y `Enviar respuesta` siguen siendo alcanzables sin que el foco
  abandone el modal.

# Contrato backend relacionado

No aplica. La modificación es exclusivamente de foco y navegación en el
frontend; no cambia la carga de adjuntos ni el contrato de respuesta.

# Accesibilidad y responsive

- Conservar el nombre accesible del selector y sus relaciones ARIA.
- Confirmar foco visible en el botón institucional.
- Revisar cancelación del selector nativo sin cerrar el modal.
- Revisar 320, 375, 440 px y escritorio.
- Con los menús nativos cerrados, comprobar:

  ```js
  const anchoVisible = document.documentElement.clientWidth;
  const anchoContenido = document.documentElement.scrollWidth;

  anchoContenido <= anchoVisible
  ```

# Criterios de aceptación

- El input oculto no recibe foco al pulsar `Tab` después del botón visible.
- El foco permanece dentro del diálogo y alcanza `Cancelar` y `Enviar respuesta`.
- La selección, el arrastre, los errores y los adjuntos válidos anteriores
  conservan su comportamiento.
- No se generan llamadas HTTP adicionales.
- Pasan la prueba React relacionada, el build, la suite legacy y
  `git diff --check`.
- La spec permanece en `implementing` hasta la revisión visual humana.

# Plan de pruebas

- Pruebas React: `tests/react/ConsultaRadicados.test.jsx`.
- Build: `npm run build`.
- Suite legacy: `npm run test:legacy`.
- Integridad: `git diff --check`.
- Revisión visual manual: respuesta institucional con y sin adjuntos,
  selección por teclado, cancelación del selector, arrastre y responsive.

## Revisión visual aprobada

La revisión manual confirmó que la respuesta institucional funciona
correctamente con y sin adjuntos. Se validaron la selección por teclado, el
foco único en `Seleccionar archivos PDF`, la cancelación del selector nativo
sin cerrar el modal, la selección de archivos, el arrastre, los botones
`Quitar`, `Cancelar` y `Enviar respuesta`, además del comportamiento
responsive y la ausencia de llamadas HTTP adicionales. También se comprobó la
ausencia de desbordamiento horizontal con los menús nativos cerrados.

# Trazabilidad

- Frontend: `src/paginas/ConsultaRadicados.jsx`.
- Backend relacionado: ninguno.
- Tests: `tests/react/ConsultaRadicados.test.jsx`.
- Documentación: esta spec y `AGENTS.md` del frontend.
