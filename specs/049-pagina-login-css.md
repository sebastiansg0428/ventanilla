# Modularización CSS: pantalla de inicio de sesión

**Estado:** completed

## Objetivo

Extraer los estilos exclusivos de la pantalla de inicio de sesión a
`ventanilla/css/pages/login.css`, manteniendo la apariencia y el comportamiento
actuales.

## Alcance

- Mover las reglas asociadas a `.page-login` para el contenedor principal,
  formulario, campos, botón y estado deshabilitado.
- Mantener en `legacy.css` los estilos compartidos por autenticación, registro,
  catálogos y usuarios.
- Conservar clases, HTML, componentes, rutas, APIs, contratos y lógica.

## Compatibilidad

`css/style.css` continúa siendo el punto de entrada global e importa
`pages/login.css` antes de `compatibility/legacy.css`. Las reglas extraídas
conservan sus selectores y valores, por lo que no deben producir cambios de
especificidad ni de apariencia.

## Verificación

- Ejecutar las pruebas React de autenticación y radicación.
- Ejecutar build, pruebas legacy y `git diff --check`.
- Revisar manualmente inicio de sesión, errores, carga, navegación con teclado,
  vista móvil y ausencia de regresiones en registro, catálogos y formularios
  compartidos.

La spec permanecerá en `implementing` hasta completar la revisión visual humana.
