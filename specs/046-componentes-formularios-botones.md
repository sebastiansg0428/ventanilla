# Modularización segura del CSS: formularios y botones compartidos

**Estado:** completed

## Objetivo

Extraer estilos compartidos de formularios y botones principales a módulos
CSS dedicados, conservando las clases públicas, la apariencia y el orden de
cascada necesario para las pantallas actuales.

## Alcance

- Mover `.auth-form`, `.auth-form--grid`, `.auth-field`, sus estados y la
  regla general de textarea a `components/forms.css`.
- Mover `.auth-submit` y sus estados a `components/buttons.css`.
- Mantener en `compatibility/legacy.css` los overrides de radicación,
  catálogos, usuarios, traslados, entregas, modales y tablas.
- No cambiar JSX, APIs, payloads, permisos, lógica de negocio, Tailwind ni
  CSS Modules.

## Compatibilidad

Las clases existentes siguen siendo las mismas y `style.css` continúa siendo
la entrada global. Los módulos se importan antes de la capa legacy para que
los overrides específicos existentes conserven prioridad.

## Criterios de aceptación

- Las reglas seleccionadas aparecen una sola vez fuera de `legacy.css`.
- Login, registro, usuarios, catálogos, radicación, traslados, entregas y
  formularios modales mantienen sus estados visuales y accesibles.
- Build, pruebas React relacionadas, pruebas legacy y `git diff --check` pasan.
- No cambian rutas, contratos, payloads ni componentes React.
- La revisión visual humana fue aprobada.

## Revisión visual aprobada

Se validaron login, registro, usuarios, catálogos, radicación, traslados,
entregas y formularios modales. Se revisaron campos, ayudas, textarea,
botones, estados de carga, disabled, hover, focus, teclado, escritorio,
320, 375 y 440 px, además de `clientWidth`/`scrollWidth`, sin regresiones.
