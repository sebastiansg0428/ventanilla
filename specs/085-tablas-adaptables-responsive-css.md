# Spec 085 — Tablas adaptables responsive CSS

**Estado:** completed

## Objetivo

Extraer las reglas responsive compartidas de las tablas adaptables desde
`legacy.css`, conservando la presentación móvil, accesibilidad y cascada
existentes para consulta, usuarios y catálogos.

## Alcance

- Adaptación móvil de `.table-card` y `.table-scroll`.
- Transformación responsive de `.tabla-adaptable` en tarjetas.
- Encabezados visualmente ocultos sin perder accesibilidad.
- Etiquetas `.tarjeta-etiqueta`, valores `.tarjeta-valor` y acciones.
- Reglas específicas para `#tabla-radicados`, `#tabla-usuarios`,
  `#tabla-catalogos` y `#tabla-terminos-legales`.

## Fuera de alcance

No se modifican JSX, JavaScript, APIs, permisos, datos, clases, IDs ni
`dist/`. Se conservan en `legacy.css` los grids responsive de páginas, reglas
de escritorio específicas y selectores compartidos cuya exclusividad no esté
confirmada.

## Compatibilidad

- Las reglas se trasladan sin cambiar sus valores ni selectores.
- `adaptive-tables.css` se importa inmediatamente antes de `legacy.css`.
- Consulta, usuarios y catálogos mantienen su estructura de tabla y sus
  acciones de teclado.

## Verificación

- `npm run test:react -- tests/react/ConsultaRadicados.test.jsx`.
- `npm run test:react -- tests/react/GestionCatalogos.test.jsx`.
- `npm run test:react -- tests/react/PaginasAutenticacion.test.jsx`.
- `npm run test:react -- tests/react/Compartidos.test.jsx`.
- `npm run test:legacy`.
- `npm run build`.
- `git diff --check`.
- Confirmar ausencia de duplicación innecesaria de las reglas trasladadas.

## Revisión visual aprobada

La revisión visual confirmó:

- tablas de consulta, usuarios y catálogos con encabezados accesibles;
- botones y `select` claros y bien alineados;
- desplazamiento horizontal controlado donde corresponde, sin desbordar el
  documento;
- tarjetas móviles legibles, ordenadas y sin cortes ni solapamientos;
- navegación con `Tab`/`Shift+Tab` y foco visible en botones, `select` y
  controles;
- `scrollWidth <= clientWidth` igual a `true` en 320, 375, 440 px y escritorio,
  con menús nativos cerrados.

Resultado: validación aprobada sin regresiones visuales.
