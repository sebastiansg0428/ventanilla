# Guía de pruebas del frontend

Esta guía centraliza las verificaciones de React, legacy, CSS y Playwright del
frontend de Ventanilla Única.

## Requisitos

- Node.js 22.22.2 o una versión compatible con las herramientas actuales.
- Dependencias instaladas con `npm install`.
- Microsoft Edge instalado para las pruebas visuales. Playwright usa su motor
  Chromium mediante `channel: "msedge"`; no necesita descargar otro navegador.

Las pruebas visuales usan mocks HTTP estables. No inician el backend, no usan
MariaDB, no dependen de usuarios reales y no modifican datos persistentes.

## Comandos oficiales

Desde la raíz de `ventanilla`:

```powershell
npm run test:react
npm run test:legacy
npm run lint:css
npm run test:visual -- --list
npm run test:visual
npm run build
git diff --check
```

`npm run test:visual -- --list` solo descubre y enumera casos. La ejecución
real requiere que Playwright pueda iniciar Vite en `127.0.0.1:5173` y abrir
Edge. La configuración actual ejecuta 11 escenarios en cuatro viewports:
320, 375, 440 y 1280 px, para un total de 44 ejecuciones.

`npm run test:visual` ejecuta primero un preflight. Comprueba Edge, el
loopback y que el puerto 5173 esté libre; no mata procesos ni borra reportes.
Si detecta `EACCES`, `EPERM` o un puerto ocupado, termina antes de iniciar
Playwright y pide volver a ejecutar la terminal con acceso permitido a
`127.0.0.1`. `--list` omite ese preflight porque solo enumera casos.

## Diagnóstico de Playwright y loopback

Cuando la suite visual no inicia:

1. Ejecuta `npm run test:visual -- --list` para confirmar el descubrimiento.
2. Ejecuta `npm run test:visual`; el preflight comprobará Node, Edge, loopback
   y el puerto 5173.
3. Si aparece `EACCES`, comprueba los procesos `node`/`msedge`, permite el
   loopback en la terminal y vuelve a ejecutar el comando completo.
4. Ejecuta primero un proyecto y un caso aislado; después repite la suite.

Solo se clasifica como infraestructura un bloqueo con evidencia concreta,
como `EACCES`, `EPERM`, `fetch failed`, puerto ocupado, servicio local no
disponible o Edge no disponible sin aserciones funcionales fallidas. El
descubrimiento de pruebas no se reporta como aprobación. No se desactiva TLS
para corregir estos problemas.

## Alcance de la evidencia visual

Las pruebas comprueban los cuatro viewports, overflow horizontal, foco,
teclado, modales, drawers, tablas, formularios, estados de carga, error,
éxito y vacío. Las capturas y trazas se conservan únicamente cuando una
prueba falla.

La revisión humana sigue siendo obligatoria para marcar una spec como
`completed`: se verifican también textos largos, menús nativos cerrados,
`scrollWidth <= clientWidth`, foco visible y ausencia de regresiones.
