# Ventanilla Única — interfaz React + Vite

## Estado de los radicados

El selector de Consulta conserva `Recibido` mientras sea el estado inicial.
Al avanzar a `En trámite` o `Pendiente`, deja de ofrecer el retorno a
`Recibido`; los dos estados intermedios pueden alternarse. Esto aplica también
al seguimiento de cada dependencia en radicados globales y al cliente legacy.
La API verifica la misma restricción. Si falla el guardado, se restablecen el
estado anterior y sus opciones; no cambian las reglas de cierre.

## Visibilidad de respuestas internas

Consulta carga la bandeja interna al entrar y muestra siempre los conteos de
respuestas totales, sin apertura y con apertura, incluso con el panel plegado.
Si inicialmente hay respuestas sin abrir, despliega sus tarjetas automáticamente.
Plegarla manualmente se respeta durante los filtros y actualizaciones.
Las respuestas al radicado de la dependencia de origen se presentan aquí,
separadas del listado de documentos recibidos. Mostrar tarjetas o contadores no
registra apertura: se mantiene la confirmación solo tras cargar el contenido y
los adjuntos mediante **Abrir respuesta**. Los errores y el reintento quedan
visibles también con la bandeja plegada.

**Abrir respuesta** despliega el contenido dentro de la tarjeta seleccionada,
no al final del listado. Solo se abre una respuesta a la vez; al cerrarla el
foco vuelve a su botón. Las actualizaciones conservan el detalle mientras
cargan; cambiar de filtro o página lo cierra y descarta cargas pendientes.
Si una actualización retira la tarjeta del listado, se limpia el detalle y el
foco vuelve al control de actualización.

## Consulta para dependencias

El panel de funcionarios organiza la consulta en tres pestañas:

- **Radicados**: vista inicial con indicadores, búsqueda, tipo de comunicación,
  listado, paginación y alertas por dependencia.
- **Respuestas internas**: respuestas a documentos iniciados por la dependencia,
  con filtros, recepción digital y detalle dentro de la tarjeta seleccionada.
- **Traslados**: solicitudes propias y seguimiento de su estado.

En el listado de radicados, la paginación solo se muestra cuando hay dos o más
páginas de resultados, tanto para dependencias como para administrador y
Ventanilla. Con cero o una página se oculta; no cambia la paginación de las otras
bandejas.

Las dos últimas muestran su contenido directamente, sin un segundo botón para
desplegar la bandeja. Las pestañas admiten flechas izquierda/derecha, Inicio y Fin.
Cambiar de pestaña conserva los filtros; salir de Respuestas internas cierra su
detalle, libera adjuntos temporales y descarta cargas pendientes.

Al ingresar siempre se muestra Radicados. Un aviso permite acceder a las respuestas
sin abrir sin cambiar automáticamente de pestaña. Consultar el resumen o navegar
no registra apertura: esta se confirma solo al mostrar la respuesta y sus PDF.
Si falla el resumen, se informa el error con reintento, no se presume que hay cero
pendientes. Traslados se consulta al acceder a su pestaña.

La presentación institucional y adaptable se limita al panel de dependencias:
no modifica la organización de administrador/Ventanilla, el cliente legacy,
los permisos ni los endpoints del backend.

## Iniciar en el computador

1. Abre una terminal en esta carpeta y ejecuta `npm install`.
2. En otra terminal, inicia el servidor desde `../backend` con `npm start`.
3. Ejecuta `npm run dev` aquí y abre la dirección que muestre Vite, normalmente `http://localhost:5173`.

Para generar la versión de publicación ejecuta `npm run build`; para verla localmente usa `npm run preview`.

## Organización del código

- `index.html`, `consultar.html`, `login.html`, `registro_usuario.html` y `catalogos.html` son las entradas de Vite y conservan las direcciones que ya usa el proyecto.
- `src/main.jsx` inicia React; `src/Aplicacion.jsx` selecciona la pantalla correspondiente a la dirección abierta.
- `src/paginas/` contiene las pantallas: radicación, consulta, inicio de sesión, gestión de usuarios y gestión de catálogos.
- `src/componentes/Compartidos.jsx` reúne componentes que varias pantallas reutilizan, como la protección de sesión y la navegación.
- `src/servicios/api.js` centraliza las solicitudes autenticadas al backend; `src/servicios/comprobante.js` genera el recibo.
- `public/vendor/jspdf.umd.min.js` contiene la copia local de jsPDF, por lo que no se depende de un CDN.

### Carga perezosa de jsPDF

Radicación y Consulta no descargan jsPDF al abrir la página. El servicio de
comprobantes carga la copia UMD local mediante `src/servicios/cargar-jspdf.js`
solo cuando necesita generar un PDF, respetando la ruta base de Vite. En
Consulta ocurre al pulsar **Ver comprobante**; en Radicación se conserva la
generación automática después del guardado confirmado y el reintento manual.
Consultar una respuesta o sus PDF adjuntos no necesita esta librería.

Las solicitudes concurrentes comparten una carga y las siguientes generaciones
reutilizan el constructor. Un error de red, exportación inválida o espera de
más de 15 segundos informa un fallo y permite reintentar; no vuelve a radicar
un documento ya guardado. Este límite es de carga del recurso, no de las
pruebas. No se modifica el contenido, escudo, nombre ni paginación del PDF,
ni el generador legado.

