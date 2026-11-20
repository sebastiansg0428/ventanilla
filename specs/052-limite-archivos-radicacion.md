# Límite de archivos PDF en la radicación

**Estado:** completed

## Objetivo

Mantener una validación clara y segura para los documentos PDF adjuntos durante
la creación de un radicado, sin modificar los contratos actuales.

## Reglas

- Se permiten entre 1 y 5 archivos PDF por radicación.
- Cada archivo puede pesar como máximo 10 MB (10.485.760 bytes).
- Si el usuario selecciona más de 5 archivos, se rechaza la selección completa;
  no se toman automáticamente los primeros 5.
- Una selección inválida limpia el selector y los archivos seleccionados, muestra
  un mensaje accesible y no envía `POST /api/radicados`.
- Después del rechazo, el usuario puede volver a seleccionar una cantidad válida
  de archivos.
- La misma regla aplica a la selección mediante el explorador y al arrastre de
  archivos.

## Validación y compatibilidad

La validación del frontend proporciona retroalimentación inmediata, pero el
backend continúa siendo la autoridad final mediante los límites de Multer y la
validación real del contenido PDF. No se modifican rutas, payloads, permisos,
base de datos ni contratos públicos.

Los PDF cifrados o protegidos con contraseña continúan siendo rechazados por la
validación del backend cuando no pueden validarse correctamente. Ese rechazo es
independiente del límite de cantidad y tamaño de archivos.

## Accesibilidad y errores

El error de archivos permanece asociado al selector mediante `aria-invalid` y
`aria-describedby`. El mensaje se anuncia con `role="status"` y
`aria-live="polite"`.

## Criterios de aceptación

- Seleccionar seis PDF muestra el límite de cinco, deja el selector vacío y no
  realiza la petición de creación.
- Arrastrar seis PDF produce el mismo resultado.
- Seleccionar posteriormente cinco PDF muestra la lista completa y permite
  continuar con la radicación.
- Un PDF de más de 10 MB se rechaza sin enviar la petición.
- Un PDF cifrado conserva el mensaje de validación del backend y no genera un
  comprobante.
- Revisión visual manual aprobada con roles Administrador y Ventanilla:
  formulario, errores, reintentos, cinco PDF válidos, rechazo completo de
  seis archivos, archivos mayores de 10 MB y PDF cifrados.
- Se confirmaron contador, lista, botones `Quitar`, selección por explorador,
  teclado y arrastre, ausencia de llamadas `POST` inválidas, revisión
  responsive y ausencia de desbordamiento horizontal.
