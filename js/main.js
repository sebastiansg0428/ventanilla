document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await AppAuth.confirmarSesion({ recepcion: true });
    if (!usuario) return;
    const form = document.querySelector('form');
    const inputArchivo = document.getElementById('archivo');
    const textoArchivo = document.getElementById('texto-archivo');
    const selectorTramite = document.getElementById('tipo_tramite_id');
    const estadoTramites = document.getElementById('estado-tipos-tramite');
    const reintentarTramites = document.getElementById('reintentar-tipos-tramite');
    const dropzoneArea = document.getElementById('dropzone-area');
    const btnQuitarArchivo = document.getElementById('btn-quitar-archivo');
    const archivoDetalle = document.getElementById('archivo-detalle');
    const archivoNombreDetalle = document.getElementById('archivo-nombre-detalle');
    const pistaArchivo = document.getElementById('pista-archivo');
    const inputAsunto = document.getElementById('asunto_documento');
    const contadorAsunto = document.getElementById('contador-asunto');
    const btnSubmit = document.getElementById('btn-submit');
    const btnSubmitTexto = document.getElementById('btn-submit-texto');
    const selectorDependencia = document.getElementById('dependencia_destino');
    const estadoDependencias = document.getElementById('estado-dependencias');
    const reintentarDependencias = document.getElementById('reintentar-dependencias');
    const selectorFuncionario = document.getElementById('usuario_recibe');
    const estadoFuncionarios = document.getElementById('estado-funcionarios');
    const reintentarFuncionarios = document.getElementById('reintentar-funcionarios');

    let tiposTramite = [];
    let dependencias = [];
    let archivoSeleccionadoGlobal = null;

    if (!form) {
        console.error("No se encontró el formulario en el DOM.");
        return;
    }

    // --- CARGA DINÁMICA DE TIPOS DE TRÁMITE ---
    async function cargarTiposTramite() {
        selectorTramite.disabled = true;
        reintentarTramites.hidden = true;
        estadoTramites.textContent = 'Cargando tipos de trámite...';
        try {
            const response = await apiFetch('/api/tipos-tramite');
            if (response.status === 404) {
                throw new Error('El servidor activo no ofrece /api/tipos-tramite. Inicia el backend actualizado.');
            }
            const resultado = await response.json();
            if (!response.ok || !resultado.success || !Array.isArray(resultado.tipos_tramite)) {
                throw new Error(resultado.message || 'Respuesta no válida al consultar tipos de trámite.');
            }
            const ordenDeseado = [
                'informativo',
                'solicitud',
                'derecho_peticion',
                'denuncia',
                'queja',
                'reclamo',
                'notificacion_judicial',
                'restablecimiento_derecho',
                'cuotas_partes',
                'accion_tutela',
                'desacato_tutela',
                'licencia_construccion',
                'notificacion',
                'invitacion',
                'licencia_urbanistica',
                'solicitud_simit_rut'
            ];
            tiposTramite = resultado.tipos_tramite.filter(tipo => tipo.termino_legal_id != null);
            tiposTramite.sort((a, b) => {
                const ordenA = a.orden != null && a.orden > 0 ? a.orden : (ordenDeseado.indexOf(a.codigo) !== -1 ? ordenDeseado.indexOf(a.codigo) + 1 : 999);
                const ordenB = b.orden != null && b.orden > 0 ? b.orden : (ordenDeseado.indexOf(b.codigo) !== -1 ? ordenDeseado.indexOf(b.codigo) + 1 : 999);
                if (ordenA !== ordenB) return ordenA - ordenB;
                return (a.nombre || '').localeCompare(b.nombre || '');
            });
            selectorTramite.replaceChildren();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Seleccione el tipo de trámite...';
            selectorTramite.append(placeholder);
            for (const tipo of tiposTramite) {
                const opcion = document.createElement('option');
                opcion.value = String(tipo.id);
                opcion.textContent = tipo.nombre;
                selectorTramite.append(opcion);
            }
            selectorTramite.disabled = tiposTramite.length === 0;
            estadoTramites.textContent = tiposTramite.length
                ? 'El servidor determina el término legal y la fecha límite del trámite.'
                : 'No hay tipos de trámite con término legal disponible.';
            reintentarTramites.hidden = tiposTramite.length > 0;
        } catch (error) {
            console.error('Error al cargar tipos de trámite:', error);
            selectorTramite.replaceChildren();
            const opcion = document.createElement('option');
            opcion.value = '';
            opcion.textContent = 'Trámites no disponibles';
            selectorTramite.append(opcion);
            estadoTramites.textContent = `No se pudieron cargar los trámites. ${error.message}`;
            reintentarTramites.hidden = false;
        }
    }
    reintentarTramites.addEventListener('click', cargarTiposTramite);
    cargarTiposTramite();

    // --- CARGA DINÁMICA DE DEPENDENCIAS ---
    async function cargarDependencias() {
        selectorDependencia.disabled = true;
        reintentarDependencias.hidden = true;
        estadoDependencias.textContent = 'Cargando dependencias...';
        try {
            const response = await apiFetch('/api/dependencias');
            const resultado = await response.json();
            if (!Array.isArray(resultado.dependencias)) {
                throw new Error('Respuesta no válida al consultar dependencias.');
            }
            dependencias = resultado.dependencias;
            selectorDependencia.replaceChildren();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Seleccione la dependencia de destino...';
            selectorDependencia.append(placeholder);
            for (const dependencia of dependencias) {
                const opcion = document.createElement('option');
                opcion.value = String(dependencia.id);
                opcion.textContent = dependencia.nombre;
                selectorDependencia.append(opcion);
            }
            selectorDependencia.disabled = dependencias.length === 0;
            reintentarDependencias.hidden = dependencias.length > 0;
            estadoDependencias.textContent = dependencias.length
                ? 'Seleccione la dependencia de destino.'
                : 'No hay dependencias disponibles en el catálogo.';
        } catch (error) {
            console.error('Error al cargar dependencias:', error);
            estadoDependencias.textContent = error.message;
            reintentarDependencias.hidden = false;
        }
    }
    reintentarDependencias.addEventListener('click', cargarDependencias);
    cargarDependencias();

    // --- CARGA DINÁMICA DE FUNCIONARIOS DE VENTANILLA ---
    async function cargarFuncionariosVentanilla() {
        if (!selectorFuncionario) return;

        // El usuario de ventanilla siempre registra con su propia sesión.
        // No necesita elegir a otra persona ni consultar el directorio completo.
        if (usuario.rol === 'ventanilla') {
            selectorFuncionario.replaceChildren(new Option(usuario.nombre, String(usuario.id)));
            selectorFuncionario.value = String(usuario.id);
            selectorFuncionario.disabled = true;
            estadoFuncionarios.textContent = `Sesión iniciada como ${usuario.nombre}. El responsable se registra con esta cuenta.`;
            reintentarFuncionarios.hidden = true;
            return;
        }

        selectorFuncionario.disabled = true;
        reintentarFuncionarios.hidden = true;
        estadoFuncionarios.textContent = 'Cargando funcionarios de ventanilla...';
        try {
            const response = await apiFetch('/api/usuarios/ventanilla');
            const resultado = await response.json();
            if (!response.ok || resultado.success !== true || !Array.isArray(resultado.usuarios)) {
                throw new Error(resultado.message || 'Respuesta no válida al consultar funcionarios.');
            }

            selectorFuncionario.replaceChildren();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Seleccione el funcionario...';
            selectorFuncionario.append(placeholder);

            for (const funcionario of resultado.usuarios) {
                const option = document.createElement('option');
                option.value = String(funcionario.id);
                option.textContent = funcionario.nombre;
                selectorFuncionario.append(option);
            }

            selectorFuncionario.disabled = resultado.usuarios.length === 0;
            estadoFuncionarios.textContent = resultado.usuarios.length
                ? `${resultado.usuarios.length} funcionario(s) de ventanilla disponible(s).`
                : 'No hay usuarios con rol de ventanilla registrados.';
            reintentarFuncionarios.hidden = resultado.usuarios.length > 0;
        } catch (error) {
            console.error('Error al cargar funcionarios de ventanilla:', error);
            selectorFuncionario.replaceChildren(new Option('Funcionarios no disponibles', ''));
            selectorFuncionario.disabled = true;
            estadoFuncionarios.textContent = `No se pudo cargar el directorio. ${error.message}`;
            reintentarFuncionarios.hidden = false;
        }
    }
    reintentarFuncionarios.addEventListener('click', cargarFuncionariosVentanilla);
    cargarFuncionariosVentanilla();

    // 1. Validación estricta en tiempo real: Solo números con límite de dígitos
    const inputsNumericos = document.querySelectorAll(
        'input[name="remitente_documento"], input[name="remitente_nit"], input[name="remitente_telefono"]'
    );

    inputsNumericos.forEach(input => {
        input.addEventListener('input', (e) => {
            let valor = e.target.value.replace(/\D/g, '');
            const maxLength = input.getAttribute('maxlength');

            if (maxLength && valor.length > maxLength) {
                valor = valor.slice(0, maxLength);
            }
            e.target.value = valor;
        });
    });

    // 2. Formateador de peso en bytes a texto legible
    function formatearTamano(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const unidades = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${unidades[i]}`;
    }

    // 3. Manejo visual y estado del archivo PDF seleccionado
    function actualizarVistaArchivo(archivo) {
        if (archivo) {
            archivoSeleccionadoGlobal = archivo;
            const tamanoTexto = archivo.size ? ` (${formatearTamano(archivo.size)})` : '';
            if (textoArchivo) {
                textoArchivo.textContent = `📄 ${archivo.name}${tamanoTexto}`;
                textoArchivo.classList.add('text-blue-600', 'font-semibold');
            }
            if (archivoDetalle) {
                archivoDetalle.hidden = false;
            }
            if (archivoNombreDetalle) {
                archivoNombreDetalle.textContent = `${archivo.name}${tamanoTexto}`;
            }
            if (pistaArchivo) {
                pistaArchivo.hidden = true;
            }
        } else {
            archivoSeleccionadoGlobal = null;
            if (inputArchivo) {
                inputArchivo.value = '';
            }
            if (textoArchivo) {
                textoArchivo.textContent = "Haz clic aquí o arrastra tu archivo PDF";
                textoArchivo.classList.remove('text-blue-600', 'font-semibold');
            }
            if (archivoDetalle) {
                archivoDetalle.hidden = true;
            }
            if (pistaArchivo) {
                pistaArchivo.hidden = false;
            }
        }
    }

    if (inputArchivo) {
        inputArchivo.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const archivo = e.target.files[0];
                if (archivo.type && archivo.type !== 'application/pdf' && !archivo.name?.toLowerCase().endsWith('.pdf')) {
                    alert('El archivo seleccionado debe ser un documento PDF.');
                    actualizarVistaArchivo(null);
                    return;
                }
                if (archivo.size && archivo.size > 10 * 1024 * 1024) {
                    alert('El archivo supera el límite máximo permitido de 10MB.');
                    actualizarVistaArchivo(null);
                    return;
                }
                actualizarVistaArchivo(archivo);
                console.log("📁 Archivo cargado:", archivo.name);
            } else {
                actualizarVistaArchivo(null);
            }
        });
    }

    if (btnQuitarArchivo) {
        btnQuitarArchivo.addEventListener('click', (e) => {
            e.preventDefault?.();
            e.stopPropagation?.();
            actualizarVistaArchivo(null);
        });
    }

    // 4. Soporte para arrastrar y soltar (Drag and Drop)
    if (dropzoneArea) {
        ['dragenter', 'dragover'].forEach(nombreEvento => {
            dropzoneArea.addEventListener(nombreEvento, (e) => {
                e.preventDefault?.();
                dropzoneArea.classList.add('drag-active');
            });
        });

        ['dragleave', 'drop'].forEach(nombreEvento => {
            dropzoneArea.addEventListener(nombreEvento, (e) => {
                e.preventDefault?.();
                dropzoneArea.classList.remove('drag-active');
            });
        });

        dropzoneArea.addEventListener('drop', (e) => {
            const archivos = e.dataTransfer?.files;
            if (archivos && archivos.length > 0) {
                const archivo = archivos[0];
                if (archivo.type && archivo.type !== 'application/pdf' && !archivo.name?.toLowerCase().endsWith('.pdf')) {
                    alert('El archivo seleccionado debe ser un documento PDF.');
                    return;
                }
                if (archivo.size && archivo.size > 10 * 1024 * 1024) {
                    alert('El archivo supera el límite máximo permitido de 10MB.');
                    return;
                }
                actualizarVistaArchivo(archivo);
            }
        });
    }

    // 5. Contador de caracteres en tiempo real para el asunto
    if (inputAsunto && contadorAsunto) {
        inputAsunto.addEventListener('input', () => {
            const longitud = inputAsunto.value ? inputAsunto.value.length : 0;
            contadorAsunto.textContent = `${longitud} caracteres ingresados`;
        });
    }

    // 6. Control de estado del botón de envío (loading state)
    function alternarEstadoEnvio(enviando) {
        if (btnSubmit) {
            btnSubmit.disabled = enviando;
        }
        if (btnSubmitTexto) {
            btnSubmitTexto.textContent = enviando
                ? 'Generando radicado y registrando...'
                : 'Generar Radicado y Registrar';
        }
    }

    // 7. Manejar el envío del formulario al backend de Node.js
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (selectorTramite.disabled || !tiposTramite.some(tipo => String(tipo.id) === selectorTramite.value)) {
            alert('Selecciona un tipo de trámite con término legal disponible antes de registrar.');
            return;
        }

        if (selectorDependencia.disabled || !dependencias.some(dependencia => String(dependencia.id) === selectorDependencia.value)) {
            alert('Selecciona una dependencia del catálogo antes de registrar.');
            return;
        }

        if (!archivoSeleccionadoGlobal) {
            alert("Por favor, adjunta obligatoriamente un archivo en formato PDF.");
            return;
        }

        const formData = new FormData(form);
        formData.set('archivo', archivoSeleccionadoGlobal);

        alternarEstadoEnvio(true);

        try {
            console.log("🚀 Enviando datos de radicación al servidor...");

            const response = await apiFetch('/api/radicados', {
                method: 'POST',
                body: formData
            });

            const resultado = await response.json();

            if (response.ok && resultado.success) {
                console.log("✅ Respuesta exitosa:", resultado);

                // --- EXTRAER DATOS PARA EL COMPROBANTE ---
                const radicadoCompleto = resultado.radicado || "4800";
                const soloCuatroDigitos = radicadoCompleto.split('-').pop() || radicadoCompleto;

                const datosComprobante = {
                    numero_radicado: soloCuatroDigitos,
                    tipo_comunicacion: formData.get('tipo_comunicacion') || 'Externa',
                    numero_folios: formData.get('numero_folios') || '1',
                    dependencia_destino: dependencias.find(dependencia => String(dependencia.id) === selectorDependencia.value).nombre,
                    // El backend devuelve el nombre de la sesión que guardó el radicado.
                    usuario_recibe: resultado.usuario_recibe || usuario.nombre || 'Usuario autenticado',
                    remitente_nombre: formData.get('remitente_nombre') || 'No especificado',
                    remitente_documento: formData.get('remitente_documento') || '',
                    asunto_documento: formData.get('asunto_documento') || 'Sin asunto registrado',
                    fecha_hora: new Date().toLocaleString()
                };

                // --- GENERAR Y DESCARGAR EL PDF AUTOMÁTICAMENTE ---
                let pdfDescargado = false;
                try {
                    descargarComprobantePDF(datosComprobante);
                    pdfDescargado = true;
                } catch (pdfError) {
                    console.warn("⚠️ No se pudo generar la descarga automática del PDF:", pdfError);
                }

                if (pdfDescargado) {
                    alert(`¡Radicado exitoso!\nNúmero asignado: ${resultado.radicado}\nSu comprobante en PDF se ha descargado.`);
                } else {
                    alert(`¡Radicado exitoso!\nNúmero asignado: ${resultado.radicado}\n\n(Aviso: No se pudo descargar el comprobante en PDF automáticamente. Puedes consultarlo o reimprimirlo en "Consultar Radicado").`);
                }

                form.reset();
                actualizarVistaArchivo(null);
                if (contadorAsunto) {
                    contadorAsunto.textContent = '0 caracteres ingresados';
                }
            } else {
                alert(`Error: ${resultado.message || 'No se pudo completar el registro.'}`);
            }

        } catch (error) {
            console.error("❌ Error al registrar el radicado:", error);
            alert(error.message);
        } finally {
            alternarEstadoEnvio(false);
        }
    });
});