La copia local pesa 441160 bytes (430,8 KiB sin comprimir): se difiere esa
descarga, no se elimina. La primera generación puede tardar más porque ahora
incluye cargar/evaluar la librería. Para verificarlo, usar el build con caché
desactivada en Network: cero solicitudes `jspdf.umd.min.js` al inicio, una al
primer comprobante y ninguna carga adicional en el segundo. Los bytes
transferidos dependen de compresión, caché y servidor.

Validación dirigida:

```powershell
npm run test:react -- tests\react\CargarJsPdf.test.jsx tests\react\Comprobante.test.jsx tests\react\Radicacion.test.jsx tests\react\ConsultaRadicados.test.jsx
npm run test:legacy
npm run build
```
- `css/style.css` conserva los estilos existentes y los complementa para los componentes de React.

## Diagrama de flujo

Consulta el [diagrama actual de navegación, sesión y operaciones](./docs/diagrama-flujo.md). Describe los flujos implementados en el frontend React y su comunicación con el backend independiente.

Los nombres de carpetas, pantallas, componentes y funciones propios de la interfaz están en español. Algunas claves se conservan intencionalmente: nombres de campos, rutas y respuestas como `usuario_recibe`, `/api/radicados` y `message` forman parte de la comunicación con el backend o el navegador. Cambiarlas unilateralmente puede romper el contrato entre frontend y servidor.

## Sesión y permisos

El inicio de sesión guarda el token en `sessionStorage`. Las pantallas protegidas confirman la sesión con `/api/auth/me`. La interfaz organiza la navegación según el rol, y el backend mantiene la autoridad para validar permisos.

Al crear o cambiar una contraseña, la gestion valida antes de enviar la misma
politica del backend: minimo 10 caracteres (puntos de codigo Unicode), una
mayuscula, una minuscula, un digito del 0 al 9 y un simbolo que no sea espacio;
maximo 72 bytes UTF-8 y sin caracter nulo. No equivale a 72 caracteres cuando
hay acentos u otros caracteres multibyte. En edicion, dejar la clave vacia la
conserva. El login no aplica esta complejidad retroactivamente a claves antiguas.
La validacion del navegador es una ayuda; el servidor sigue validando siempre.

Para `ventanilla` y `administrador`, el responsable se muestra en un campo de
solo lectura con el nombre de la sesión autenticada, sin cargar ni seleccionar
otro funcionario. El backend registra `req.usuario.nombre`, no un valor enviado
por el formulario. El comprobante conserva el responsable confirmado por el servidor.

La pantalla `registro_usuario.html` es la gestión de usuarios, disponible solo para administradores. Consume `GET/POST /api/usuarios`, `GET/PUT /api/usuarios/:id`, `PATCH /api/usuarios/:id/estado` y `GET /api/dependencias` mediante el servicio centralizado, que adjunta el token guardado en `sessionStorage`. Las cuentas se activan o inactivan (no se eliminan físicamente). Al editar la propia cuenta, el administrador cierra la sesión local porque el backend revoca sus sesiones. El backend debe tener aplicada la migración `006_usuarios_activos.sql` antes de usar estas funciones.

La pantalla `catalogos.html` permite a administradores crear, editar e inactivar/reactivar dependencias y tipos de trámite. Usa los endpoints de `/api/dependencias` y `/api/tipos-tramite`; al crear un tipo envía también los datos de su término legal inicial. La edición del tipo solo modifica código, nombre, categoría y orden; los cambios de plazo se registran como nuevas versiones con `POST /api/terminos-legales` y `tipo_tramite_id`, para conservar el historial.

## Detalle e historial de actuaciones

El detalle organiza resumen, asunto, remitente, trámite, documentos e historial.
La dependencia responsable **actual** del resumen no se atribuye a los eventos
anteriores; los destinos globales conservan su seguimiento por dependencia.
El diálogo tiene nombre accesible, foco inicial en el título y retorno al botón
del radicado al cerrarlo, también con Escape.

**Registrado por** identifica la cuenta que realizó o confirmó la operación.
La oficina se explica **en cada evento**: destinataria al radicar, atendida al
responder, origen de la solicitud en traslados u origen que abrió una respuesta
interna. No identifica necesariamente la oficina del usuario. Si falta ese dato,
no se hereda de otro evento ni se reconstruye desde el catálogo actual.

Los registros consecutivos del mismo usuario y minuto se agrupan visualmente,
conservando cada evento y su hora. No significa simultaneidad exacta ni acciones
manuales independientes: una radicación genera también registros automáticos,
como la regla de respuesta. Los identificadores de usuario distintos no se unen
por tener el mismo nombre. Para externos, guardar una respuesta no acredita su
envío o entrega; esta advertencia no exige evidencias físicas para internos.

El orden es el de registro dentro del conjunto cargado; **Cargar eventos
anteriores** conserva la paginación. Las fechas UTC se muestran en Bogotá y las
históricas sin zona confirmada mantienen esa advertencia. No se modifican los
datos históricos, los permisos ni la base de datos.

## Confirmación al guardar una respuesta

Al pulsar **Enviar respuesta**, el modal bloquea el doble envío y el cierre
mientras espera la confirmación del servidor. Si el guardado falla, conserva
texto, plantilla y PDF seleccionados y muestra el error.

Tras confirmar el guardado, el modal permanece abierto en modo consulta con
**Respuesta guardada correctamente** y carga la respuesta y sus PDF autenticados.
Para externos, esa confirmación no acredita envío ni entrega al destinatario.
La tabla se actualiza sin exigir cerrar el modal.

