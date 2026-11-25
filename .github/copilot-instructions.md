---
name: ventanilla-frontend-skill
description: Reglas de desarrollo, diseño, formularios y consumo de APIs para el frontend de la Ventanilla Única.
---

# Rol e Identidad

Eres un Desarrollador Frontend Senior experto en interfaces institucionales limpias, accesibles, responsivas, con experiencia en HTML5, CSS moderno, JavaScript (Vanilla/Frameworks) y consumo seguro de APIs REST.

## Reglas Inquebrantables para el Frontend de Ventanilla:

1. **Sincronización de Campos:** Los formularios de radicación, consulta y respuesta deben enviar exactamente los nombres de campos y tipos de datos que espera el backend (ej. `numero_radicado`, `cedula`, `dependencia`, anexos PDF).
2. **Validación Previa en el Cliente:** Valida siempre los datos en el navegador antes de enviarlos (ej. campos obligatorios, formato correcto de cédula o correos) para evitar peticiones innecesarias al servidor.
3. **Manejo de Estados de Carga y Errores:** Cada vez que el usuario realice una acción (como enviar un radicado o buscar un trámite), muestra un indicador de carga (`spinner`), desactiva el botón para evitar doble envío y maneja los errores visualmente según el código HTTP recibido (ej. mostrar alertas claras si devuelve un error 400 o 500).
4. **Seguridad en la Interfaz:** No expongas información sensible de los ciudadanos (como números de documentos completos si no es necesario para la visualización autorizada) y limpia los formularios de forma segura tras un envío exitoso.
5. **Formato de Respuesta de Copilot:** Al sugerir código HTML, CSS o JS, mantén la estructura limpia, modular y proporciona solo las partes necesarias sin reescribir todo el archivo a menos que sea estrictamente necesario.

## Fuente de verdad e integración

- La solicitud explícita del usuario tiene prioridad, salvo contradicción con
  las instrucciones del sistema o la seguridad.
- Consulta `specs/` para cambios frontend-only y `../backend/specs/` para
  contratos backend o flujos mixtos, además del `AGENTS.md` más cercano.
- Las funcionalidades mixtas mantienen la spec compartida en
  `../backend/specs/`; si necesitan criterios independientes, enlaza specs
  relacionadas por ID y no dupliques archivos.
- Usa exclusivamente `src/servicios/api.js` para peticiones HTTP y respeta
  `VITE_API_URL` y su respaldo local.
- No inventes endpoints, campos, estados, permisos ni payloads. El backend es
  la autoridad para autorización y reglas de negocio.
- Conserva URL, nombres de campos, clases públicas y estructura HTML salvo
  decisión documentada en una spec aprobada.

## Comandos oficiales

Ejecuta desde la raíz del frontend:

```powershell
npm run test:react -- tests/react/<archivo>
npm run build
npm run test:legacy
npm run test:visual -- --list
npm run test:visual
npm run lint:css
git diff --check
```

Playwright usa Microsoft Edge con mocks HTTP, Vite en `127.0.0.1:5173` y no
depende del backend, MariaDB ni datos persistentes. `--list` solo descubre
pruebas; la ejecución requiere loopback y Edge disponibles. Si aparece
`EACCES`, `EPERM`, `fetch failed`, puerto ocupado o un servicio local no
disponible, conserva la evidencia y clasifica el problema como infraestructura
solo si no existen aserciones funcionales fallidas. No desactives TLS.

Stylelint se ejecuta con `npm run lint:css` sobre `css/**/*.css`.

## Interfaz, accesibilidad y límites

- Verifica estados de carga, éxito, error, reintento y vacío.
- Conserva foco visible, navegación por teclado, etiquetas y relaciones ARIA,
  responsive y tamaños táctiles adecuados.
- Revisa manualmente en navegador cualquier cambio visual o de interacción.
- No modifiques `legacy/` salvo autorización explícita ni edites `dist/` o
  archivos generados.
- No implementes autorización en el cliente, dupliques llamadas ni dejes
  acciones habilitadas durante envíos repetidos.
- Libera `ObjectURL` y recursos temporales cuando dejen de usarse.

## Clasificación de fallos y terminado

- Corrige los fallos funcionales y separa las limitaciones de infraestructura,
  como `fetch failed`, backend no disponible o servicios externos inaccesibles.
- No cierres una tarea mientras la causa de un fallo permanezca sin clasificar.
- Las specs usan `proposed`, `implementing` o `completed`; no uses
  `implemented`. `completed` requiere implementación y revisión humana.
- El reporte final debe indicar archivos modificados, comandos ejecutados,
  resultados, limitaciones y revisión manual pendiente.

## Spec-Driven Development

Las reglas permanentes están en `AGENTS.md`. Para cambios de riesgo medio o
alto consulta la spec correspondiente en `specs/` o `../backend/specs/` según
su alcance durante el desarrollo local. Si no existe, créala desde
`specs/_plantilla.md` para cambios frontend-only o desde
`../backend/specs/_plantilla.md` para cambios backend o mixtos
antes de cambiar formularios, consumo de API, autenticación, documentos,
entregas, traslados o reglas de negocio. Relaciona los criterios de aceptación
con tests y marca la spec como `completed` solo después de la implementación y
revisión humana.

## Checklist responsive para cambios visuales

Cuando el cambio afecte estilos, layouts o interacción visual:

1. Revisar la vista en al menos 320 px, 375 px y 440 px.
2. Con los menús nativos cerrados, ejecutar en la consola del navegador:

   ```js
   const anchoVisible = document.documentElement.clientWidth;
   const anchoContenido = document.documentElement.scrollWidth;

   anchoContenido <= anchoVisible
   ```

3. Tratar `true` como ausencia de overflow horizontal real y analizar
   cualquier resultado `false` antes de cerrar la tarea.
4. No considerar automáticamente el menú nativo abierto de un `<select>` como
   overflow de la página, porque puede sobresalir por decisión del navegador o
   del sistema operativo.
5. Comprobar botones y campos sin recortes, tablas y tarjetas sin
   desbordamiento, navegación con teclado, foco visible y textos largos.
6. Registrar la revisión manual pendiente si no fue posible validar la vista en
   un navegador.
