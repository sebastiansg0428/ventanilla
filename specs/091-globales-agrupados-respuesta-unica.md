---
id: FEAT-GLOBALES-AGRUPADOS
title: Globales agrupados y respuesta única
status: implementing
risk: high
related:
  - ../backend/specs/032-entrega-final-externos.md
  - ../backend/specs/043-tramites-informativos-enterado.md
---

# Comportamiento

- Administrador y Ventanilla ven cada global como una fila principal.
- La expansión muestra las asignaciones de las 24 dependencias y su estado.
- Un global interno informativo muestra el progreso `Enteradas / 24`.
- Un global externo nuevo muestra `Pendiente → Respondido → Entregado`, la
  dependencia responsable y una respuesta única.
- En la bandeja de una dependencia no responsable, un global externo nuevo
  muestra únicamente `Recibido` antes de abrir el documento original. Tras una
  apertura exitosa pasa automáticamente a `Enterado`; si el PDF falla, se
  conserva `Recibido`.
- Ventanilla y Administrador pueden corregir el responsable antes de que
  exista respuesta.
- La respuesta completa se ofrece únicamente a Ventanilla, Administrador y la
  dependencia responsable. Las demás dependencias solo ven que fue recibida.
- Las dependencias no responsables no ven `Responder`, `En trámite` ni
  `Pendiente`; solo la dependencia responsable puede registrar la respuesta.
- Una apertura exitosa del documento original muestra `Documento original
  abierto` en la trazabilidad con el actor y la dependencia que lo abrió. La
  primera apertura por asignación es la única que se registra; Planeación no
  cambia a `Enterado` por esta actuación.
- En el detalle de un global externo, Administrador y Ventanilla ven un
  resumen numérico de `Respondidas`, `Enteradas` y `Recibidas`. Los contadores
  `En trámite` y `Pendientes` solo se muestran cuando son mayores que cero.
  Este resumen no reemplaza la lista de las 24 asignaciones ni cambia el flujo
  general `Pendiente → Respondido → Entregado`.
- Los radicados individuales conservan su presentación y acciones actuales.

# Accesibilidad y responsive

La expansión usa elementos nativos de teclado, conserva foco visible y evita
repetir 24 tarjetas. La tabla y el detalle deben funcionar en 320, 375, 440 px
y escritorio sin desbordamiento horizontal no intencional.

# Verificación

- React: `npm run test:react -- tests/react/ConsultaRadicados.test.jsx tests/react/Radicacion.test.jsx`.
- Build: `npm run build`.
- CSS: `npm run lint:css`.
- Visual: `npm run test:visual`.

La spec permanece en `implementing` hasta completar la ejecución de todas las
pruebas y la revisión humana de los cuatro tamaños móviles y escritorio.