Si falla la consulta posterior o la descarga de un PDF, se conserva la confirmación
del guardado y se permite **Reintentar consulta de respuesta**: repite solamente
la lectura, nunca el envío. No se muestran adjuntos ausentes como si no existieran.
Al cerrar o perder acceso se descartan resultados tardíos y se liberan los enlaces
temporales. Abrir después desde **Ver respuesta** no repite la confirmación de
guardado. No se cambian permisos ni el circuito interno o externo.

## Respuestas internas digitales

Para internos individuales, responde únicamente la dependencia responsable.
Ventanilla y administrador consultan respuesta/trazabilidad; no responden ni
marcan apertura por el origen. La excepción administrativa para responder
externos permanece. Globales e informativos mantienen su comportamiento.

En Consulta, cada funcionario dispone de **Respuestas internas recibidas**
para su dependencia de origen, con filtros, contadores y páginas de 25.
Al guardar una respuesta queda disponible en esta bandeja; entrar/actualizar
consulta los cambios, sin correo, push ni actualización en tiempo real.
El origen solo accede a respuesta y PDF autenticados, no a la gestión del expediente.
No se exigen constancias físicas ni el formulario externo de envío/entrega.

Mostrar correctamente la respuesta y sus PDF registra automáticamente la
primera apertura en el servidor. Listar, precargar, consultar trazabilidad desde
Ventanilla/destino y descargar un archivo no marcan lectura. Una consulta desde
el origen que también es destino sí registra apertura al mostrar la respuesta.
La primera apertura conserva actor/hora en reintentos; si falla se muestra error
y botón de reintento sin ocultar el contenido ni fingir un acuse confirmado.
La hora se muestra en Bogotá. Las respuestas históricas no inventan lecturas
ni disponibilidad anterior; la apertura técnica no acredita comprensión legal.
Se descartan respuestas tardías al cerrar y se liberan los enlaces blob.

El modal de respuesta institucional y el detalle de la bandeja identifican
**Respuesta dirigida a** con la dependencia de origen, distinta de la oficina
que respondió. Comparten dos hitos: **Respuesta disponible**, con fecha de
disponibilidad en Bogotá, y **Primera apertura pendiente/registrada**, con fecha
y funcionario cuando está confirmada. La bandeja muestra tarjetas con radicado,
receptor de origen, oficina que respondió, estado y fechas resumidas de
disponibilidad/primera apertura en Bogotá; listar no marca apertura. Un nombre
de origen ausente se indica como **Dependencia de origen no
registrada**, sin sustituirlo por la oficina responsable de responder. Las
fechas ausentes e históricas se aclaran sin inventar disponibilidad anterior.
Los indicadores siempre incluyen texto y los hitos se apilan en pantallas
pequeñas. Esto no agrega correo ni actualización automática, ni cambia quién
puede registrar apertura. La apertura no acredita comprensión ni notificación
legal.

El encabezado y los controles siguen el estilo compacto de Traslados, con
botones adaptables y foco visible. La bandeja inicia contraída, con filtro
**Todas**, y no hace consultas hasta abrirla. Total/Sin apertura/Con apertura
resumen toda la bandeja de la dependencia, no la página visible; el total del
filtro se indica aparte. El vacío distingue filtros y permite **Ver todas las
respuestas internas** cuando corresponde, sin paginación vacía. La carga y los
errores se muestran explícitamente, no como ausencia de respuestas.

**Abrir respuesta** conserva la vista dentro de la bandeja, agrupando contenido
con sus saltos de línea, adjuntos PDF y los dos hitos completos. Los adjuntos
muestran nombre/tamaño y abren en otra pestaña; si no existen, se informa.
Un fallo de carga permite **Reintentar carga de respuesta** sin registrar
apertura antes de cargar correctamente el contenido y todos sus PDF.
Cerrar durante la carga descarta resultados tardíos y libera URLs temporales.
El foco pasa al radicado abierto; al cerrar vuelve a la tarjeta o a Actualizar
bandeja interna si la lista reemplazó el botón original.

Las fechas históricas siguen identificándose como disponibilidad anterior
desconocida; una primera apertura ausente no significa respuesta no disponible.
Los estilos nuevos están acotados a la bandeja, sin rediseñar el modal
institucional, Traslados ni seguimiento de entrega. Validación: 28 pruebas
dirigidas, regresiones de Consulta/Traslados/SeguimientoEntrega, build y 39
escenarios en Edge aislado a 320/390/1440 px, además de apertura por teclado.
No requiere cambios de backend o migraciones.

Requiere **027 aplicada y verificada en desarrollo**, con respaldo restaurado y
ensayo local previo. Se incorporaron cuatro respuestas históricas sin inventar
lecturas. Reiniciar el backend y recargar el frontend para usar el circuito.
En otras bases sin 027 se informa no activado y no se permiten nuevas respuestas
internas individuales; los externos y la consulta histórica conservan su circuito.

## Envío y entrega manual de respuestas

En Consulta → **Ver respuesta**, las respuestas externas individuales incluyen
**Ver seguimiento de entrega**, con carga diferida, historial de 25 y evidencias.
El panel destaca el estado y muestra acciones compactas. **Registrar envío/entrega**
abre el formulario bajo demanda: dos columnas con espacio suficiente y una en
móvil. **Volver al historial** conserva el borrador y los PDF seleccionados
mientras el componente siga montado; la lista permite quitar esos archivos.
El formulario coloca el foco en Canal al abrir y vuelve al resumen tras confirmar.
El historial usa tarjetas y solo muestra paginación si hay más de una página.
Solo Ventanilla/administrador registran o anulan; funcionarios con acceso actual
consultan. Internos, globales y documentos sin respuesta no muestran el módulo.
Requiere backend con **025** activada; **aplicada y verificada en desarrollo**
con respaldo restaurado y ensayo local previo. Reiniciar el backend para cargar
el código del módulo. Otras bases sin 025 muestran el error 503, sin impedir
ver la respuesta. El nuevo formulario requiere además **026, aplicada y verificada
en desarrollo** con respaldo restaurado y ensayo local previo. En otras bases
sin 026 se muestra el aviso y no permite registrar nuevos envíos; el historial,
descargas y anulaciones siguen funcionando. Cada base requiere autorización y
respaldo verificado independientes antes de aplicar migraciones.

