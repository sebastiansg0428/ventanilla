# Ventanilla Única — interfaz React + Vite

## Iniciar en el computador

1. Abre una terminal en esta carpeta y ejecuta `npm install`.
2. En otra terminal, inicia el servidor desde `../backend` con `npm start`.
3. Ejecuta `npm run dev` aquí y abre la dirección que muestre Vite, normalmente `http://localhost:5173`.

Para generar la versión de publicación ejecuta `npm run build`; para verla localmente usa `npm run preview`.

## Organización del código

- `index.html`, `consultar.html`, `login.html` y `registro_usuario.html` son las entradas de Vite y conservan las direcciones que ya usa el proyecto.
- `src/main.jsx` inicia React; `src/Aplicacion.jsx` selecciona la pantalla correspondiente a la dirección abierta.
- `src/paginas/` contiene las pantallas: radicación, consulta, inicio de sesión y registro de usuarios.
- `src/componentes/Compartidos.jsx` reúne componentes que varias pantallas reutilizan, como la protección de sesión y la navegación.
- `src/servicios/api.js` centraliza las solicitudes autenticadas al backend; `src/servicios/comprobante.js` genera el recibo.
- `public/vendor/jspdf.umd.min.js` contiene la copia local de jsPDF, por lo que no se depende de un CDN.
- `css/style.css` conserva los estilos existentes y los complementa para los componentes de React.

Los nombres de carpetas, pantallas, componentes y funciones propios de la interfaz están en español. Algunas claves se conservan intencionalmente: nombres de campos, rutas y respuestas como `usuario_recibe`, `/api/radicados` y `message` forman parte de la comunicación con el backend o el navegador. Cambiarlas unilateralmente puede romper el contrato entre frontend y servidor.

## Sesión y permisos

El inicio de sesión guarda el token en `sessionStorage`. Las pantallas protegidas confirman la sesión con `/api/auth/me`. La interfaz organiza la navegación según el rol, y el backend mantiene la autoridad para validar permisos.

Cuando el rol es `ventanilla`, el nombre del funcionario se toma de la sesión autenticada y el selector queda bloqueado. El backend registra `req.usuario.nombre` como responsable del radicado.

## Código anterior

Los scripts de la interfaz anterior se conservan en `legacy/js/`; las páginas actuales cargan los componentes de `src/`. Las pruebas en `tests/` mantienen cobertura de esos scripts anteriores y no representan todavía pruebas completas de la interfaz React.
