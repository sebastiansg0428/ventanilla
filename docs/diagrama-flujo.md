# Diagrama de flujo actual

El diagrama representa las entradas activas del frontend React, los controles de sesión y rol, las funciones principales de cada pantalla y el servicio común de API. El backend se ejecuta por separado en `http://localhost:3000`; sus procesos internos no están representados aquí.

```mermaid
flowchart TD
    A["Usuario abre una URL"] --> B["HTML de entrada carga src/main.jsx"]
    B --> C{"Aplicacion.jsx evalúa el nombre de la página"}

    C -->|login.html| L["Inicio de sesión"]
    C -->|index.html o página predeterminada| R0["Protección de Radicación"]
    C -->|consultar.html| Q0["Protección de Consulta"]
    C -->|registro_usuario.html| U0["Protección de Usuarios"]
    C -->|catalogos.html| G0["Protección de Catálogos"]

    subgraph Autenticación["Inicio y cierre de sesión"]
        L --> L1["Validar campos requeridos"]
        L1 --> L2["POST /api/auth/login sin sesión previa"]
        L2 --> API["Servicio solicitarApi"]
        API --> BE["Backend independiente · localhost:3000"]
        BE --> L3{"¿Credenciales aceptadas y sesión válida?"}
        L3 -->|No| L4["Mostrar error en el formulario"]
        L4 --> L
        L3 -->|Sí| L5["Guardar token y usuario en sessionStorage"]
        L5 --> L6{"Rol"}
        L6 -->|funcionario| Q0
        L6 -->|otro rol| R0
    end

    subgraph Sesión["Validación y permisos para pantallas protegidas"]
        R0 --> S0["ProteccionSesion / usarSesion"]
        Q0 --> S0
        U0 --> S0
        G0 --> S0
        S0 --> S1["Confirmar sesión con GET /api/auth/me"]
        S1 --> API
        S1 --> S2{"¿Sesión confirmada?"}
        S2 -->|No: sin sesión o HTTP 401| S3["Limpiar sesión si aplica y redirigir a login.html"]
        S2 -->|Sí| S4{"¿Pantalla y rol permitidos?"}
        S4 -->|Funcionario en Radicación| S5["Redirigir a consultar.html"]
        S4 -->|No administrador en Usuarios o Catálogos| S6["Mostrar acceso restringido"]
        S4 -->|Sí| P["Mostrar pantalla solicitada"]
        S5 --> Q0
    end

    P --> N["Navegación según rol"]
    N -->|Administrador o ventanilla| R["Radicar documento"]
    N -->|Cualquier usuario autenticado| Q["Consultar radicados"]
    N -->|Solo administrador| U["Gestión de usuarios"]
    N -->|Solo administrador| G["Gestión de catálogos"]
    N -->|Cerrar sesión| X["POST /api/auth/logout; limpiar sessionStorage; ir a login"]
    X --> API
    X --> L

    subgraph Operaciones["Operaciones de las pantallas"]
        R --> R1["Cargar tipos de trámite, dependencias y funcionario"]
        R1 --> API
        R1 --> R2["Validar datos, tipo de trámite y anexos PDF"]
        R2 --> R3{"¿Formulario válido y catálogos disponibles?"}
        R3 -->|No| R4["Mostrar error y permitir corrección"]
        R4 --> R
        R3 -->|Sí| R5["POST /api/radicados con FormData"]
        R5 --> API
        R5 --> R6{"¿Radicado creado?"}
        R6 -->|No| R4
        R6 -->|Sí| R7["Generar y descargar comprobante PDF; limpiar formulario"]

        Q --> Q1["Cargar radicados y dependencias"]
        Q1 --> API
        Q1 --> Q2["Buscar y filtrar por texto, fecha, estado crítico y comunicación"]
        Q2 --> Q3["Ver detalle y descargar/abrir anexos"]
        Q3 --> API
        Q2 --> Q4["Actualizar estado de radicado"]
        Q4 --> API
        Q2 --> Q5["Enviar respuesta con contenido y anexos"]
        Q5 --> API
        Q2 --> Q6["Consultar respuesta y sus documentos"]
        Q6 --> API
        Q2 --> Q7["Consultar alertas por dependencia"]
        Q7 --> API
        Q2 --> Q8["Generar o ver comprobante PDF"]

        U --> U1["Cargar usuarios y dependencias"]
        U1 --> API
        U1 --> U2["Crear o editar usuario"]
        U2 --> API
        U1 --> U3["Activar o inactivar cuenta"]
        U3 --> API
        U2 --> U4{"¿Se editó la cuenta del administrador actual?"}
        U4 -->|Sí| U5["Limpiar sesión local y volver a login"]
        U5 --> L
        U4 -->|No| U6["Actualizar listado y mostrar resultado"]
        U3 --> U6

        G --> G1["Cargar dependencias y tipos de trámite"]
        G1 --> API
        G1 --> G2["Crear o editar dependencia o tipo de trámite"]
        G2 --> API
        G1 --> G3["Activar o inactivar registro"]
        G3 --> API
        G1 --> G4["Consultar historial y registrar nueva versión de término legal"]
        G4 --> API
    end

    API --> API1["Para solicitudes protegidas: exigir sesión y adjuntar credencial"]
    API1 --> BE
    BE --> API2{"¿Respuesta HTTP correcta y success distinto de false?"}
    API2 -->|No| API3["Propagar error para mostrarlo en la pantalla"]
    API2 -->|401 en solicitud protegida| S3
    API2 -->|Sí| API4["Devolver respuesta a la pantalla"]
```

## Alcance

- Las cinco páginas HTML indicadas son las entradas configuradas en Vite y comparten el montaje React.
- Los permisos y redirecciones descritos corresponden a los controles del frontend; la validación definitiva de permisos depende también del backend.
- Los scripts de `legacy/js/` se conservan para compatibilidad/pruebas, pero las entradas HTML actuales cargan `src/main.jsx`.