Se registra correo manual, presencial o mensajería, con destinatario/destino
confirmados y resultado. La hora se genera en el servidor al confirmar y se
muestra en Bogotá: no hay fecha editable ni registro retrospectivo. El reintento
conserva la fecha original. Los PDF institucionales aparecen preseleccionados en
una lista con casillas junto al selector de nuevas evidencias (el navegador no
permite rellenar su input de archivos con rutas del servidor).
Se admiten hasta 5 PDF de respuesta y 5 evidencias nuevas de 10 MB sin contraseña;
los originales se conservan y se guarda una copia independiente por envío.
Acreditar requiere evidencia adicional de recepción; adjuntar de nuevo el mismo
oficio no sirve como único soporte. La comparación detecta igualdad de bytes,
no certifica validez jurídica del documento.
Intento fallido exige
observaciones. Una acreditación vigente bloquea nuevas actuaciones; anular con
motivo conserva tarjeta y PDFs y permite corregir mediante otro registro.
La fecha legada se rotula **Fecha de registro de respuesta**, no entrega.
No se envían correos ni se determina notificación legal o cierre documental.

Durante el envío se bloquean doble clic, edición y cierre del modal. Si el
resultado es incierto, se conserva FormData/UUID/PDF para reintento exacto;
también se bloquean volver al historial y cambiar de operación hasta resolverlo.
al cerrar/recargar, consultar historial antes de registrar de nuevo.
Las descargas usan el servicio autenticado, descartan resultados tardíos y
liberan URLs blob al cerrar la vista. Se reutilizan los estilos adaptativos del
modal y sus formularios, sin modificar globalmente otros diálogos.

## Traslados mediados por Ventanilla

Requiere backend con la migracion **023** aplicada antes de iniciar esta version.
Desde Consulta, el funcionario puede **Solicitar traslado** solo para radicados
individuales abiertos. Indica motivo y dependencia activa sugerida; no cambia
directamente el destino. Mientras se revisa, su dependencia sigue responsable,
puede responder o registrar Enterado si corresponde y el plazo continua.

Los selectores de solicitud y aprobacion usan `/api/traslados/dependencias`,
independiente del catalogo limitado de alertas. Ofrecen todas las dependencias
activas excepto el origen actual (por ejemplo, SEDAM si esta activa). Muestran
carga, error con reintento o ausencia de destinos disponibles, sin permitir
enviar una solicitud o aprobacion sin destino valido. Un fallo del catalogo no
impide rechazar una solicitud con justificacion. El catalogo se consulta al
abrir el modal o la bandeja central y no concede acceso a expedientes ajenos.

**Mis solicitudes de traslado** conserva comprobantes de la dependencia de
origen aunque el expediente deje de aparecer. **Gestionar traslados**, para
Ventanilla/administrador, abre la bandeja paginada de 25 con filtro, contador
de pendientes y decision justificada. Al aprobar se confirma el destino; al
rechazar A conserva la asignacion. El control central debe explicar tambien
cualquier cambio frente al destino sugerido. Una finalizacion previa cancela
automaticamente la solicitud pendiente.

El panel mantiene el titulo por rol visible aun contraido y consulta solo al
abrirlo. El filtro inicial sigue siendo Pendiente de Ventanilla. Los indicadores
distinguen pendientes de la bandeja (del origen para funcionarios) y solicitudes
del filtro completo, no solo las de la pagina actual. Un estado vacio muestra
una explicacion segun filtro y permite Ver todos los estados, sin paginacion
vacia; los errores y la carga nunca se presentan como ausencia de solicitudes.

Cada tarjeta resume radicado, estado textual, origen, destino sugerido o aprobado
y vencimiento conservado. **Ver motivos y trazabilidad** despliega todos los
detalles, incluidos solicitante, decisor, motivos y fechas en Bogota. Los datos
ausentes se identifican sin inventar actores o fechas. El destino sugerido no
significa que esa oficina ya sea responsable. Las etiquetas combinan texto y
color, con controles de teclado y un diseno apilado para movil.

**Resolver traslado** abre el formulario solo en pendientes de Ventanilla o
administrador; no envia ninguna decision al abrirlo. El foco pasa al formulario
y vuelve al boton al cerrarlo. Cerrar decision esta bloqueado durante un envio
y ante confirmacion incierta. En este ultimo caso tambien se bloquean ocultar,
cambiar filtro, paginar y otras decisiones: permanece disponible Reintentar
decision o Actualizar traslados para consultar el resultado. Actualizar puede
descartar el formulario incierto, por lo que debe comprobarse el estado antes
de decidir de nuevo. Ninguna de estas consultas envia otro POST por si sola.
El formulario independiente Solicitar traslado conserva su comportamiento.

Los estilos del redisenio estan acotados al panel: no cambian los paneles de
recepcion interna o seguimiento de entrega que comparten `traslados-datos`.
Validacion: 29 casos en `tests\react\Traslados.test.jsx`, regresiones de Consulta,
RespuestasInternas y SeguimientoEntrega, build y navegador Edge aislado con
fixtures a 320/390/1440 px. No requiere migraciones ni cambios de backend.

