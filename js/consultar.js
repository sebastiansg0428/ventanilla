document.addEventListener("DOMContentLoaded", async () => {
    const tablaBody = document.getElementById("tabla-radicados");
    const buscador = document.getElementById("buscador");
    let listaRadicados = [];
    let datosCargados = false;
    const filtros = { criticos: false, hoy: false, tipo: '', texto: '' };
    const cardTotal = document.getElementById('card-total');
    const cardHoy = document.getElementById('card-hoy');
    const cardTipoComunicacion = document.getElementById('card-tipo-comunicacion');
    const filtroComunicacion = document.getElementById('filtro-comunicacion');
    const resumenFiltros = document.getElementById('resumen-filtros');
    const btnLimpiarFiltros = document.getElementById('limpiar-filtros');
    const visorComprobante = document.getElementById('visor-comprobante');
    const previewComprobante = document.getElementById('comprobante-preview');
    let urlComprobante = null;
    const dependenciaAlertas = document.getElementById('alertas-dependencia');
    const actualizarAlertas = document.getElementById('actualizar-alertas');
    const estadoAlertas = document.getElementById('alertas-estado');
    const proximosAlertas = document.getElementById('alertas-proximos');
    const vencidosAlertas = document.getElementById('alertas-vencidos');
    let solicitudAlertas = 0;

    function cargarDependenciasAlertas() {
        const dependencias = [...new Set(listaRadicados.map(item => item.dependencia_destino)
            .filter(nombre => typeof nombre === 'string' && nombre.trim()))].sort((a, b) => a.localeCompare(b));
        for (const nombre of dependencias) {
            const opcion = document.createElement('option');
            opcion.value = nombre;
            opcion.textContent = nombre;
            dependenciaAlertas.append(opcion);
        }
        dependenciaAlertas.disabled = dependencias.length === 0;
        estadoAlertas.textContent = dependencias.length
            ? 'Seleccione una dependencia para consultar sus alertas.'
            : 'No hay dependencias con radicados registrados.';
    }

    function mostrarListaAlertas(contenedor, alertas) {
        contenedor.replaceChildren();
        for (const item of alertas) {
            const fila = document.createElement('li');
            fila.textContent = `${item.numero_radicado} · ${item.remitente_nombre || 'No registrado'} · ${item.semaforo.texto || item.semaforo.nivel} · Fecha límite: ${item.fecha_limite_actual || 'No registrada'}`;
            contenedor.append(fila);
        }
        if (!alertas.length) {
            const fila = document.createElement('li');
            fila.textContent = 'Sin alertas en este grupo.';
            contenedor.append(fila);
        }
    }

    async function cargarAlertas() {
        const solicitudActual = ++solicitudAlertas;
        const dependencia = dependenciaAlertas.value;
        proximosAlertas.replaceChildren();
        vencidosAlertas.replaceChildren();
        actualizarAlertas.disabled = !dependencia;
        if (!dependencia) {
            estadoAlertas.textContent = 'Seleccione una dependencia para consultar sus alertas.';
            return;
        }
        estadoAlertas.textContent = 'Consultando alertas...';
        try {
            const response = await fetch(`http://localhost:3000/api/alertas?dependencia=${encodeURIComponent(dependencia)}`);
            if (response.status === 404) {
                throw new Error('El servidor activo no ofrece /api/alertas. Inicia el backend actualizado.');
            }
            const resultado = await response.json();
            if (solicitudActual !== solicitudAlertas) return;
            if (!response.ok || !resultado.success || !Array.isArray(resultado.alertas)) {
                throw new Error(resultado.message || 'Respuesta no válida al consultar alertas.');
            }
            mostrarListaAlertas(proximosAlertas, resultado.alertas.filter(item => item.semaforo?.nivel === 'alerta'));
            mostrarListaAlertas(vencidosAlertas, resultado.alertas.filter(item => item.semaforo?.nivel === 'vencido'));
            estadoAlertas.textContent = `${resultado.alertas.length} alertas para ${dependencia}.`;
        } catch (error) {
            if (solicitudActual !== solicitudAlertas) return;
            console.error('Error al consultar alertas:', error);
            estadoAlertas.textContent = `No se pudieron cargar las alertas. ${error.message} Usa Actualizar alertas para reintentar.`;
        }
    }
    dependenciaAlertas.addEventListener('change', cargarAlertas);
    actualizarAlertas.addEventListener('click', cargarAlertas);

    visorComprobante.addEventListener('close', () => {
        previewComprobante.removeAttribute('src');
        if (urlComprobante) URL.revokeObjectURL(urlComprobante);
        urlComprobante = null;
    });
    document.getElementById('cerrar-comprobante').addEventListener('click', () => visorComprobante.close());

    function normalizarTexto(valor) {
        return String(valor ?? '').trim().toLowerCase();
    }

    function obtenerTipo(item) {
        const tipo = normalizarTexto(item.tipo_comunicacion);
        return tipo === 'interna' || tipo === 'externa' ? tipo : 'sin-tipo';
    }

    function esCritico(item) {
        return ['vencido', 'alerta'].includes(normalizarTexto(item.semaforo?.nivel));
    }

    function fechaLocal(fecha) {
        return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    }

    function fechaRegistroLocal(valor) {
        if (!valor) return null;
        const texto = String(valor).trim();
        // Las fechas SQL sin zona horaria representan la fecha local del registro.
        const fecha = new Date(/^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00` : texto.replace(' ', 'T'));
        if (Number.isNaN(fecha.getTime())) {
            console.warn('Fecha de creación no válida para el filtro de hoy:', valor);
            return null;
        }
        return fechaLocal(fecha);
    }

    // --- LÓGICA DEL MODAL DE DETALLE ---
    const modalDetalle = document.getElementById('modal-detalle');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');
    const btnCerrarFooter = document.getElementById('btn-cerrar-footer');
    const adjuntoNombre = document.getElementById('modal-adjunto-nombre');
    const adjuntoEnlace = document.getElementById('modal-adjunto-enlace');
    const adjuntoMensaje = document.getElementById('modal-adjunto-mensaje');
    const adjuntoPreview = document.getElementById('modal-adjunto-preview');
    let solicitudAdjunto = 0;
    let elementoQueAbreModal = null;
    let overflowAnterior = '';

    function limpiarVistaAdjunto() {
        solicitudAdjunto++;
        adjuntoPreview.hidden = true;
        adjuntoPreview.removeAttribute('src');
        adjuntoEnlace.hidden = true;
        adjuntoEnlace.removeAttribute('href');
        adjuntoNombre.textContent = '';
        adjuntoMensaje.textContent = '';
    }

    async function mostrarAdjunto(item) {
        limpiarVistaAdjunto();
        if (!item.ruta_archivo) {
            adjuntoMensaje.textContent = 'No hay documento adjunto para este radicado.';
            return;
        }

        const solicitudActual = solicitudAdjunto;
        const urlPdf = `http://localhost:3000/uploads/${encodeURIComponent(item.ruta_archivo)}`;
        adjuntoNombre.textContent = item.nombre_archivo_original || 'Archivo PDF';
        adjuntoEnlace.href = urlPdf;
        adjuntoEnlace.hidden = false;
        adjuntoMensaje.textContent = 'Verificando disponibilidad del documento adjunto...';

        try {
            const response = await fetch(urlPdf, { method: 'HEAD' });
            if (solicitudActual !== solicitudAdjunto) return;
            if (!response.ok) {
                console.error('No se pudo acceder al documento adjunto:', item.numero_radicado, response.status);
                adjuntoMensaje.textContent = 'No se pudo cargar el documento adjunto. Verifica que el archivo esté disponible en el servidor.';
                return;
            }
            adjuntoPreview.title = `Documento adjunto: ${adjuntoNombre.textContent}`;
            adjuntoPreview.src = urlPdf;
            adjuntoPreview.hidden = false;
            adjuntoMensaje.textContent = '';
        } catch (error) {
            if (solicitudActual !== solicitudAdjunto) return;
            console.error('Error de conexión al consultar el documento adjunto:', error);
            adjuntoMensaje.textContent = 'No se pudo conectar con el servidor para cargar el documento adjunto. Puedes reabrir el detalle para reintentar.';
        }
    }

    function cerrarModalFn() {
        if (modalDetalle) {
            limpiarVistaAdjunto();
            modalDetalle.classList.remove('activo');
            modalDetalle.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = overflowAnterior;
            elementoQueAbreModal?.focus();
            elementoQueAbreModal = null;
        }
    }

    function abrirModalFn() {
        if (modalDetalle) {
            overflowAnterior = document.body.style.overflow;
            modalDetalle.classList.add('activo');
            modalDetalle.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            btnCerrarModal?.focus();
        }
    }

    if (btnCerrarModal) btnCerrarModal.onclick = cerrarModalFn;
    if (btnCerrarFooter) btnCerrarFooter.onclick = cerrarModalFn;

    modalDetalle?.addEventListener('click', (e) => {
        if (e.target === modalDetalle) {
            cerrarModalFn();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalDetalle?.classList.contains('activo')) {
            cerrarModalFn();
        }
    });

    // Función para actualizar las tarjetas del Dashboard con los datos
    function actualizarEstadisticas(hoyStr) {
        const elTotal = document.getElementById('stat-total');
        const elHoy = document.getElementById('stat-hoy');
        const elCriticos = document.getElementById('stat-criticos');

        if (elTotal) elTotal.textContent = listaRadicados.length;
        if (elHoy) elHoy.textContent = listaRadicados.filter(item => fechaRegistroLocal(item.fecha_creacion) === hoyStr).length;
        if (elCriticos) elCriticos.textContent = listaRadicados.filter(esCritico).length;
    }

    function aplicarFiltros() {
        if (!datosCargados) return;
        const hoyStr = fechaLocal(new Date());
        const filtrados = listaRadicados.filter(item => {
            const coincideBusqueda = ['numero_radicado', 'remitente_nombre', 'remitente_documento', 'remitente_nit']
                .some(campo => normalizarTexto(item[campo]).includes(filtros.texto));
            return coincideBusqueda
                && (!filtros.criticos || esCritico(item))
                && (!filtros.hoy || fechaRegistroLocal(item.fecha_creacion) === hoyStr)
                && (!filtros.tipo || obtenerTipo(item) === filtros.tipo);
        });

        mostrarDatos(filtrados);
        actualizarEstadisticas(hoyStr);
        cardTotal?.classList.toggle('filtro-activo', filtros.criticos);
        cardTotal?.setAttribute('aria-pressed', String(filtros.criticos));
        cardHoy?.classList.toggle('filtro-activo', filtros.hoy);
        cardHoy?.setAttribute('aria-pressed', String(filtros.hoy));
        cardTipoComunicacion?.classList.toggle('filtro-activo', Boolean(filtros.tipo));

        const activos = [];
        if (filtros.criticos) activos.push('Críticos (alerta o vencidos)');
        if (filtros.hoy) activos.push('Registrados hoy');
        if (filtros.tipo) activos.push(filtroComunicacion.options[filtroComunicacion.selectedIndex].text);
        if (filtros.texto) activos.push(`Búsqueda: "${buscador.value.trim()}"`);
        if (resumenFiltros) {
            resumenFiltros.textContent = `Mostrando ${filtrados.length} de ${listaRadicados.length} radicados. ${activos.length ? `Filtros: ${activos.join(' · ')}.` : 'Sin filtros activos.'}`;
        }
        if (btnLimpiarFiltros) btnLimpiarFiltros.disabled = activos.length === 0;
    }

    // Función para renderizar la tabla de forma limpia y profesional
    function mostrarDatos(datos) {
        if (datos.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No se encontraron registros.</td></tr>`;
            return;
        }

        const estadosDisponibles = ['Recibido', 'En trámite', 'Pendiente', 'Respondido'];
        const estilosSemaforo = {
            completado: 'verde',
            vencido: 'rojo',
            alerta: 'amarillo',
            a_tiempo: 'verde'
        };

        tablaBody.innerHTML = datos.map(item => {
            const fechaFormateada = new Date(item.fecha_creacion).toLocaleString();
            const estadoActual = item.estado || 'Recibido';
            const tipoNormalizado = obtenerTipo(item);
            const tipoBadgeClass = tipoNormalizado === 'interna'
                ? 'badge-comunicacion--interna'
                : tipoNormalizado === 'externa'
                    ? 'badge-comunicacion--externa'
                    : 'badge-comunicacion--sin-tipo';
            const tipoEtiqueta = tipoNormalizado === 'interna'
                ? 'Interna'
                : tipoNormalizado === 'externa'
                    ? 'Externa'
                    : 'No especificado';

            const semaforo = item.semaforo || {};
            const estiloSemaforo = estilosSemaforo[normalizarTexto(semaforo.nivel)] || 'sin-calcular';

            return `
                <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <!-- 1. RADICADO -->
                <td class="px-4 py-3 whitespace-nowrap">
    <button data-radicado="${item.numero_radicado}" class="ver-detalle font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1.5 cursor-pointer" style="border: none; background: transparent; padding: 0; outline: none; box-shadow: none;">
        <svg style="width: 16px; height: 16px;" class="text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        </svg>
        <span>${item.numero_radicado}</span>
    </button>
</td>

                    <!-- 2. TIPO Y FECHA -->
                    <td class="p-4">
                        <span class="badge-comunicacion ${tipoBadgeClass} mb-1 inline-block">
                            ${tipoEtiqueta}
                        </span>
                        <div class="text-xs text-slate-500">${fechaFormateada}</div>
                    </td>

                    <!-- 3. REMITENTE -->
                    <td class="p-4">
                        <div class="font-medium text-slate-800 text-sm">${item.remitente_nombre || 'No registrado'}</div>
                        <div class="text-xs text-slate-400">CC/NIT: ${item.remitente_documento || item.remitente_nit || 'N/A'}</div>
                    </td>

                    <!-- 4. SEMÁFORO -->
                    <td class="p-4">
                        <span class="semaforo semaforo--${estiloSemaforo}">
                            <span class="semaforo__dot"></span>
                            ${semaforo.texto || 'Sin calcular'}
                        </span>
                    </td>

                    <!-- 5. ESTADO -->
                    <td class="p-4">
                        <select id="estado-${encodeURIComponent(item.numero_radicado)}" aria-label="Estado del radicado ${item.numero_radicado}" data-radicado="${item.numero_radicado}" class="select-estado px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer">
                            ${estadosDisponibles.map(est => `
                                <option value="${est}" ${estadoActual.toLowerCase() === est.toLowerCase() ? 'selected' : ''}>${est}</option>
                            `).join('')}
                        </select>
                    </td>

                    <!-- 6. ACCIÓN PDF -->
                    <td class="p-4 text-center">
                            <button type="button" data-radicado="${item.numero_radicado}" class="generar-comprobante" title="Ver el comprobante de recepción sin descargarlo">
                                <svg class="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>
                                Ver comprobante
                            </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Escuchador global en la tabla para detectar cuando cambian un estado (Event Delegation)
    tablaBody.addEventListener('change', async (e) => {
        if (e.target.classList.contains('select-estado')) {
            const selector = e.target;
            const numeroRadicado = selector.getAttribute('data-radicado');
            const radicadoEncontrado = listaRadicados.find(r => r.numero_radicado === numeroRadicado);
            if (!radicadoEncontrado) {
                console.error('No se encontró el radicado para actualizar su estado:', numeroRadicado);
                alert('No se encontró el radicado para guardar el cambio de estado. Recarga la página.');
                return;
            }
            const estadoAnterior = radicadoEncontrado.estado || 'Recibido';
            const nuevoEstado = selector.value;
            selector.disabled = true;

            try {
                const response = await fetch(`http://localhost:3000/api/radicados/${numeroRadicado}/estado`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ estado: nuevoEstado })
                });

                const resultado = await response.json();

                if (response.ok && resultado.success) {
                    console.log(`Radicado ${numeroRadicado} actualizado a: ${resultado.estado}`);

                    radicadoEncontrado.estado = resultado.estado;
                    radicadoEncontrado.semaforo = resultado.semaforo;
                    aplicarFiltros();
                    if (dependenciaAlertas.value) await cargarAlertas();
                } else {
                    selector.value = estadoAnterior;
                    alert(resultado.message || 'Error al actualizar el estado en el servidor.');
                }
            } catch (error) {
                selector.value = estadoAnterior;
                console.error('Error de red al actualizar estado:', error);
                alert('No se pudo conectar con el servidor para guardar el cambio.');
            } finally {
                if (selector.isConnected) selector.disabled = false;
            }
        }
    });

    // Escuchador en la tabla para abrir el modal al hacer clic en un radicado
    tablaBody.addEventListener('click', async (e) => {
        const btnComprobante = e.target.closest('.generar-comprobante');
        if (btnComprobante) {
            const item = listaRadicados.find(r => r.numero_radicado === btnComprobante.getAttribute('data-radicado'));
            try {
                if (!item) throw new Error('No se encontró el radicado para generar el comprobante.');
                const fecha = new Date(String(item.fecha_creacion || '').replace(' ', 'T'));
                if (Number.isNaN(fecha.getTime())) throw new Error('El radicado no tiene una fecha de recepción válida.');
                const doc = crearComprobantePDF({ ...item, fecha_hora: fecha.toLocaleString() });
                if (urlComprobante) URL.revokeObjectURL(urlComprobante);
                urlComprobante = URL.createObjectURL(doc.output('blob'));
                document.getElementById('comprobante-titulo').textContent = `Comprobante de recepción: ${item.numero_radicado}`;
                previewComprobante.src = urlComprobante;
                visorComprobante.showModal();
            } catch (error) {
                console.error('Error al generar el comprobante:', error);
                alert(`No se pudo generar el comprobante. ${error.message}`);
            }
            return;
        }
        // Asegúrate de incluir el punto '.' para buscar la clase
        const btnDetalle = e.target.closest('.ver-detalle');

        if (btnDetalle) {
            const numRadicado = btnDetalle.getAttribute('data-radicado');
            const item = listaRadicados.find(r => r.numero_radicado === numRadicado);

            if (item) {
                elementoQueAbreModal = btnDetalle;

                // 1. Rellenar los campos con la información del radicado
                document.getElementById('modal-num-radicado').textContent = item.numero_radicado;
                document.getElementById('modal-fecha').textContent = new Date(item.fecha_creacion).toLocaleString();
                document.getElementById('modal-estado').textContent = item.estado || 'Recibido';

                document.getElementById('modal-remitente').textContent = item.remitente_nombre || 'No registrado';
                document.getElementById('modal-documento').textContent = item.remitente_documento || item.remitente_nit || 'No registrado';
                document.getElementById('modal-destino').textContent = item.dependencia_destino || 'No registrado';
                document.getElementById('modal-tiempo').textContent = item.tiempo_de_respuesta || 'No especificado';
                document.getElementById('modal-fecha-limite').textContent = item.fecha_limite_actual || 'No registrada';
                document.getElementById('modal-fundamento-legal').textContent = item.fundamento_legal_aplicado || 'No registrado';
                document.getElementById('modal-telefono').textContent = item.remitente_telefono || 'No registrado';
                document.getElementById('modal-email').textContent = item.remitente_email || 'No registrado';
                document.getElementById('modal-asunto').textContent = item.asunto_documento || 'Sin observaciones.';

                // 2. Llamar a la función para mostrar el modal
                abrirModalFn();
                await mostrarAdjunto(item);
            }
        }
    });

    function conectarTarjeta(tarjeta, criterio) {
        if (!tarjeta) return;
        tarjeta.addEventListener('click', () => {
            if (!datosCargados) return;
            filtros[criterio] = !filtros[criterio];
            aplicarFiltros();
        });
        tarjeta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                tarjeta.click();
            }
        });
    }

    conectarTarjeta(cardTotal, 'criticos');
    conectarTarjeta(cardHoy, 'hoy');
    buscador?.addEventListener('input', () => {
        filtros.texto = normalizarTexto(buscador.value);
        aplicarFiltros();
    });
    filtroComunicacion?.addEventListener('change', () => {
        filtros.tipo = filtroComunicacion.value;
        aplicarFiltros();
    });
    btnLimpiarFiltros?.addEventListener('click', () => {
        Object.assign(filtros, { criticos: false, hoy: false, tipo: '', texto: '' });
        if (buscador) buscador.value = '';
        if (filtroComunicacion) filtroComunicacion.value = '';
        aplicarFiltros();
        buscador?.focus();
    });

    // Consumir API del Backend
    try {
        const response = await fetch("http://localhost:3000/api/radicados");
        const resultado = await response.json();

        if (response.ok && resultado.success && Array.isArray(resultado.radicados)) {
            listaRadicados = resultado.radicados;
            datosCargados = true;
            cardTotal?.setAttribute('aria-disabled', 'false');
            cardHoy?.setAttribute('aria-disabled', 'false');
            if (buscador) buscador.disabled = false;
            if (filtroComunicacion) filtroComunicacion.disabled = false;
            aplicarFiltros();
            cargarDependenciasAlertas();
        } else {
            console.error('Error al cargar radicados:', resultado.message || 'Respuesta no válida del servidor.');
            tablaBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">Error al cargar los datos.</td></tr>`;
            if (resumenFiltros) resumenFiltros.textContent = 'No se pudieron cargar los radicados. Recarga la página para reintentar.';
            estadoAlertas.textContent = 'No se pudieron cargar las dependencias. Recarga la página para reintentar.';
        }
    } catch (error) {
        console.error("Error de red:", error);
        tablaBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">No se pudo conectar con el servidor.</td></tr>`;
        if (resumenFiltros) resumenFiltros.textContent = 'No se pudo conectar con el servidor. Recarga la página para reintentar.';
        estadoAlertas.textContent = 'No se pudieron cargar las dependencias. Recarga la página para reintentar.';
    }
});