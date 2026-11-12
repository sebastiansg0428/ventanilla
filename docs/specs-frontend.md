# Especificaciones frontend y SDD

Las especificaciones compartidas de API, MySQL y reglas de negocio se
encuentran en `../backend/specs/` durante el desarrollo local. Antes de cambiar
una funcionalidad integrada, identifica su spec por `id` y revisa sus criterios
de aceptación.

## Responsabilidad del frontend

El frontend implementa la presentación y la interacción, pero no reemplaza la
autoridad del backend. Cada flujo debe definir:

- campos y tipos enviados;
- validación previa y mensajes de usuario;
- estados inicial, carga, éxito, vacío, error y resultado incierto;
- prevención de doble envío;
- accesibilidad del diálogo o formulario;
- limpieza de archivos y URLs temporales;
- pruebas asociadas a los escenarios de aceptación.

## Specs integradas actuales

- [FEAT-029: fecha real de entrega](../../backend/specs/029-fecha-real-entrega.md)
- [FEAT-ENTREGA: registro de entrega](../../backend/specs/registro-entrega.md)
- [FEAT-CONSULTA: consulta de radicados](../../backend/specs/contrato-consulta-radicados.md)

## Cómo trabajar un cambio

1. Leer `AGENTS.md` y la spec enlazada.
2. Comparar el contrato con el servicio API y los componentes actuales.
3. Implementar únicamente el comportamiento aprobado.
4. Actualizar tests para cada criterio modificable.
5. Ejecutar pruebas React, legacy cuando aplique y build.
6. Registrar limitaciones o decisiones abiertas en la spec central.