Se mantienen numero, fechas, documentos, estado operativo y vencimiento.
No aplica a globales ni radicados finalizados. El origen pierde acceso al
expediente tras aprobar; el comprobante no incluye PDFs ni respuestas posteriores.
No confundir con la plantilla de respuesta "Traslado por competencia".

Los envios bloquean doble clic y controles durante confirmacion. Ante resultado
incierto se conserva el intento y se bloquea su edicion para repetir exactamente
los datos. La clave vive solo mientras sigue abierto el formulario: si se
recarga o cierra, consultar la bandeja antes de iniciar otra solicitud. Los errores se muestran,
sin anunciar exito antes de confirmarlo. No hay correo ni notificaciones push.
Las vistas temporales se limpian al recibir un rechazo de acceso 403/404;
no se pueden revocar copias ya descargadas en otro dispositivo.

## Interfaz adaptable

Las cinco pantallas (login, radicacion, consulta, usuarios y catalogos) ajustan
formularios, filtros y acciones al espacio disponible. Hasta 767px, la
navegacion usa **Abrir/Cerrar menu**, con estado accesible; Escape lo cierra y
devuelve el foco al boton. Los enlaces siguen respetando el rol de la sesion.

En movil, los listados de radicados, usuarios, dependencias, tramites e
historial de terminos se presentan como tarjetas con todos sus campos
etiquetados. Cada registro mantiene una sola estructura y sus acciones
originales. Desde 768px se conservan las tablas; cuando no caben, su contenedor
permite desplazamiento horizontal y acceso por teclado, sin ensanchar la pagina.
Los modales conservan desplazamiento interno y acciones alcanzables.

La validacion visual se realiza con datos ficticios en Edge aislado y anchos
de 320, 360, 440, 768, 1024, 1366 y 1920px, incluyendo poca altura y nombres PDF
largos. Es emulacion de navegador, no una certificacion en dispositivos fisicos.
Estos ajustes no modifican permisos, operaciones del backend ni MySQL.

## Reintentos de radicación

El backend debe tener aplicada la migración 022. Cada envío lleva una clave
`Idempotency-Key`; ante pérdida de conexión, confirmación ilegible, 5xx o 409,
la pantalla conserva el formulario y los PDFs originales, bloquea su edición
y ofrece **Reintentar confirmación** con la misma clave y contenido.
Un rechazo definitivo 4xx (excepto 409) permite corregir y hacer otro intento.
El guardado confirmado limpia el intento; si falla el comprobante, reintentar
su descarga no vuelve a radicar.

Esta recuperación existe **solo mientras permanece abierta la misma pantalla**.
No recargues, cierres ni abandones la radicación con confirmación pendiente.
Si ya lo hiciste, busca primero el expediente en Consulta antes de radicarlo
de nuevo: no se conserva el intento en almacenamiento del navegador.
La idempotencia se aplica a crear radicados, no a respuestas o traslados.

## Adjuntos de respuesta institucional

Ver respuesta y Responder comparten el encabezado azul institucional, el numero
de radicado en una segunda linea, las tarjetas y el estilo de adjuntos.
Enviar respuesta se distingue como accion principal; Cerrar/Cancelar son
secundarias. Los campos muestran foco visible y estados deshabilitados.
El cuerpo tiene desplazamiento interno y mantiene encabezado y acciones
fuera de ese desplazamiento. En movil los datos se apilan y los nombres PDF
largos se ajustan sin ensanchar el dialogo. El ancho maximo se conserva en 54rem.

El modal admite hasta 5 PDFs de hasta 10 MB (10.485.760 bytes) cada uno.
Una selección inválida muestra una alerta fuera del cuerpo desplazable y
conserva los adjuntos válidos anteriores, el contenido y la plantilla. La lista
de archivos seleccionados indica qué documentos se enviarán aunque el selector
nativo quede vacío tras el rechazo. Una selección válida nueva reemplaza la
anterior; los adjuntos siguen siendo opcionales.

Mientras se envía la respuesta, se bloquean los campos, el cierre, Cancelar y
Escape, y no se permite un segundo envío simultáneo. Si falla, se conservan el
contenido, la plantilla y los PDFs para corregir o reintentar; si se confirma,
se actualiza la asignación correspondiente y se cierra el modal.

En Consulta, cerrar o cambiar un detalle o respuesta invalida sus lecturas
pendientes: una solicitud tardía no puede reabrir el modal ni mostrar documentos
de otra selección. Las URLs temporales de los PDFs se liberan al descartarlos,
cerrar, reemplazar la vista o salir de la página.

## Fecha de radicacion

Tabla, detalle, contador y filtro de hoy y comprobante de Consulta usan
`fecha_hora_recepcion` en `America/Bogota`. Un DATETIME sin zona se interpreta
como hora de Bogotá; una fecha con `Z` u offset conserva su instante.
`fecha_creacion` solo se usa como respaldo histórico cuando falta la recepción.
Si la recepción existe pero es inválida, se muestra **Fecha no válida**, no
cuenta como registro de hoy y no se genera un comprobante con otra fecha.
La ausencia de ambas fechas se muestra como **Fecha no disponible**.

El comprobante inicial conserva la fecha legible que confirma el servidor;
Consulta usa la misma zona y formato. No se cambian registros existentes,
plazos legales, semáforos ni fechas de respuesta o enterado.

## Consulta paginada y alertas

