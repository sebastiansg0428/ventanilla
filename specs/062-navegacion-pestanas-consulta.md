# Navegación por teclado en pestañas de consulta

**Estado:** completed

## Objetivo

Permitir que las tres pestañas de consulta de un funcionario sean alcanzables
secuencialmente con `Tab`, sin saltar directamente al listado de documentos.

## Alcance

- `Radicados`.
- `Respuestas internas`.
- `Traslados`.
- Conservación de `role="tab"`, `aria-selected`, `aria-controls` e IDs.
- Conservación de navegación con `ArrowLeft`, `ArrowRight`, `Home` y `End`.

## Fuera de alcance

- Consultas HTTP, APIs, payloads, permisos y roles.
- Contenido o estados de las bandejas.
- Organización de las vistas de Administrador y Ventanilla.
- Cambios de estilos distintos al foco visible ya existente.

## Criterios de aceptación

- `Tab` recorre `Radicados`, `Respuestas internas` y `Traslados`.
- Activar una pestaña conserva el panel y el estado seleccionado correctos.
- Las flechas, `Home` y `End` continúan funcionando.
- Mover el foco no genera llamadas API adicionales.
- Administrador y Ventanilla no presentan regresiones.
- Pasan las pruebas React relacionadas, el build, la suite legacy y
  `git diff --check`.
- La revisión manual en 320, 375, 440 px y escritorio confirma foco visible,
  teclado completo y ausencia de overflow horizontal.

## Revisión manual aprobada

La revisión humana fue aprobada con los roles de Talento Humano, Administrador
y Ventanilla en 320, 375, 440 px y escritorio. Se confirmó la secuencia de
foco con `Tab` en las tres pestañas, la activación por teclado, la navegación
con flechas, `Home` y `End`, el foco visible, los paneles activos y los valores
correctos de `aria-selected`. También se comprobó que Administrador y
Ventanilla no presentaran regresiones, que no existiera desplazamiento
horizontal mediante `clientWidth`/`scrollWidth` con menús nativos cerrados y
que mover el foco no generara llamadas API adicionales.
