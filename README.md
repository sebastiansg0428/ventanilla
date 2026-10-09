# Ventanilla: frontend

Sirve esta carpeta con un servidor HTTP (por ejemplo, Live Server) y abre
[login.html](login.html). El backend RBAC debe estar activo en
`http://localhost:3000`; esa direccion se configura en [js/auth.js](js/auth.js).
Las cuentas se crean en el backend, no en este frontend.
Si `/api/auth/login` o `/api/auth/me` devuelve 404, inicia o reinicia la version
actualizada del backend que incluye las rutas RBAC.

## Sesion y roles

El login guarda token y usuario en `sessionStorage` solo despues de una respuesta
exitosa. Las paginas protegidas confirman el usuario con `/api/auth/me` antes
de mostrar su contenido o consultar catalogos y radicados.

Todas las solicitudes al backend pasan por `apiFetch`, que agrega el Bearer
token, conserva el cuerpo `FormData` y muestra los errores del servidor.
Un 401 borra la sesion y redirige al login. El cierre de sesion llama primero
a `/api/auth/logout`.

- `administrador`: ve las acciones marcadas con `data-rol="administrador"`.
- `ventanilla`: puede radicar; los selectores de estado son de solo lectura.
- `funcionario`: no entra al formulario de recepcion; las alertas usan su
  dependencia confirmada y el selector queda bloqueado.

Estas condiciones solo adaptan la interfaz: el backend sigue siendo responsable
de autorizar cada solicitud. No se incluyen claves administrativas en el cliente.

Las dependencias del formulario y de las alertas se cargan desde
`/api/dependencias` con IDs. El registro envia `dependencia_destino_id` y las
alertas usan `dependencia_id`. Los PDFs se consultan con HEAD y GET autenticados;
el visor recibe un Blob y revoca su object URL al cerrarse.
Los comprobantes locales, filtros y semaforo mantienen su comportamiento.

## Validacion

Las pruebas usan `node:test`, sin dependencias adicionales:

```powershell
node --test tests\auth.test.cjs tests\main.test.cjs tests\consultar.test.cjs
```