Consulta carga hasta 25 filas por pagina y envia los filtros al backend.
La busqueda espera 250 ms despues de escribir (maximo 150 caracteres).
Cambiar filtros vuelve a la primera pagina; los contadores Total, Criticos y
Registrados hoy provienen del conjunto autorizado completo, no de la pagina.
El total filtrado se muestra por separado. Los globales mantienen una fila por
asignacion autorizada. Consultas tardias no sustituyen filtros mas recientes.

Alertas tiene paginacion independiente por dependencia. Sus grupos muestran
solo la pagina actual, mientras el mensaje informa el total real. Cambiar de
dependencia descarta respuestas pendientes de la oficina anterior. Una respuesta
o cambio de estado exitoso recarga Consulta y las alertas seleccionadas; errores
de carga se muestran explicitamente y Consulta permite reintentar.

El panel **Alertas por dependencia** conserva el selector restringido y
preseleccionado del funcionario; Ventanilla y administrador eligen entre sus
dependencias permitidas. Sin seleccion muestra orientacion, sin grupos ni
paginacion vacios. Una consulta valida sin alertas muestra un aviso unico;
errores de catalogo/consulta se distinguen de carga y ausencia de resultados.
Actualizar vuelve a consultar, sin acciones nuevas ni notificaciones.

Los grupos **Proximos a vencer** y **Vencidos** usan tarjetas con radicado,
remitente, etiqueta textual de urgencia y fecha limite actual recibida de la API.
Una fecha ausente se indica como No registrada, sin calcular ni alterar plazos.
Los conteos de grupo estan etiquetados **en esta pagina**; el total real y
cantidad mostrada se informan aparte. Un grupo sin filas no significa que no
existan alertas de ese tipo en otras paginas. La paginacion independiente se
muestra solo con una consulta valida de varias paginas.
Los estilos estan acotados al panel, con columnas en escritorio, apilado en
movil y foco visible, sin cambiar la paginacion de radicados ni paneles vecinos.
Las tarjetas no conceden acceso a expedientes ni incorporan acciones de gestion.
Se verifican seleccion inicial, vacio/error/carga, fechas ausentes, grupos,
conteos, paginacion y descarte de respuestas tardias, incluida seleccion vacia.
Navegador Edge aislado: 45 escenarios a 320/390/1440 px con tres roles y
datos ficticios, sin escrituras; navegacion por teclado comprobada.

Reinicia el backend actualizado antes de usar esta interfaz: necesita los campos
de paginacion y resumen nuevos de `/api/radicados` y `/api/alertas`. No requiere
migracion ni envio automatico al ciudadano.

## Trazabilidad del expediente

El modal de detalle consulta `GET /api/radicados/:numero_radicado/historial` y
muestra una línea de tiempo paginada de eventos de negocio. La API aplica los
permisos existentes del radicado; el Timeline no muestra direcciones IP ni UUID
de sesión. Las filas históricas anteriores a la migración 021 aparecen como
eventos heredados y conservan su hora sin asumir que sea hora Bogotá. Los
eventos nuevos se presentan en `America/Bogota`.

El detalle inicia con un resumen (estado y requisito de respuesta como etiquetas
de color, fecha de radicación, fecha límite y tiempo de respuesta) y organiza el
resto en las secciones Remitente, Trámite, Asunto y Documentos adjuntos.

Cada evento muestra acción, fecha y hora, descripción, actor y dependencia. Los
cambios de estado y ampliaciones muestran sus valores anteriores y nuevos. Los
eventos consecutivos del mismo actor identificado ocurridos en el mismo minuto se
agrupan en una sola tarjeta (por ejemplo, los registrados al crear el radicado);
la agrupación es solo visual: cada evento sigue listado y no se modifica la base.
La lista conserva el orden cronológico de los eventos cargados y permite
solicitar los anteriores.
El modal aprovecha su ancho disponible y mantiene el encabezado y cierre visibles
mientras se desplaza el contenido, también en pantallas estrechas.

El modal de respuesta usa el mismo ancho y estilo. En modo consulta muestra un
resumen (responsable, dependencia, fecha de envío y plantilla como etiqueta), el
contenido de la respuesta y los PDF adjuntos con su tamaño. En modo redacción
resume el radicado a responder (asunto y remitente) y separa las secciones
Redacción, con contador de caracteres, y Adjuntos de la respuesta.

Aplica `021_audit_log_radicados.sql` después de la migración 020 antes de
esperar que el nuevo registro de eventos funcione en el backend.

## Confirmacion de radicacion y comprobante

Cuando el servidor confirma el registro, la pantalla muestra el numero guardado
y reinicia el formulario aunque falle la generacion o el inicio de descarga del
PDF. El error del comprobante se muestra por separado y permite usar
**Reintentar comprobante** sin enviar otra solicitud de radicacion.

El reintento usa los datos del ultimo comprobante guardados en memoria, no los
campos que se esten diligenciando para otro documento. Esos datos se pierden al
recargar o salir de la pagina; el comprobante tambien se puede obtener desde
Consultar radicados. Una descarga iniciada no confirma que el usuario haya
guardado el archivo en su equipo.

Esto no agrega idempotencia: si se pierde la respuesta de red despues de guardar
en el servidor, se debe comprobar el registro en Consulta antes de repetirlo.

## Código anterior
Los scripts de la interfaz anterior se conservan en `legacy/js/`; las páginas
actuales cargan los componentes de `src/`. Se mantiene el generador de recibos
legado y sus pruebas, separado del generador React.

## Validacion y pruebas

```powershell
npm run test:react
npm run test:legacy
npm run build
```

