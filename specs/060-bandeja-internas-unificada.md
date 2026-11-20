---
id: FE-060
title: Bandeja interna unificada de radicados enviados
status: completed
risk: medium
repository: ventanilla
backend_specs:
  - ../backend/specs/038-bandeja-internas-enviadas.md
---

# Contexto

La bandeja de comunicaciones internas mostraba por separado respuestas
recibidas y radicados enviados. Para seguir un trámite iniciado por una
dependencia, la respuesta debe consultarse dentro del radicado enviado que la
originó.

# Objetivo

Ofrecer una sola vista accesible, `Radicados enviados`, donde cada tarjeta
muestre la trazabilidad y, cuando exista respuesta, permita abrir inline su
contenido y documentos.

# Fuera de alcance

No se modifican backend, base de datos, permisos, endpoints, payloads,
validaciones ni contratos. No se eliminan las rutas existentes de recepción,
respuestas, documentos o apertura automática.

# Comportamiento esperado

- La bandeja contiene una única pestaña o sección accesible: `Radicados enviados`.
- Se reutiliza `GET /api/radicados?pagina=1&limite=25&vista=generados&tipo_comunicacion=interna`.
- Un radicado `Respondido` o `Entregado` muestra `Ver respuesta de ...` y
  `Ver trazabilidad`.
- Un radicado sin respuesta muestra únicamente `Ver trazabilidad`.
- La respuesta se abre inline con estados de carga, éxito, error y reintento.
- Mientras se carga se deshabilita el botón para evitar llamadas duplicadas.
- El detalle conserva contenido, PDF, trazabilidad y estado de entrega.
- Al finalizar, el detalle se desplaza a una posición visible y su encabezado
  recibe el foco; al cerrar, el foco vuelve al botón que inició la apertura.
- Los indicadores y avisos del resumen de respuestas internas continúan
  disponibles para la consulta principal.

# Contrato backend relacionado

Se conservan los contratos documentados en
`../backend/specs/038-bandeja-internas-enviadas.md`:

- `GET /api/radicados?pagina=1&limite=25&vista=generados&tipo_comunicacion=interna`;
- `GET /api/radicados/:numero_radicado/recepcion-interna`;
- `GET /api/respuestas-internas/:id`;
- `GET /api/respuestas-internas/:id/documentos/:documento`;
- registro automático de apertura mediante la ruta existente.

# Accesibilidad y responsive

Se mantienen botones reales, `role=tab`, `aria-selected`, `aria-expanded`,
`aria-controls`, mensajes accesibles, foco visible y navegación por teclado.
La revisión visual debe cubrir 320, 375 y 440 px, además de escritorio, sin
desplazamiento horizontal real con menús nativos cerrados. Se comprobará:

```js
const anchoVisible = document.documentElement.clientWidth;
const anchoContenido = document.documentElement.scrollWidth;

anchoContenido <= anchoVisible
```

# Criterios de aceptación

## Respuesta disponible

**Dado que** existe un radicado interno enviado con estado `Respondido` o
`Entregado`.

**Cuando** se pulsa `Ver respuesta de ...`.

**Entonces** se muestran dentro de la tarjeta la carga, el contenido, los
adjuntos, la trazabilidad y el estado de entrega, sin llamadas duplicadas.

## Sin respuesta

**Dado que** el radicado enviado aún no tiene respuesta.

**Cuando** se muestra su tarjeta.

**Entonces** solo aparece `Ver trazabilidad` y no se consulta una respuesta
inexistente.

# Plan de pruebas

- Pruebas React: `tests/react/RespuestasInternas.test.jsx`,
  `tests/react/ConsultaRadicados.test.jsx` y `tests/react/Traslados.test.jsx`.
- Build: `npm run build`.
- Suite legacy: `npm run test:legacy`.
- Revisión visual manual aprobada con Talento Humano y respuestas de Planeación:
  se validaron radicados respondidos y sin respuesta, apertura inline, PDF,
  trazabilidad, estados de carga/error/reintento, foco, navegación por teclado,
  responsive en 320, 375 y 440 px además de escritorio, ausencia de
  desbordamiento horizontal y ausencia de llamadas duplicadas.

# Trazabilidad

- Frontend: `src/componentes/RespuestasInternas.jsx`.
- Backend relacionado: `../backend/specs/038-bandeja-internas-enviadas.md`.
- Tests: `tests/react/RespuestasInternas.test.jsx`.
- Documentación: esta spec.
