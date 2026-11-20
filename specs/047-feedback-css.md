# Modularización segura del CSS: feedback y mensajes compartidos

**Estado:** completed

## Objetivo

Extraer los estilos globales de mensajes reutilizados por autenticación,
radicación, catálogos y consulta a un módulo CSS de feedback, sin cambiar
clases, textos, estados accesibles ni comportamiento.

## Alcance

- Mover `.auth-message` y sus variantes `error` y `success` a
  `components/feedback.css`.
- Mantener en `compatibility/legacy.css` los mensajes específicos de
  traslados, respuestas internas, entregas, alertas y catálogos.
- No modificar componentes React, APIs, payloads, roles ARIA, `aria-live`,
  badges, tablas ni modales.

## Compatibilidad

`style.css` ya importa `feedback.css` antes de `legacy.css`, por lo que los
selectores específicos existentes mantienen prioridad. Los valores visuales
se conservan exactamente.

## Criterios de aceptación

- Las tres reglas de `.auth-message` existen una sola vez en `feedback.css`.
- Login, radicación, catálogos y consulta mantienen sus mensajes y estados.
- Las pruebas React relacionadas, legacy, build y `git diff --check` pasan.
- La revisión visual humana fue aprobada.

## Revisión visual aprobada

Se validaron mensajes de error, éxito, carga y vacío en login, radicación,
catálogos y consulta. Se confirmaron colores, espaciado, textos, `role`,
`aria-live`, foco, teclado, escritorio, 320, 375 y 440 px, así como ausencia
de overflow horizontal y regresiones en mensajes específicos.
