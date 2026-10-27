# Ventanilla Única — interfaz React + Vite

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

## Adjuntos de respuesta institucional

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

## Trazabilidad del expediente

El modal de detalle consulta `GET /api/radicados/:numero_radicado/historial` y
muestra una línea de tiempo paginada de eventos de negocio. La API aplica los
permisos existentes del radicado; el Timeline no muestra direcciones IP ni UUID
de sesión. Las filas históricas anteriores a la migración 021 aparecen como
eventos heredados y conservan su hora sin asumir que sea hora Bogotá. Los
eventos nuevos se presentan en `America/Bogota`.

Cada evento se presenta por separado en una tarjeta con acción, fecha y hora,
descripción, actor y dependencia. Los cambios de estado y ampliaciones muestran
sus valores anteriores y nuevos. La lista conserva el orden cronológico de los
eventos cargados y permite solicitar los anteriores; no agrupa ni elimina eventos.
El modal aprovecha su ancho disponible y mantiene el encabezado y cierre visibles
mientras se desplaza el contenido, también en pantallas estrechas.

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
