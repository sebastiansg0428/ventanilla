# Spec 087 — Auth shell y sesión legacy CSS

**Estado:** completed

## Objetivo

Extraer de `css/compatibility/legacy.css` los estilos del contenedor legacy de
autenticación y del estado de sesión, manteniendo la presentación, el bloqueo
visual mientras se valida la sesión y la cascada existente.

## Alcance

- Estado pendiente de sesión y `#sesion-estado`.
- Control visual `[data-cerrar-sesion]`.
- `.page-auth`, `.auth-shell` y `.auth-shell--wide`.
- Adaptación responsive del contenedor de autenticación.

## Compatibilidad y límites

- `auth-shell-legacy.css` se importa inmediatamente antes de `legacy.css`.
- `[hidden]`, `main`, `footer`, formularios compartidos y reducción de movimiento
  global permanecen en `legacy.css`.
- `auth.css`, `login.css` y `registro-legacy.css` continúan siendo la fuente de
  verdad de sus estilos ya extraídos.
- No se modifican React, JSX, JavaScript, autenticación, APIs, permisos,
  almacenamiento de sesión, contratos ni `dist/`.

## Verificación

- `npm run test:react -- tests/react/PaginasAutenticacion.test.jsx`.
- `npm run test:react -- tests/react/Compartidos.test.jsx`.
- `npm run test:legacy`.
- `npm run build`.
- `git diff --check`.
- Confirmar ausencia de duplicación innecesaria y conservación del orden de
  importación.

## Revisión visual humana aprobada

El usuario confirmó la revisión de login, registro, estado de sesión no
disponible, navegación, cierre de sesión, foco, teclado y estados de
carga/error/éxito. La validación responsive en 320, 375, 440 px y escritorio
confirmó ausencia de recortes y overflow horizontal con menús nativos
cerrados, sin regresiones.
