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
5. Marcar la spec como `implemented` solo con revisión humana.

Cambios triviales de texto o estilos pueden omitir una spec formal, pero no
pueden romper un contrato ni contradecir una spec existente.

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

Las instrucciones específicas de GitHub Copilot en
`.github/copilot-instructions.md` deben mantenerse alineadas con este archivo.
