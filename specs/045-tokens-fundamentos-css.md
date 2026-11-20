# Modularización segura del CSS de Ventanilla: tokens y fundamentos

**Estado:** completed

## Objetivo

Centralizar los valores base de color, tipografía, foco, radios y sombra para
que las siguientes extracciones CSS puedan reutilizarlos sin renombrar clases
ni alterar componentes existentes.

## Alcance

- Mantener `css/style.css` como fachada global.
- Mantener `compatibility/legacy.css` para las reglas aún no extraídas.
- Usar tokens únicamente en las reglas globales que ya fueron separadas en
  `foundations/`.
- Conservar valores visuales equivalentes a la línea base.
- No migrar todavía páginas completas, botones existentes, Tailwind ni CSS
  Modules.

## Criterios de aceptación

- Los tokens institucionales se declaran en `foundations/tokens.css`.
- Reset, tipografía y foco consumen tokens sin cambiar sus valores efectivos.
- Las clases públicas, HTML, APIs y lógica de negocio permanecen intactos.
- Build, pruebas React relacionadas y pruebas legacy pasan.
- La revisión visual humana fue aprobada.

## Revisión visual aprobada

Se validaron colores institucionales, tipografía, foco, radios, sombras,
botones, campos, tarjetas y estados `hover`, `focus` y `disabled` en
escritorio, 320, 375 y 440 px. La navegación por teclado, el foco visible y
la comprobación `clientWidth`/`scrollWidth` no mostraron regresiones.

## Siguiente fase

Extraer un único grupo de componentes compartidos, comenzando por botones o
formularios, comparando referencias de clases y la cascada antes y después.
