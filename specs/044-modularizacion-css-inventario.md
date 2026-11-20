# Modularización segura del CSS de Ventanilla: inventario y estructura

**Estado:** completed

## Objetivo

Preparar una estructura CSS global modular para el frontend de Ventanilla sin
cambiar clases públicas, HTML existentes, comportamiento visual intencional,
contratos, APIs ni lógica de negocio.

## Alcance de esta fase

- Mantener `ventanilla/css/style.css` como punto de entrada para Vite y para
  las páginas HTML que lo enlazan directamente.
- Crear módulos organizados por fundamentos, layout, componentes, páginas y
  compatibilidad.
- Conservar todas las reglas existentes, en el mismo orden, dentro de
  `css/compatibility/legacy.css`.
- Incorporar únicamente tokens institucionales y un alias opt-in `.btn` para
  componentes nuevos; ninguna pantalla existente depende todavía de esos
  alias.
- No migrar Tailwind, CSS Modules ni renombrar clases en esta fase.

## Compatibilidad y riesgo

La capa `compatibility/legacy.css` es la copia exacta del CSS previo y se
importa al final de la fachada. Esto permite revertir la fase eliminando los
módulos nuevos y restaurando el punto de entrada anterior, sin reclasificar
selectores ni alterar la cascada de las pantallas actuales.

Los módulos restantes funcionan como puntos de extracción para fases
posteriores. Cada extracción deberá conservar el orden de cascada, comprobar
referencias de clases y validar escritorio, móvil y teclado antes de retirar
reglas de compatibilidad.

## Criterios de aceptación

- `style.css` importa los módulos en un orden explícito y estable.
- Las reglas históricas permanecen sin cambios en `legacy.css`.
- El build de Vite continúa generando todas las páginas.
- Las pruebas React y legacy se ejecutan o dejan documentada cualquier
  limitación de infraestructura.
- No se modifican APIs, componentes, permisos, datos ni lógica de negocio.
- La revisión visual humana de las vistas principales fue aprobada.

## Revisión visual aprobada

Se validaron login, registro, radicación, consulta, catálogos, usuarios,
respuestas internas, traslados y entregas con rol Administrador donde aplica.
Se revisaron escritorio, 320, 375 y 440 px, teclado, foco visible,
`clientWidth`/`scrollWidth` y ausencia de regresiones visuales.

## Próxima fase

Extraer globales y fundamentos hacia `foundations/`, empezando por reglas que
no tengan dependencia de página. Cada movimiento se comparará contra la capa
de compatibilidad y se validará antes de eliminar duplicados.
