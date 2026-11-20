# Especificaciones del frontend

Esta carpeta contiene las specs cuyo alcance principal es el frontend React/Vite:
interfaz, componentes, CSS, vistas, interacción, accesibilidad y estados de UI.

## Ubicación

- Crea aquí las specs frontend-only.
- Consulta `../backend/specs/` para contratos de API, permisos, estados de
  negocio, migraciones y validaciones del servidor.
- Las funcionalidades mixtas permanecen en `backend/specs/` como fuente
  compartida y deben indicar explícitamente el impacto en este frontend.
- No dupliques una spec entre repositorios. Si una funcionalidad mixta necesita
  criterios separados, usa IDs relacionados y enlaza ambas specs.

## Ciclo de vida

- `proposed`: propuesta aprobada pendiente de implementación.
- `implementing`: trabajo en curso.
- `completed`: implementación terminada y revisión humana realizada.

No uses `implemented`.

## Flujo

1. Define objetivo, alcance, fuera de alcance y contrato backend relacionado.
2. Documenta estados de carga, éxito, error, reintento y vacío.
3. Define accesibilidad, responsive y criterios de aceptación verificables.
4. Relaciona los criterios con pruebas React y revisión visual.
5. Marca la spec como `completed` solo después de la revisión humana.
