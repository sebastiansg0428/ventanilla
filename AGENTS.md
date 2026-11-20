# Guía de trabajo SDD para el frontend

Este repositorio contiene el frontend React/Vite de Ventanilla Única y sus
entradas HTML históricas. Los contratos compartidos de API, base de datos y
reglas de negocio se definen en `../backend/specs/` durante el desarrollo local
y deben consultarse antes de modificar un flujo integrado.

## Fuente de verdad y ubicación de specs

- `AGENTS.md` contiene reglas permanentes del frontend.
- `specs/` contiene las specs cuyo alcance principal sea frontend: React, CSS,
  vistas, interacción, accesibilidad y estados de UI.
- `../backend/specs/` contiene specs backend y funcionalidades mixtas que
  definan contratos de API, permisos, estados de negocio, migraciones o
  validaciones del servidor.
- `docs/specs-frontend.md` registra decisiones visuales y de interacción.
- Los tests son evidencia del comportamiento implementado.

Las funcionalidades mixtas permanecen en `../backend/specs/` como fuente
compartida y deben indicar explícitamente el impacto en este frontend. Si
requieren criterios independientes, usa specs relacionadas por ID, una por
repositorio. No dupliques specs.

## Prioridad y resolución de instrucciones

- La solicitud explícita del usuario tiene prioridad sobre este archivo, salvo
  contradicción con las instrucciones del sistema o la seguridad.
- El `AGENTS.md` más cercano prevalece sobre uno más general.
- `backend/specs/` y el contrato efectivo del backend son la fuente de verdad
  para API, permisos, estados y reglas de negocio.
- Las instrucciones de Copilot complementan este documento y no pueden
  contradecirlo ni inventar contratos.

## Comandos oficiales

Ejecuta los comandos desde la raíz del frontend:

```powershell
npm run test:react -- tests/react/<archivo>
npm run build
npm run test:legacy
git diff --check
```

Usa la suite React enfocada para el cambio y ejecuta el build cuando se
modifiquen componentes, servicios o estilos compartidos.

## Flujo SDD

Para cambios de riesgo medio o alto —formularios, consumo de API,
autenticación, permisos, documentos, entregas, traslados y reglas de negocio—
se debe crear o enlazar la spec en el repositorio correcto antes de editar
código. La spec debe definir estados
de carga, validación, errores, accesibilidad y criterios de aceptación.

Después de implementar:

1. Confirmar que los nombres y tipos coinciden con el backend.
2. Actualizar o crear tests para los criterios de aceptación.
3. Ejecutar las pruebas pertinentes y el build.
4. Revisar manualmente accesibilidad, responsive y estados de error.
5. Marcar la spec como `completed` solo con revisión humana.

Cambios triviales de texto o estilos pueden omitir una spec formal, pero no
pueden romper un contrato ni contradecir una spec existente.

## Reglas de integración

- Consultar primero `specs/` para cambios frontend-only y
  `../backend/specs/` para contratos backend o flujos mixtos.
- Para una funcionalidad mixta, la spec backend compartida es la autoridad del
  contrato y la spec frontend relacionada documenta la experiencia de UI.
- Usar exclusivamente `src/servicios/api.js` para las peticiones HTTP.
- Respetar `VITE_API_URL` y su respaldo local configurado en el servicio API.
- No inventar rutas, campos, estados ni payloads; conservar los contratos del
  backend.
- La autorización final pertenece al backend; el frontend solo refleja el
  resultado autorizado.
- Mantener las URL, nombres de campos, clases públicas y estructura HTML
  existentes salvo que una spec aprobada autorice cambiarlos.

## Criterios de interfaz y límites

- Probar estados de carga, éxito, error, reintento y vacío cuando existan.
- Conservar foco visible, navegación por teclado, etiquetas accesibles y
  comportamiento responsive.
- Revisar manualmente en navegador cualquier cambio visual o de interacción.
- No modificar `legacy/` salvo solicitud explícita.
- No editar `dist/` ni otros archivos generados.
- No implementar autorización en el cliente.
- Liberar `ObjectURL` y evitar llamadas duplicadas al cargar documentos o
  actualizar estados.

## Validación responsive

Para cambios visuales o de interacción, revisar la vista con anchos de al
menos 320 px, 375 px y 440 px. Con los menús nativos cerrados, comprobar en la
consola del navegador que no exista desplazamiento horizontal real:

```js
const anchoVisible = document.documentElement.clientWidth;
const anchoContenido = document.documentElement.scrollWidth;

anchoContenido <= anchoVisible
```

`true` significa que el contenido cabe en el ancho visible. `false` indica
que algún elemento supera el viewport y debe investigarse. Un menú nativo de
`select` abierto puede sobresalir visualmente por decisión del navegador o del
sistema operativo; no debe clasificarse automáticamente como overflow de la
página. La revisión también debe confirmar botones y campos sin recortes,
tablas y tarjetas sin desbordamiento, navegación por teclado, foco visible y
lectura correcta de textos largos. Si no fue posible validar manualmente en
un navegador, se debe dejar registrada esa limitación.

## Resolución de ambigüedades y fallos

- La solicitud explícita del usuario tiene prioridad sobre este archivo.
- El `AGENTS.md` más cercano al archivo modificado tiene prioridad sobre uno
  más general.
- Si backend y frontend parecen contradecirse, prevalecen el contrato del
  backend y la spec compartida.
- Corregir los fallos funcionales; documentar por separado los fallos de
  infraestructura como `EACCES`, `fetch failed`, backend no disponible o
  servicios externos inaccesibles.
- No marcar una tarea como terminada mientras la causa de un fallo permanezca
  sin clasificar.

## Reglas técnicas permanentes

- Usa el servicio API centralizado y no inventes rutas o campos.
- La autorización final pertenece al backend; el frontend no debe confiar en
  valores del cliente para conceder acceso.
- Valida campos antes de enviar, pero conserva la validación del backend como
  autoridad.
- Muestra carga, deshabilita acciones duplicadas y comunica errores HTTP o de
  red de forma clara.
- No expongas datos personales innecesarios ni tokens en la interfaz o logs.
- No insertes datos externos como HTML sin una justificación y sanitización.
- Libera `ObjectURL` y otros recursos temporales cuando ya no se necesiten.
- Conserva las entradas HTML, URL, nombres de campos y comportamiento público
  existentes salvo que una spec aprobada autorice cambiarlos.
- Mantén componentes pequeños y evita reescribir archivos completos para
  cambios localizados.

## Criterios de terminado

- Las pruebas React relacionadas pasan.
- El build de Vite termina correctamente.
- `npm run test:legacy` se ejecuta cuando el cambio afecta las entradas HTML
  históricas o el código legacy relacionado.
- La revisión manual confirma accesibilidad, responsive y estados de error
  cuando corresponda.
- Se confirma que no cambiaron rutas, payloads ni contratos del backend.
- Las specs usan únicamente `proposed`, `implementing` o `completed`;
  `completed` requiere implementación y revisión humana. No usar `implemented`.

Las instrucciones específicas de GitHub Copilot en
`.github/copilot-instructions.md` deben mantenerse alineadas con este archivo.
