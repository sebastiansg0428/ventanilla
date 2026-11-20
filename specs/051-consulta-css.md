# Modularización CSS: bandejas de consulta

**Estado:** completed

## Objetivo

Extraer los estilos scoped de las bandejas de consulta a
`ventanilla/css/pages/consulta.css`, manteniendo la separación visual entre
dependencias, Ventanilla y Administrador.

## Alcance

- Mover las reglas bajo `.consulta-dependencia` y `.consulta-ventanilla`.
- Incluir pestañas, encabezados, indicadores, filtros, tabla, alertas,
  traslados, foco y responsive.
- Mantener en `legacy.css` los selectores genéricos compartidos por consulta,
  alertas, traslados y otros módulos.
- No modificar JSX, APIs, consultas, permisos, payloads ni lógica de negocio.

## Compatibilidad

`css/style.css` continúa importando `pages/consulta.css` antes de la capa de
compatibilidad. Los selectores scoped conservan sus nombres y especificidad;
los estilos genéricos permanecen en `legacy.css` para evitar cambios de
cascada en otros módulos.

## Verificación

- Ejecutar las pruebas React de consulta, respuestas internas y traslados.
- Ejecutar build, pruebas legacy y `git diff --check`.
- Revisar manualmente dependencia, Ventanilla y Administrador en escritorio,
  móvil, teclado, filtros, alertas, traslados y pestañas.

## Revisión visual aprobada

Se validaron manualmente las consultas de dependencia, Ventanilla y
Administrador en escritorio y móvil. Se revisaron encabezados contextuales,
pestañas, indicadores, búsqueda, filtros, alertas, tabla, semáforos,
paginación, estados de carga/error/vacío, acciones de radicados, navegación
por teclado, foco visible, textos largos y ausencia de desbordamiento
horizontal con menús nativos cerrados.
