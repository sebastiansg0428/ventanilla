# Modularización segura del CSS: tablas compartidas

**Estado:** completed

## Objetivo

Extraer la base común de las tablas adaptables a un módulo CSS dedicado,
manteniendo las variantes específicas de consulta, usuarios y catálogos en la
capa de compatibilidad.

## Alcance

- Mover `.table-card`, `.table-scroll`, su foco visible,
  `.tabla-adaptable .tarjeta-etiqueta` y `.tarjeta-valor` a
  `components/tables.css`.
- Mantener en `compatibility/legacy.css` los estilos específicos de cada
  pantalla, encabezados, acciones, estados y media queries responsive.
- No modificar componentes React, HTML, clases públicas, APIs, payloads,
  datos ni lógica de negocio.

## Compatibilidad

`style.css` importa `tables.css` antes de `legacy.css`, de modo que las reglas
específicas existentes conservan prioridad. Los valores visuales y el foco del
contenedor se mantienen sin cambios.

## Criterios de aceptación

- Las cinco reglas base aparecen una sola vez en `tables.css`.
- Consulta, usuarios, dependencias, tipos de trámite e historial legal
  conservan su apariencia, responsive y accesibilidad.
- Las pruebas React relacionadas, legacy, build y `git diff --check` pasan.
- La revisión visual humana fue aprobada.

## Revisión visual aprobada

Se validaron las tablas de radicados, usuarios, dependencias, tipos de trámite
e historial legal. Se revisaron desplazamiento y foco del contenedor, tarjetas
adaptables, encabezados, acciones, textos largos, teclado, escritorio, 320,
375 y 440 px, `clientWidth`/`scrollWidth` y ausencia de desbordamiento
horizontal de la página.
