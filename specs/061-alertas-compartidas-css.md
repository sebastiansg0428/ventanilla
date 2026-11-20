# Alertas compartidas CSS

**Estado:** completed

## Objetivo

Extraer los estilos base compartidos por las tarjetas, controles y columnas de
alertas hacia `css/components/alerts.css`, manteniendo la apariencia, la
cascada y las clases públicas existentes.

## Alcance

- `.alerts-card` y su encabezado.
- `.alerts-controls` y sus selectores.
- `.alerts-columns` y sus títulos y listas.
- Importación del módulo desde `css/style.css` antes de la capa de
  compatibilidad legacy.

## Fuera de alcance

- JSX, componentes React, rutas, APIs, payloads y permisos.
- Estados, consultas y lógica de alertas.
- Selectores específicos de `#seccion-alertas`, errores, avisos y tarjetas
  contextuales de dependencia o Ventanilla.
- Reglas de páginas legacy no confirmadas como compartidas.

## Compatibilidad

Las clases públicas permanecen sin cambios. La extracción conserva los mismos
valores visuales y el orden efectivo de carga: los módulos se cargan antes de
`css/compatibility/legacy.css`.

## Criterios de aceptación

- Las reglas base aparecen una sola vez en `css/components/alerts.css`.
- Las reglas específicas de alertas permanecen en `legacy.css` o en
  `pages/consulta.css` cuando son contextuales.
- Consulta conserva apariencia, estados, foco, responsive y accesibilidad.
- Pasan las pruebas React relacionadas, la suite legacy, el build y
  `git diff --check`.
- La revisión manual en escritorio, 320, 375 y 440 px confirma ausencia de
  regresiones y overflow horizontal.

## Evidencia parcial de revisión manual

Se validó con el rol funcionario de Talento Humano la dependencia seleccionada
automáticamente, la consulta de alertas y el estado vacío para Oficina de
Planeación. La respuesta del endpoint fue válida con `total: 0`, y la interfaz
mostró `Sin alertas para esta dependencia` junto con el mensaje de que no hay
radicados próximos a vencer ni vencidos.

También se revisaron los estados de carga, vacío, éxito y error, junto con la
respuesta responsive en 320, 375, 440 px y escritorio. La comprobación de
`clientWidth`/`scrollWidth` confirmó ausencia de overflow horizontal con los
menús nativos cerrados.

Como ajuste final, el botón `Actualizar alertas` conserva un anillo de foco
visible y desplaza suavemente la sección al viewport cuando recibe el foco por
teclado. Se respeta `prefers-reduced-motion` usando desplazamiento automático
cuando el usuario lo solicita.

## Revisión manual aprobada

La revisión en navegador fue aprobada con los roles Funcionario, Ventanilla y
Administrador. Se validaron los estados de carga, vacío para Oficina de
Planeación, éxito y error, además de los controles, paginación, navegación por
teclado, foco visible y desplazamiento de `Actualizar alertas`.

La revisión cubrió 320, 375 y 440 px y escritorio. Con los menús nativos
cerrados, `clientWidth`/`scrollWidth` confirmó ausencia de desbordamiento
horizontal. No se observaron llamadas API adicionales provocadas únicamente
por el foco ni regresiones visuales.
