document.addEventListener("DOMContentLoaded", async () => {
    const tablaBody = document.getElementById("tabla-radicados");
    const buscador = document.getElementById("buscador");
    let listaRadicados = [];

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
        const dependenciasSet = new Set();

        radicados.forEach(item => {
            if (item.fecha_creacion) {
                const fechaItem = item.fecha_creacion.split('T')[0].split(' ')[0];
                if (fechaItem === hoyStr) {
                    radicadosHoy++;
                }
            }

            if (item.dependencia_destino) {
                dependenciasSet.add(item.dependencia_destino);
            }
        });

        const elTotal = document.getElementById('stat-total');
        const elHoy = document.getElementById('stat-hoy');
        const elDep = document.getElementById('stat-dependencias');

        if (elTotal) elTotal.textContent = total;
        if (elHoy) elHoy.textContent = radicadosHoy;
        if (elDep) elDep.textContent = dependenciasSet.size;
    }

    // Función para renderizar la tabla
    function mostrarDatos(datos) {
        if (datos.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">No se encontraron registros.</td></tr>`;
            return;
        }

        tablaBody.innerHTML = datos.map(item => {
            const fechaFormateada = new Date(item.fecha_creacion).toLocaleString();

            let soporteHtml = 'Sin archivo';
            if (item.ruta_archivo) {
                const urlPdf = `http://localhost:3000/uploads/${item.ruta_archivo}`;
                soporteHtml = `<a href="${urlPdf}" target="_blank" class="text-blue-600 hover:underline font-medium text-xs flex items-center gap-1">📄 Ver PDF</a>`;
            }

            return `
                <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                    <td class="p-4 font-semibold text-blue-600">${item.numero_radicado}</td>
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
                        ${soporteHtml}
                    </td>
                </tr>
            `;
        }).join('');
    }

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
            tablaBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">Error al cargar los datos.</td></tr>`;
        }
    } catch (error) {
        console.error("Error de red:", error);
        tablaBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">No se pudo conectar con el servidor.</td></tr>`;
    }

    // Filtrar en tiempo real con el buscador
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

    // --- TARJETA 3: DEPENDENCIAS DESTINO ---
    const cardDependencias = document.getElementById('card-dependencias');
    if (cardDependencias) {
        let filtradoDepActivo = false;
        cardDependencias.addEventListener('click', () => {
            const dependenciasUnicas = [...new Set(listaRadicados.map(item => item.dependencia_destino).filter(Boolean))];
            if (dependenciasUnicas.length === 0) return;

            filtradoDepActivo = !filtradoDepActivo;
            if (filtradoDepActivo) {
                const depSeleccionada = dependenciasUnicas[0];
                const radicadosDep = listaRadicados.filter(item => item.dependencia_destino === depSeleccionada);
                mostrarDatos(radicadosDep);
                cardDependencias.classList.add('ring-2', 'ring-purple-500', 'bg-purple-50/30');
            } else {
                mostrarDatos(listaRadicados);
                cardDependencias.classList.remove('ring-2', 'ring-purple-500', 'bg-purple-50/30');
            }
        });
    }
});