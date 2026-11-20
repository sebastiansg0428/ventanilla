# Mejora visual de adjuntos en respuestas internas

**Estado:** completed

## Objetivo

Mejorar la selección de documentos y la presentación de errores en el modal de
respuesta institucional, conservando los límites y contratos actuales.

## Comportamiento

- Se conservan el input real, `accept`, `multiple`, límites de 5 PDF y 10 MB
  por archivo.
- La interfaz muestra un selector accesible, una zona de arrastre, instrucciones,
  contador y tarjetas de archivos.
- Una selección inválida limpia únicamente el input de esa selección y conserva
  los adjuntos válidos que ya estaban cargados.
- Los archivos seleccionados pueden retirarse individualmente antes del envío.
- El foco visible se concentra en el botón de selección; la zona de arrastre no
  activa un segundo contorno cuando el input nativo oculto recibe el foco.
- La zona de arrastre se destaca únicamente durante el arrastre o cuando existe
  un error de validación.
- Cancelar la ventana nativa de selección de archivos mantiene abierto el modal
  de respuesta, conserva el texto y los adjuntos, y devuelve el foco al botón
  de selección.
- La tecla Escape cierra el modal únicamente cuando el selector nativo no está
  activo.
- El backend continúa validando el contenido real del PDF, incluidos archivos
  cifrados o protegidos con contraseña.

## Mensajes y estados

- Los errores de selección se muestran dentro del bloque de adjuntos.
- Los errores del servidor se separan del estado de carga y conservan el texto
  original recibido del backend.
- Cualquier error de validación del servidor limpia el estado visual de carga,
  mantiene visible el panel contextual de error y conserva el texto redactado
  y los adjuntos válidos anteriores.
- Un rechazo de PDF cifrado mantiene abierta la respuesta, conserva el texto y
  los adjuntos válidos, y permite corregir y reintentar.
- No se realizan reintentos automáticos ni llamadas duplicadas.

## Compatibilidad y accesibilidad

No se modifican endpoints, payloads, permisos, estados, tablas ni base de datos.
Se conservan `aria-invalid`, `aria-describedby`, `role="alert"`, estados
`aria-live`, foco visible, navegación por teclado y comportamiento responsive.

## Criterios de aceptación

- Cinco PDF se muestran con contador, tarjetas y acción para quitar.
- Siete PDF muestran el límite y conservan los adjuntos válidos anteriores.
- Un PDF cifrado muestra un panel claro con el mensaje backend original y una
  instrucción para reemplazarlo.
- El contenido de la respuesta permanece después de un error.
- El botón de envío vuelve a habilitarse y permite reintentar.
- La revisión visual confirma el comportamiento en escritorio, móvil y teclado.

## Revisión manual aprobada

- Escritorio validado.
- Se confirmó el límite de hasta 5 archivos PDF.
- Se confirmó el límite máximo de 10 MB por archivo.
- Se confirmó el rechazo de archivos PDF cifrados o protegidos.
- Se confirmó que `Enviando respuesta…` desaparece después del error.
- Se confirmó que la respuesta vuelve a estar habilitada para reintentar.
- Se conservaron las reglas, mensajes, contratos, permisos y payloads existentes.
