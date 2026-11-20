# Editores laterales unificados

**Estado:** implementing

## Objetivo

Unificar la presentación de la edición de dependencias y tipos de trámite con
el panel lateral que ya utiliza la gestión de usuarios. La mejora busca que la
edición de registros existentes tenga una jerarquía, comportamiento responsive
y experiencia de teclado consistentes.

## Alcance

- Al pulsar `Editar` en dependencias o tipos de trámite se abre un `<dialog>`
  lateral reutilizable.
- El panel conserva la carga del registro, validaciones, mensajes de error y
  formularios existentes.
- La creación de dependencias y tipos de trámite permanece en el formulario de
  la pantalla principal.
- El editor de términos legales permanece en su panel y flujo actuales.
- Usuarios conserva su drawer existente usando los estilos compartidos.

## Accesibilidad y comportamiento

- El panel mantiene `role="dialog"` y `aria-labelledby`.
- El encabezado recibe el foco al abrir sin desplazar el documento.
- `Escape` y `Cancelar edición` cierran el panel cuando no hay un guardado en
  curso. El encabezado no incluye un botón de cierre duplicado.
- El foco regresa al botón `Editar` que originó la apertura.
- El desplazamiento del documento se bloquea mientras el panel está abierto y
  se restaura al cerrarlo.
- El teclado mantiene un ciclo de foco dentro del panel y el diseño conserva
  tamaños táctiles adecuados en pantallas pequeñas.

## Compatibilidad y contratos

No se agregan endpoints ni se modifican rutas, permisos, campos, payloads o
contratos existentes. La edición conserva:

- `PUT /api/dependencias/:id`;
- `PUT /api/tipos-tramite/:id`.

La lógica de carga, validación, guardado, estados y términos legales permanece
en el componente actual. La capa CSS reutiliza el patrón visual del drawer de
usuarios mediante modificadores específicos para usuarios y catálogos.

## Criterios de aceptación

- La edición de una dependencia abre un único drawer lateral con su título,
  campos, estados de carga y errores.
- La edición de un tipo de trámite usa el mismo patrón visual y conserva su
  payload de actualización.
- Los drawers de usuarios, dependencias y tipos de trámite no muestran un
  botón superior `Cerrar edición`; `Cancelar edición` es la acción visual
  principal para descartar la edición.
- El foco inicial, el cierre por teclado y la restauración del foco funcionan.
- No se duplican formularios ni diálogos.
- Creación y términos legales permanecen en sus ubicaciones y flujos actuales.
- Las pruebas React relacionadas, el build, la suite legacy y `git diff --check`
  pasan.
- La revisión visual humana en escritorio, móvil y zoom se realiza antes de
  cambiar esta spec a `completed`.

## Revisión manual pendiente

Revisar los drawers de usuarios, dependencias y tipos de trámite con carga,
error, guardado, cancelación mediante `Cancelar edición`, `Escape`, backdrop,
responsive, ausencia del botón superior de cierre y ausencia de cambios en la
creación y los términos legales.
