---
id: FE-074
title: Estilos legacy de consulta y comprobantes
status: completed
risk: low
repository: ventanilla
backend_specs: []
---

# Contexto

`legacy.css` conserva estilos específicos de la consulta legacy y de sus
comprobantes junto con reglas genéricas de modal y otros módulos.

# Objetivo

Separar los estilos exclusivos del detalle legacy y de la vista previa del
comprobante para reducir el monolito sin cambiar la apariencia ni el
comportamiento público.

# Fuera de alcance

No se modificarán JSX, JavaScript, APIs, permisos, payloads, contratos,
validaciones, backend, estilos genéricos de modal ni archivos generados.

# Comportamiento esperado

El detalle de consulta y el comprobante conservarán su apertura, cierre,
contenido, documentos, vista previa, estados de error y reintento actuales.

# Accesibilidad y responsive

Se conservarán el foco visible, la navegación por teclado, los textos largos,
el iframe y la adaptación en 320, 375, 440 px y escritorio. Con menús nativos
cerrados se comprobará `scrollWidth <= clientWidth`.

# Criterios de aceptación

## Escenario 1: detalle legacy

**Dado que** existe un radicado consultable.

**Cuando** se abre y se cierra su detalle.

**Entonces** resumen, soporte, documento, foco y responsive conservan el
comportamiento anterior.

## Escenario 2: comprobante

**Dado que** existe un radicado con datos de recepción.

**Cuando** se genera y se visualiza el comprobante.

**Entonces** la vista previa, el cierre y los estados de error conservan su
apariencia y comportamiento.

# Plan de pruebas

- Pruebas React: `ConsultaRadicados.test.jsx`, `Comprobante.test.jsx`.
- Build: `npm run build`.
- Suite legacy: `npm run test:legacy`.
- Revisión visual manual: Administrador, Ventanilla y Funcionario en 320,
  375, 440 px y escritorio.

# Trazabilidad

- Frontend: `css/pages/consulta-legacy.css`.
- Backend relacionado: ninguno.
- Tests: `tests/react/ConsultaRadicados.test.jsx`,
  `tests/react/Comprobante.test.jsx`, suite legacy.
- Documentación: esta spec.

# Revisión visual aprobada

Se revisaron las vistas de detalle y comprobantes con los roles
Administrador, Ventanilla y Funcionario.

- Apertura y cierre del detalle: correctos.
- Resumen, estados, documentos, soporte e iframe: legibles y sin recortes.
- Generación, vista previa y cierre del comprobante: correctos.
- Foco visible y navegación por teclado: aprobados.
- Responsive en 320, 375, 440 px y escritorio: aprobado.
- `scrollWidth <= clientWidth` con menús nativos cerrados: confirmado.
- Resultado: sin regresiones visuales.
