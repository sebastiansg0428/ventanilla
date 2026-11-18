# Guía de trabajo SDD para el frontend

Este repositorio contiene el frontend React/Vite de Ventanilla Única y sus
entradas HTML históricas. Los contratos compartidos de API, base de datos y
reglas de negocio se definen en `../backend/specs/` durante el desarrollo local
y deben consultarse antes de modificar un flujo integrado.

## Fuente de verdad

- `AGENTS.md` contiene reglas permanentes del frontend.
- Las specs compartidas viven en `backend/specs/`.
- `docs/specs-frontend.md` registra decisiones visuales y de interacción.
- Los tests son evidencia del comportamiento implementado.

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
se debe enlazar una spec antes de editar código. La spec debe definir estados
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

- Consultar primero la spec compartida en `../backend/specs/` para cualquier
  flujo que también afecte al backend.
- Usar exclusivamente `src/servicios/api.js` para las peticiones HTTP.
- Respetar `VITE_API_URL` y su respaldo local configurado en el servicio API.
- No inventar rutas, campos, estados ni payloads; conservar los contratos del
  backend.
- La autorización final pertenece al backend; el frontend solo refleja el
  resultado autorizado.

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

Las instrucciones específicas de GitHub Copilot en
`.github/copilot-instructions.md` deben mantenerse alineadas con este archivo.
