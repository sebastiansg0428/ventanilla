# Selector accesible de archivos PDF

**Estado:** completed

## Objetivo

Mejorar la selección y carga de documentos PDF en el formulario de radicación,
conservando los límites funcionales, la validación backend y los contratos
existentes.

## Comportamiento

- El input real conserva su `id`, `name`, `accept`, `multiple`, etiqueta
  accesible y atributos de validación.
- La interfaz ofrece un control visible para seleccionar archivos y una zona
  identificable para arrastrarlos.
- Se informa el límite de 5 archivos y 10 MB por archivo.
- Una selección inválida se rechaza completa, limpia el selector y no envía
  `POST /api/radicados`.
- Una selección válida muestra el contador, los archivos y las acciones para
  quitarlos.
- La selección por teclado mantiene foco visible y activa el selector.

## Mensajes y accesibilidad

El error principal `Puedes adjuntar máximo 5 archivos PDF.` se conserva y se
acompaña con una explicación contextual sobre el rechazo completo y la forma de
corregirlo. Los errores continúan asociados al input mediante
`aria-describedby`, `aria-invalid`, `role="status"` y `aria-live="polite"`.

Los PDF cifrados o protegidos continúan siendo validados y rechazados por el
backend cuando corresponda. No se interpreta esa respuesta como un error del
selector ni se cambia su mensaje contractual.

## Compatibilidad

No se agregan endpoints, campos, payloads, permisos, migraciones ni cambios de
base de datos. El backend sigue siendo la autoridad para cantidad, tamaño y
contenido real de los documentos.

## Criterios de aceptación

- El selector visible funciona con teclado, explorador de archivos y arrastre.
- Seis archivos muestran el límite, explican el rechazo y dejan la selección
  vacía.
- Cinco archivos muestran contador, lista y botones para quitarlos.
- Los límites de tamaño, el rechazo de archivos no PDF y los PDF cifrados
  conservan su comportamiento.
- Revisión visual manual aprobada con roles Administrador y Ventanilla:
  selector visual y accesible, cinco PDF válidos, rechazo completo de seis
  archivos, archivos mayores de 10 MB y PDF cifrados.
- Se confirmaron contador, lista, botones `Quitar`, selección por explorador,
  teclado y arrastre, errores y reintentos, ausencia de llamadas `POST`
  inválidas, foco visible, responsive y ausencia de desbordamiento horizontal.