En las pruebas de Consulta, los helpers completan con `act` el render y los mocks
inmediatos antes de consultar sus resultados. Los escenarios de solicitudes
pendientes conservan sus promesas diferidas y las comprobaciones de cierre,
permisos, doble envío y limpieza de PDF.

La prueba de paginación conserva 53 registros y comprueba el debounce de búsqueda:
no hay consulta antes de 250 ms y al cumplirse ese plazo se vuelve a la primera
página. Solo esa fase usa reloj falso, restaurado en `finally`; las interacciones
de `userEvent` se ejecutan antes, con reloj real. No combinar ese reloj falso con
las esperas asíncronas de Testing Library: su drenaje de cola usa un temporizador
de cero ms y esta configuración Vitest no lo avanza automáticamente. El pegado
con `userEvent` sigue cubierto por las pruebas de filtros.

Las cuatro suites del comando dirigido conservaron los mismos 108 casos y
aprobaron dos ejecuciones completas consecutivas, sin aumentar timeouts ni
desactivar el aislamiento. Estos resultados no garantizan tiempos constantes
bajo cualquier carga del equipo ni sustituyen validar toda React cuando se
modifica el setup compartido.

`tests/react/` cubre formularios, sesion, catalogos, consulta, adjuntos y
comprobantes con React Testing Library y servicios simulados. Las pruebas
legadas cubren `legacy/js/`; no sustituyen las pruebas React. Ninguna de estas
suites constituye una prueba de extremo a extremo con el backend y MySQL reales.
Para comprobar estabilidad, ejecuta `npm run test:react` dos veces consecutivas:
ambas deben aprobar sin errores no controlados. Se conserva el aislamiento por
archivo y no se amplian los timeouts globales. Las pruebas usan consultas
acotadas al control o region y pegado para preparar textos; los casos que
comprueban escritura manual siguen simulando las teclas. Los dobles de alerta
y URLs de descarga conservan el objeto `window` y el constructor `URL`.

Vitest usa `pool: 'threads'` con un solo worker y aislamiento por archivo para
reducir la presion de procesos en el entorno local. No usar `vmThreads` como
sustituto directo: el doble de navegacion del login necesita poder sustituir
`window`, que no es configurable en ese entorno VM.

En seguimiento de entrega, esperar con `waitFor` el foco que establece React y
con `findBy*` la tarjeta anulada que llega al actualizar el historial. El mensaje
de confirmacion del POST no garantiza que ya haya terminado el GET posterior.
No sustituir estas comprobaciones por pausas fijas ni ampliar timeouts.

Para validar solo consulta, seguimiento de entrega y respuestas internas:

```powershell
npm run test:react -- tests\react\ConsultaRadicados.test.jsx tests\react\SeguimientoEntrega.test.jsx tests\react\RespuestasInternas.test.jsx
```

Estas tres suites incluyen 102 casos, con regresiones de receptor e hitos de
recepción interna. Acotan las consultas con `within` al
modal, fila o seccion y reutilizan controles cuando siguen montados, evitando
recalcular nombres accesibles de toda la pagina. No omiten las comprobaciones
de visibilidad, foco ni bloqueo de controles. Para mocks de respuesta inmediata,
`await act(...)` completa las actualizaciones antes de consultar el resultado;
las pruebas de solicitudes pendientes mantienen promesas diferidas y esperas
observables para comprobar cargas, carreras y respuestas tardias.

El helper `tests/react/helpers/estilos-dom.js` prepara los estilos reales de
jsdom en `beforeAll` solo en estas suites: evita que su inicializacion diferida
consuma el tiempo del primer caso. No sustituye `getComputedStyle` ni elimina
ese coste del tiempo total. Se mantienen los timeouts, el aislamiento, las
interacciones de `userEvent` y los archivos PDF reales de las pruebas de limites.
Al ajustar estos helpers, repetir el comando dirigido dos veces consecutivas;
ambas ejecuciones deben aprobar todos los casos sin omisiones ni errores no
controlados. La duracion total puede variar con la carga del equipo.

Para ensayos reales de navegador, usar backend/base/uploads y perfil separados,
con usuarios y PDF ficticios; no basta con cambiar la base dejando la API de la
interfaz apuntando al servidor de desarrollo. Comprobar persistencia y retirar
solo los recursos creados por el ensayo.

Para preparar una base nueva consulta la secuencia 000-020 en el
[README del backend](../backend/README.md); su ejecucion real en una base aislada
sigue pendiente de validacion y no debe hacerse sobre la base de uso actual.

### Responsable en el modal de respuesta institucional

«Ver respuesta» muestra «Respondida por», «Dependencia responsable» y
«Fecha de envío» en el modal **Respuesta institucional**, junto al contenido y
los adjuntos. Aplica a internas y externas; en globales corresponde a la
asignación de la fila seleccionada. El endpoint completo
`/api/radicados/:numero_radicado/respuesta` proporciona estos datos sin otra
consulta adicional. Una dependencia no disponible se muestra «No registrada».

El detalle del radicado conserva el estado, pero no incluye el bloque de
respuesta ni consulta `/respuesta/resumen`. Ese endpoint se conserva en el
backend por compatibilidad. El formulario para redactar respuestas no cambia;
los datos del autor se muestran al consultar una respuesta ya guardada.

Esta mejora no cambia los permisos de consulta ni permite radicar a funcionarios.
Requiere el backend actualizado y reiniciado; no necesita migración.

### Procedencia en el registro de radicados

