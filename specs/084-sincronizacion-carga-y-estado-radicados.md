# Spec 084 — Sincronización de estados y carga de traslados

**Estado:** completed

## Objetivo

Comunicar de forma visible el envío de una solicitud de traslado y reflejar
inmediatamente en la tabla principal la entrega confirmada de una respuesta
interna, sin recargar la página.

## Alcance

- Mensaje accesible durante el envío de una solicitud de traslado.
- Bloqueo de controles y prevención de envíos duplicados mientras espera la
  confirmación.
- Sincronización local del estado del radicado después de registrar la primera
  apertura de una respuesta interna.
- Conservación de `Respondido` cuando la apertura falla.

## Fuera de alcance

No se modifican backend, rutas, métodos HTTP, payloads, permisos, estados de
negocio, contratos, datos almacenados ni llamadas necesarias para cargar las
vistas.

## Comportamiento esperado

- Durante el envío se muestra `Enviando solicitud de traslado a Ventanilla…`
  con `role="status"` y `aria-busy`, mientras el botón y los campos permanecen
  deshabilitados.
- La apertura interna actualiza la fila principal solo después de la
  confirmación exitosa del backend, usando el estado confirmado y `Entregado`
  como respaldo.
- La fila se identifica por `radicado_dependencia_id` cuando existe y por
  `numero_radicado` como respaldo.
- No se realiza una recarga adicional de radicados para reflejar el cambio.

## Verificación

- `npm run test:react -- tests/react/Traslados.test.jsx`.
- `npm run test:react -- tests/react/RespuestasInternas.test.jsx`.
- `npm run test:react -- tests/react/ConsultaRadicados.test.jsx`.
- `npm run build`.
- `npm run test:legacy`.
- `git diff --check`.
- Revisión manual con red 3G y en 320, 375, 440 px y escritorio.

## Revisión visual aprobada

Se revisó visualmente el flujo con resultado satisfactorio:

- El mensaje de carga del traslado fue visible y accesible.
- La tabla cambió a `Entregado` después de abrir una respuesta.
- No se observó overflow horizontal con los menús nativos cerrados.
- No se observaron regresiones visuales ni funcionales.
