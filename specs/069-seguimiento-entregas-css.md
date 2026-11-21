# Spec 069 — Seguimiento de entregas CSS

**Estado:** implementing

## Objetivo

Extraer los estilos exclusivos del seguimiento de entregas dentro del modal de
respuesta institucional, conservando la apariencia, accesibilidad y cascada
existentes.

## Alcance

- Panel, cabecera, estados, avisos y mensajes de seguimiento.
- Acciones, botones, historial, tarjetas y anulaciones.
- Formularios, preparación, selección y documentos.
- Reglas responsive específicas del seguimiento.

## Fuera de alcance

No se modifican JSX, APIs, endpoints, payloads, permisos, validaciones,
estados ni lógica de entregas. Los estilos generales del modal permanecen en
`legacy.css`.

## Criterios de aceptación

- La extracción conserva clases, valores, especificidad y orden efectivo de
  cascada.
- Se mantienen estados de carga, éxito, error y pendiente.
- Se mantienen historial, paginación, formularios, documentos y evidencias.
- El foco visible, teclado y tamaños táctiles permanecen funcionando.
- No aparece overflow horizontal en 320, 375, 440 px ni escritorio con
  menús nativos cerrados.
- Las pruebas React, build y suite legacy continúan pasando.

## Revisión visual pendiente

Validar con roles Administrador, Ventanilla y Funcionario el seguimiento de
entrega dentro de respuesta institucional, sus estados, formularios, historial,
documentos, botones, foco, teclado y responsive.