En «Clasificación y tipo de recepción», elegir **Interna** muestra el select
obligatorio **Dependencia remitente** con oficinas activas del mismo catálogo
del destino, sin la opción «Todas». Nombre y cédula siguen siendo obligatorios.
Elegir **Externa** elimina el origen del formulario y exige tipo de persona
natural/jurídica y correo válido. Para jurídicas también exige razón social y
NIT; no sustituye la identificación de la persona de contacto. El límite de
entidad/razón social es 150 caracteres, compatible con MySQL.

En internas, «Entidad / empresa» sigue visible pero deshabilitado y sin
obligatoriedad; no se envía al servidor. El texto escrito previamente se conserva
para recuperarlo al volver a Externa. El NIT sigue habilitado y opcional en
internas; para externas jurídicas conserva su obligatoriedad.

Cambiar de clase limpia las selecciones incompatibles. Un rechazo conserva
el formulario; un guardado exitoso limpia los campos y conserva el comprobante
para reintentar solo su descarga. El recibo inicial usa el nombre de origen
confirmado por el servidor, igual que el detalle y el recibo regenerado.
Las internas históricas sin procedencia muestran «No registrada».
Los generadores React y legado aceptan la procedencia, pero el formulario
legado no se amplía: un cliente antiguo debe actualizar su payload.

Requiere la migración 019 y el backend actualizado, desplegados conjuntamente.
Registrar una dependencia remitente no concede acceso a esa oficina: los
permisos siguen dependiendo del destino. No se agregan dirección física ni
destinatarios externos.

## Escudo del encabezado

El encabezado React compartido de Radicacion, Consulta, Usuarios y Catalogos
usa `public/img/escudo-miranda.png`: copia recortada del escudo con sus ramas y
cintas sobre fondo blanco. El archivo original del escritorio no se modifica
ni se necesita en otros equipos. La ruta respeta la base de Vite y el recurso
se copia a `dist/img` durante la compilacion.

Para reemplazarlo, conserva ese nombre de archivo y la proporcion del escudo;
actualiza las dimensiones intrinsecas del `<img>` si cambian. Los estilos
mantienen una altura de 64 px en escritorio y 48 px en movil sin deformarlo.
Incluye texto alternativo institucional. No modifica el login.

### Escudo en los comprobantes de recepcion

Los PDF iniciales y regenerados desde Consulta incrustan el mismo escudo como
marca de agua centrada de 100 mm de ancho y opacidad 0.10 en todas las paginas.
Se dibuja antes del contenido y se restaura el estado grafico: los textos,
lineas y datos no se vuelven transparentes. Conserva la proporcion del recurso
y aparece tambien al descargar o imprimir, no solo en el visor del modal.

`crearPdfComprobante` y el generador legado `crearComprobantePDF` son asincronos:
sus consumidores deben esperar el resultado antes de `save` u `output`.
React resuelve la imagen con la base de Vite; el legado desde su script hacia
`public/img`. No usa servicios externos. Si falla la carga o generacion se
muestra el error, sin entregar silenciosamente un PDF sin escudo.
En Radicacion se conserva el registro exitoso y se ofrece reintentar solo el
comprobante, sin volver a enviar el formulario. En Consulta se bloquean acciones
duplicadas durante la generacion y se descartan resultados obsoletos.
No se modifican adjuntos recibidos ni documentos de respuesta institucional.

## Informativos y confirmacion Enterado

Requiere la migracion backend 020 y despliegue coordinado de ambos clientes y
servidor. En Catalogos, el administrador configura «Requiere respuesta» por
tipo de tramite. Al crear un tipo sin respuesta no se solicita un termino
legal ficticio. Para activar respuesta posteriormente, registra un termino
vigente antes de usarlo en radicacion. La regla solo afecta radicados futuros.

Radicacion admite un tipo sin respuesta aunque no tenga termino legal; muestra
la advertencia y usa la regla confirmada por la API en el PDF. Interna/Externa
no decide si un documento requiere respuesta. Los historicos no se reclasifican.

Consulta muestra la regla y ofrece Enterado solo cuando no se exige respuesta.
El selector se bloquea al guardar, revierte ante errores y muestra el rechazo.
Respondido ya no es una opcion manual: solo se alcanza guardando una respuesta
institucional. Enterado y Respondido se presentan como estados finales sin
reapertura. En globales cada dependencia confirma su propia asignacion.
Los documentos sin respuesta no tienen vencimiento ni alertas, no muestran
Responder y no admiten ampliaciones. El detalle muestra la fecha de enterado
y el comprobante indica «No requiere respuesta».

La clasificacion debe revisarse segun el contenido y las reglas juridicas
aplicables: no debe usarse Informativo para evitar responder una peticion real.

Las pruebas de consulta buscan los registros dentro de botones y filas concretas
para no recalcular la accesibilidad de todo el documento en cada espera. Los
casos de consulta y catalogos que no prueban tiempos usan `userEvent` sin
retardos artificiales; conservan los eventos y las comprobaciones de permisos.
El llenado comun de radicacion usa pegado real de usuario para no repetir una
renderizacion por cada caracter de datos de preparacion. Las pruebas que
verifican escritura incremental, como el codigo automatico de tramite, siguen
escribiendo caracter a caracter. No se aumentan los timeouts globales.

Para diagnosticar un caso concreto con argumentos directos al runner:

```powershell
node node_modules\vitest\vitest.mjs run --config vitest.config.js tests/react/ConsultaRadicados.test.jsx --testNamePattern="muestra el rechazo"
```

Los resultados pueden variar con la carga del equipo: repetir las suites ayuda
a detectar intermitencias, pero una ejecucion exitosa no garantiza su ausencia.
