---
id: 089
title: Estado de traslado aprobado y botón de cierre del comprobante
status: completed
scope: frontend
---

# Objetivo

Conservar abierta la bandeja de traslados después de que Ventanilla apruebe o
rechace una solicitud y mejorar la identificación visual del botón `Cerrar` en
el comprobante de recepción.

## Comportamiento esperado

- La aprobación confirmada mantiene abierta la bandeja de traslados.
- Se muestra el mensaje de confirmación con el radicado y el estado resultante.
- El contador y el listado se actualizan; una solicitud aprobada deja de aparecer
  entre las pendientes.
- El flujo de solicitud iniciado por un Funcionario continúa cerrando únicamente
  su formulario después de una confirmación exitosa.
- Aprobar un traslado no cierra detalle, respuesta ni comprobante que no formen
  parte de esa operación.
- El botón `Cerrar` del comprobante tiene apariencia de control secundario,
  hover, estado activo, foco visible y tamaño táctil adecuado.

## Compatibilidad y límites

- No se modifican rutas, métodos, payloads, permisos, estados backend ni datos.
- El cierre por botón, teclado y backdrop del comprobante permanece igual.
- El iframe y la generación del PDF permanecen sin cambios.
- La spec 031 continúa en `implementing` por la prueba física pendiente con la
  DigitalPOS DIG-2406T Pro.

## Verificación

- `npm run test:react -- tests/react/ConsultaRadicados.test.jsx`.
- `npm run test:react -- tests/react/Traslados.test.jsx`.
- `npm run test:visual`.
- `npm run test:legacy`.
- `npm run build`.
- `git diff --check`.
- Confirmar que no se generen llamadas API adicionales ni se cierren vistas no
  relacionadas después de aprobar.

## Revisión visual aprobada

La revisión humana confirmó en los flujos de Ventanilla y Funcionario que la
aprobación conserva abierta la bandeja de traslados, muestra la confirmación,
actualiza el contador y retira la solicitud del listado de pendientes. También
se verificó que el flujo de solicitud del Funcionario conserve su cierre normal
sin afectar vistas no relacionadas.

El botón `Cerrar` del comprobante se observó como un control secundario visible,
con foco y tamaño táctil adecuados, sin alterar el iframe ni el cierre por
botón, teclado o backdrop. La revisión incluyó 320, 375, 440 px y escritorio,
con menús nativos cerrados y sin overflow horizontal (`scrollWidth <=
clientWidth`). No se observaron regresiones.

La spec 031 permanece en `implementing` por la validación física pendiente con
la impresora DigitalPOS DIG-2406T Pro.
