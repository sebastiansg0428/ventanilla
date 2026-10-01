document.addEventListener("DOMContentLoaded", async () => {
    const tablaBody = document.getElementById("tabla-radicados");
    const buscador = document.getElementById("buscador");
    let listaRadicados = [];

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
            mostrarDatos(listaRadicados);
        } else {
            tablaBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">Error al cargar los datos.</td></tr>`;
        }
    } catch (error) {
        console.error("Error de red:", error);
        tablaBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">No se pudo conectar con el servidor.</td></tr>`;
    }

    // Filtrar en tiempo real por número de radicado, nombre o cédula/NIT
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
});