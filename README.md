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

Cuando el rol es `ventanilla`, el nombre del funcionario se toma de la sesión autenticada y el selector queda bloqueado. El backend registra `req.usuario.nombre` como responsable del radicado.

La pantalla `registro_usuario.html` es la gestión de usuarios, disponible solo para administradores. Consume `GET/POST /api/usuarios`, `GET/PUT /api/usuarios/:id`, `PATCH /api/usuarios/:id/estado` y `GET /api/dependencias` mediante el servicio centralizado, que adjunta el token guardado en `sessionStorage`. Las cuentas se activan o inactivan (no se eliminan físicamente). Al editar la propia cuenta, el administrador cierra la sesión local porque el backend revoca sus sesiones. El backend debe tener aplicada la migración `006_usuarios_activos.sql` antes de usar estas funciones.

La pantalla `catalogos.html` permite a administradores crear, editar e inactivar/reactivar dependencias y tipos de trámite. Usa los endpoints de `/api/dependencias` y `/api/tipos-tramite`; al crear un tipo envía también los datos de su término legal inicial. La edición del tipo solo modifica código, nombre, categoría y orden; los cambios de plazo se registran como nuevas versiones con `POST /api/terminos-legales` y `tipo_tramite_id`, para conservar el historial.

## Adjuntos de respuesta institucional

El modal admite hasta 5 PDFs de hasta 10 MB (10.485.760 bytes) cada uno.
Una selección inválida muestra una alerta fuera del cuerpo desplazable y
conserva los adjuntos válidos anteriores, el contenido y la plantilla. La lista
de archivos seleccionados indica qué documentos se enviarán aunque el selector
nativo quede vacío tras el rechazo. Una selección válida nueva reemplaza la
anterior; los adjuntos siguen siendo opcionales.

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
Para preparar una base nueva consulta la secuencia 000-018 en el
[README del backend](../backend/README.md); su ejecucion real en una base aislada
sigue pendiente de validacion y no debe hacerse sobre la base de uso actual.

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
