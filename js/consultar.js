document.addEventListener("DOMContentLoaded", async () => {
    const tablaBody = document.getElementById("tabla-radicados");
    const buscador = document.getElementById("buscador");
    let listaRadicados = [];

    // --- LÓGICA DEL MODAL DE DETALLE ---
    const modalDetalle = document.getElementById('modal-detalle');
    const btnCerrarModal = document.getElementById('btn-cerrar-modal');
    const btnCerrarFooter = document.getElementById('btn-cerrar-footer');
    let elementoQueAbreModal = null;
    let overflowAnterior = '';

    function cerrarModalFn() {
        if (modalDetalle) {
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
    function actualizarEstadisticas(radicados) {
        const total = radicados.length;

        // Fecha de hoy local en formato YYYY-MM-DD
        const hoy = new Date();
        const anio = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const dia = String(hoy.getDate()).padStart(2, '0');
        const hoyStr = `${anio}-${mes}-${dia}`;

        let radicadosHoy = 0;
        radicados.forEach(item => {
            if (item.fecha_creacion) {
                const fechaItem = item.fecha_creacion.split('T')[0].split(' ')[0];
                if (fechaItem === hoyStr) {
                    radicadosHoy++;
                }
            }
        });

        const elTotal = document.getElementById('stat-total');
        const elHoy = document.getElementById('stat-hoy');

        if (elTotal) elTotal.textContent = total;
        if (elHoy) elHoy.textContent = radicadosHoy;
    }

    // Función para renderizar la tabla con menú desplegable interactivo y radicado clickeable
    function mostrarDatos(datos) {
        if (datos.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-400">No se encontraron registros.</td></tr>`;
            return;
        }

        const estadosDisponibles = ['Recibido', 'En Trámite', 'Pendiente', 'Respondido'];

        tablaBody.innerHTML = datos.map(item => {
            const fechaFormateada = new Date(item.fecha_creacion).toLocaleString();
            const estadoActual = item.estado || 'Recibido';
            const tipoComunicacion = (item.tipo_comunicacion || '').trim();
            const tipoNormalizado = tipoComunicacion.toLowerCase();
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

            let soporteHtml = 'Sin archivo';
            if (item.ruta_archivo) {
                const urlPdf = `http://localhost:3000/uploads/${item.ruta_archivo}`;
                soporteHtml = `<a href="${urlPdf}" target="_blank" class="text-blue-600 hover:underline font-medium text-xs flex items-center gap-1">📄 Ver PDF</a>`;
            }

            return `
                <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                    <td class="p-4">
                        <button data-radicado="${item.numero_radicado}" class="ver-detalle font-semibold text-blue-600 hover:underline text-left cursor-pointer">
                            ${item.numero_radicado}
                        </button>
                    </td>
                    <td class="p-4">
                        <span class="badge-comunicacion ${tipoBadgeClass}">
                            ${tipoEtiqueta}
                        </span>
                    </td>
                    <td class="p-4 text-xs text-slate-500">${fechaFormateada}</td>
                    <td class="p-4">${item.remitente_nombre}</td>
                    <td class="p-4">${item.remitente_documento}</td>
                    <td class="p-4"><span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium">${item.dependencia_destino}</span></td>
                    <td class="p-4">
                        <span class="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-medium">
                            ${item.tiempo_de_respuesta || 'No especificado'}
                        </span>
                    </td>
                    <td class="p-4">
                        <select data-radicado="${item.numero_radicado}" class="select-estado px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer">
                            ${estadosDisponibles.map(est => `
                                <option value="${est}" ${estadoActual.toLowerCase() === est.toLowerCase() ? 'selected' : ''}>${est}
                                </option>
                            `).join('')}
                        </select>
                    </td>
                    <td class="p-4">
                        ${soporteHtml}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Escuchador global en la tabla para detectar cuando cambian un estado (Event Delegation)
    tablaBody.addEventListener('change', async (e) => {
        if (e.target.classList.contains('select-estado')) {
            const numeroRadicado = e.target.getAttribute('data-radicado');
            const nuevoEstado = e.target.value;

            try {
                const response = await fetch(`http://localhost:3000/api/radicados/${numeroRadicado}/estado`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ estado: nuevoEstado })
                });

                const resultado = await response.json();

                if (resultado.success) {
                    console.log(`Radicado ${numeroRadicado} actualizado a: ${nuevoEstado}`);

                    const radicadoEncontrado = listaRadicados.find(r => r.numero_radicado === numeroRadicado);
                    if (radicadoEncontrado) {
                        radicadoEncontrado.estado = nuevoEstado;
                    }
                } else {
                    alert('Error al actualizar el estado en el servidor.');
                }
            } catch (error) {
                console.error('Error de red al actualizar estado:', error);
                alert('No se pudo conectar con el servidor para guardar el cambio.');
            }
        }
    });

    // Escuchador en la tabla para abrir el modal al hacer clic en un radicado
    tablaBody.addEventListener('click', (e) => {
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
                document.getElementById('modal-documento').textContent = item.remitente_documento || 'No registrado';
                document.getElementById('modal-destino').textContent = item.dependencia_destino || 'No registrado';
                document.getElementById('modal-tiempo').textContent = item.tiempo_de_respuesta || 'No especificado';
                document.getElementById('modal-telefono').textContent = item.remitente_telefono || 'No registrado';
                document.getElementById('modal-email').textContent = item.remitente_email || 'No registrado';
                document.getElementById('modal-asunto').textContent = item.asunto_documento || 'Sin observaciones.';

                const contenedorSoporte = document.getElementById('modal-contenedor-soporte');
                if (item.ruta_archivo) {
                    const urlPdf = `http://localhost:3000/uploads/${item.ruta_archivo}`;
                    contenedorSoporte.innerHTML = `
                        <a href="${urlPdf}" target="_blank" rel="noopener noreferrer">
                            📄 Ver Documento de Soporte (PDF)
                        </a>
                    `;
                } else {
                    contenedorSoporte.innerHTML = `<p>No hay archivo adjunto para este radicado.</p>`;
                }

                // 2. ¡ESTO ES LO QUE FALTABA! Llamar a la función para mostrar el modal
                abrirModalFn();
            }
        }
    });

    // Consumir API del Backend
    try {
        const response = await fetch("http://localhost:3000/api/radicados");
        const resultado = await response.json();

        if (resultado.success) {
            listaRadicados = resultado.radicados;
            console.log("Radicados recibidos del servidor:", listaRadicados);
            mostrarDatos(listaRadicados);
            actualizarEstadisticas(listaRadicados);
        } else {
            tablaBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500">Error al cargar los datos.</td></tr>`;
        }
    } catch (error) {
        console.error("Error de red:", error);
        tablaBody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500">No se pudo conectar con el servidor.</td></tr>`;
    }

    // Filtrar en tiempo real con el buscador
    if (buscador) {
        buscador.addEventListener('input', (e) => {
            const texto = e.target.value.toLowerCase().trim();

            const filtrados = listaRadicados.filter(item => {
                const numRadicado = (item.numero_radicado || '').toLowerCase();
                const nombreRemitente = (item.remitente_nombre || '').toLowerCase();
                const docRemitente = (item.remitente_documento || '').toLowerCase();
                const nitRemitente = (item.remitente_nit || '').toLowerCase();

                return numRadicado.includes(texto) ||
                    nombreRemitente.includes(texto) ||
                    docRemitente.includes(texto) ||
                    nitRemitente.includes(texto);
            });

            mostrarDatos(filtrados);
        });
    }

    // --- TARJETA 1: TOTAL RADICADOS ---
    const cardTotal = document.getElementById('card-total');
    if (cardTotal) {
        let filtradoTotalActivo = false;
        cardTotal.addEventListener('click', () => {
            filtradoTotalActivo = !filtradoTotalActivo;
            mostrarDatos(listaRadicados);
            if (filtradoTotalActivo) {
                cardTotal.classList.add('ring-2', 'ring-blue-600', 'bg-blue-50/20');
            } else {
                cardTotal.classList.remove('ring-2', 'ring-blue-600', 'bg-blue-50/20');
            }
        });
    }

    // --- TARJETA 2: REGISTRADOS HOY ---
    const cardHoy = document.getElementById('card-hoy');
    if (cardHoy) {
        let filtradoHoyActivo = false;
        cardHoy.addEventListener('click', () => {
            filtradoHoyActivo = !filtradoHoyActivo;
            const hoy = new Date();
            const anio = hoy.getFullYear();
            const mes = String(hoy.getMonth() + 1).padStart(2, '0');
            const dia = String(hoy.getDate()).padStart(2, '0');
            const hoyStr = `${anio}-${mes}-${dia}`;

            if (filtradoHoyActivo) {
                const radicadosHoy = listaRadicados.filter(item => {
                    if (!item.fecha_creacion) return false;
                    return item.fecha_creacion.split('T')[0].split(' ')[0] === hoyStr;
                });
                mostrarDatos(radicadosHoy);
                cardHoy.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/30');
            } else {
                mostrarDatos(listaRadicados);
                cardHoy.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/30');
            }
        });
    }

    // --- TARJETA 3: FILTRO POR TIPO DE COMUNICACIÓN ---
    const cardTipoComunicacion = document.getElementById('card-tipo-comunicacion');
    const textoFiltroComunicacion = document.getElementById('texto-filtro-comunicacion');
    if (cardTipoComunicacion && textoFiltroComunicacion) {
        let tipoIndex = -1;
        cardTipoComunicacion.addEventListener('click', () => {
            const tiposComunicacion = [...new Set(
                listaRadicados
                    .map(item => item.tipo_comunicacion)
                    .filter(Boolean)
            )];

            if (tiposComunicacion.length === 0) return;

            tipoIndex++;

            if (tipoIndex < tiposComunicacion.length) {
                const tipoSeleccionado = tiposComunicacion[tipoIndex];
                textoFiltroComunicacion.textContent = tipoSeleccionado;
                mostrarDatos(listaRadicados.filter(
                    item => item.tipo_comunicacion === tipoSeleccionado
                ));
                cardTipoComunicacion.classList.add('ring-2', 'ring-purple-500', 'bg-purple-50/30');
            } else {
                tipoIndex = -1;
                textoFiltroComunicacion.textContent = 'Todos';
                mostrarDatos(listaRadicados);
                cardTipoComunicacion.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-50/30');
            }
        });
    }
});