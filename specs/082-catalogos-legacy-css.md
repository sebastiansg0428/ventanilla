# Spec 082 — Estilos legacy de catálogos

**Estado:** completed

## Objetivo

Extraer de `legacy.css` los estilos exclusivos de Gestión de catálogos,
conservando la apariencia, los formularios, los filtros, las tablas y los
drawers existentes.

## Alcance

- Paneles de creación y edición de catálogos.
- Encabezados, iconos, descripciones y acciones del editor.
- Búsqueda, filtro de inactivos y resumen del listado.
- Estados activos e inactivos.
- Tablas `#tabla-catalogos` y `#tabla-terminos-legales`.
- Estados vacíos, hover y responsive específico de catálogos.

## Fuera de alcance

No se modifican JSX, JavaScript, APIs, permisos, payloads, contratos, datos,
`dist/`, drawers compartidos ni estilos globales de usuarios, tablas, modales o
autenticación.

## Compatibilidad

- Se conservan selectores, valores, IDs, clases y estructura HTML existentes.
- El módulo se importa inmediatamente antes de `legacy.css`.
- `GestionCatalogos.jsx` conserva sus formularios, búsqueda, filtros, pestañas y
  navegación actuales.
- `catalogos-terminos.css` continúa siendo la fuente de estilos del panel de
  términos legales específico.

## Verificación

- `npm run test:react -- tests/react/GestionCatalogos.test.jsx`.
- `npm run test:react -- tests/react/ConsultaRadicados.test.jsx`.
- `npm run test:legacy`.
- `npm run build`.
- `git diff --check`.
- Confirmar ausencia de duplicación innecesaria de selectores trasladados.

## Revisión visual aprobada

- Administrador: Dependencias y Tipos de trámite validados.
- Búsqueda y filtros operativos, incluido el restablecimiento.
- Creación, edición, términos legales y drawers revisados sin bloqueos.
- Estados vacíos, carga y error visibles y contenidos dentro del layout.
- Navegación con `Tab`/`Shift+Tab` y foco visible verificados dentro y fuera
  del drawer.
- Responsive validado en 320, 375, 440 px y escritorio.
- Con menús nativos cerrados, `scrollWidth <= clientWidth` fue `true` en todos
  los tamaños revisados.
- Resultado: revisión visual aprobada, sin regresiones.
