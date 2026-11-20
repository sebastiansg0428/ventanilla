---
id: FE-059
title: Apertura visible de respuestas internas enviadas
status: completed
risk: medium
repository: ventanilla
backend_specs:
  - ../backend/specs/038-bandeja-internas-enviadas.md
---

# Contexto

En la sub-bandeja `Radicados enviados`, una dependencia de origen puede
consultar la respuesta registrada por la dependencia destinataria. El detalle
se abre inline dentro de la tarjeta del radicado enviado.

# Objetivo

Hacer explícita y accesible la apertura de una respuesta enviada, mostrando
desde el primer clic el estado de carga, el resultado o el error dentro de la
tarjeta que inició la acción.

# Fuera de alcance

No se modificarán backend, base de datos, permisos, endpoints, payloads ni
contratos. Tampoco se convertirá el detalle inline en un modal ni se cambiará
la bandeja de respuestas recibidas.

# Comportamiento esperado

- El botón conserva su texto y queda asociado al detalle mediante
  `aria-expanded` y `aria-controls`.
- Al pulsarlo, la tarjeta muestra `Cargando respuesta interna y PDF…` y se
  desplaza a la zona de detalle.
- Mientras carga, el botón queda deshabilitado para evitar llamadas duplicadas.
- Cuando la carga termina, se muestran contenido, adjuntos, trazabilidad y
  estado de entrega; el encabezado recibe el foco.
- Los errores de recepción, respuesta o documentos se muestran dentro de la
  tarjeta y permiten reintentar.
- Cerrar el detalle restaura el foco en el botón que inició la apertura.

# Contrato backend relacionado

Se reutilizan las rutas documentadas en
`../backend/specs/038-bandeja-internas-enviadas.md`:

- `GET /api/radicados/:numero_radicado/recepcion-interna`;
- `GET /api/respuestas-internas/:id`;
- `GET /api/respuestas-internas/:id/documentos/:documento`.

La apertura automática registrada por el backend conserva sus permisos y
reglas actuales.

# Accesibilidad y responsive

Se conservarán botones reales, foco visible, navegación por teclado, mensajes
de carga y error accesibles, y la adaptación a 320, 375 y 440 px. Se revisará
que no exista overflow horizontal real con `clientWidth` y `scrollWidth`.

# Criterios de aceptación

## Escenario 1: respuesta enviada disponible

**Dado que** existe un radicado enviado con estado `Respondido`.

**Cuando** se pulsa `Ver respuesta de Oficina de Planeación`.

**Entonces** el detalle se muestra dentro de la tarjeta, con su contenido,
adjuntos y estado de entrega.

## Escenario 2: error de carga

**Dado que** falla una consulta de recepción, respuesta o documento.

**Cuando** termina la solicitud.

**Entonces** se muestra un error accesible dentro de la tarjeta y se ofrece
reintentar sin ocultar silenciosamente el estado.

# Plan de pruebas

- Pruebas React: `tests/react/RespuestasInternas.test.jsx` y
  `tests/react/ConsultaRadicados.test.jsx`.
- Build: `npm run build`.
- Suite legacy: `npm run test:legacy`.
- Revisión visual manual aprobada en Talento Humano con respuestas de
  Planeación: apertura inline visible, estados de carga, éxito, error y
  reintento, contenido, adjuntos y estado de entrega.
- Se confirmaron el desplazamiento automático, el foco accesible, la
  prevención de llamadas duplicadas, la navegación por teclado y la revisión
  responsive.

# Trazabilidad

- Frontend: `src/componentes/RespuestasInternas.jsx`.
- Backend relacionado: `../backend/specs/038-bandeja-internas-enviadas.md`.
- Tests: `tests/react/RespuestasInternas.test.jsx`.
- Documentación: esta spec.
