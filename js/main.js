document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form');
    const inputArchivo = document.getElementById('archivo');
    const textoArchivo = document.getElementById('texto-archivo');
    let archivoSeleccionadoGlobal = null;

    if (!form) {
        console.error("No se encontró el formulario en el DOM.");
        return;
    }

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

    // 2. Capturar el archivo PDF en memoria y actualizar el texto visual
    if (inputArchivo) {
        inputArchivo.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                archivoSeleccionadoGlobal = e.target.files[0];
                const nombreArchivo = archivoSeleccionadoGlobal.name;

                if (textoArchivo) {
                    textoArchivo.textContent = `📄 ${nombreArchivo}`;
                    textoArchivo.classList.add('text-blue-600', 'font-semibold');
                }
                console.log("📁 Archivo cargado:", nombreArchivo);
            } else {
                archivoSeleccionadoGlobal = null;
                if (textoArchivo) {
                    textoArchivo.textContent = "Haz clic aquí o arrastra tu archivo PDF";
                    textoArchivo.classList.remove('text-blue-600', 'font-semibold');
                }
            }
        });
    }

    // 3. Manejar el envío del formulario al backend de Node.js
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!archivoSeleccionadoGlobal) {
            alert("Por favor, adjunta obligatoriamente un archivo en formato PDF.");
            return;
        }

        const formData = new FormData(form);
        formData.set('archivo', archivoSeleccionadoGlobal);

        try {
            console.log("🚀 Enviando datos de radicación al servidor...");

            const response = await fetch('http://localhost:3000/api/radicados', {
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
                    dependencia_destino: formData.get('dependencia_destino') || 'General',
                    usuario_recibe: formData.get('usuario_recibe') || 'Ventanilla Única',
                    remitente_nombre: formData.get('remitente_nombre') || 'No especificado',
                    remitente_documento: formData.get('remitente_documento') || '',
                    asunto_documento: formData.get('asunto_documento') || 'Sin asunto registrado',
                    fecha_hora: new Date().toLocaleString()
                };;
                // --- GENERAR Y DESCARGAR EL PDF AUTOMÁTICAMENTE ---
                descargarComprobantePDF(datosComprobante);

                alert(`¡Radicado exitoso!\nNúmero asignado: ${resultado.radicado}\nSu comprobante en PDF se ha descargado.`);

                form.reset();
                archivoSeleccionadoGlobal = null;
                if (textoArchivo) {
                    textoArchivo.textContent = "Haz clic aquí o arrastra tu archivo PDF";
                    textoArchivo.classList.remove('text-blue-600', 'font-semibold');
                }
            } else {
                alert(`Error: ${resultado.message || 'No se pudo completar el registro.'}`);
            }

        } catch (error) {
            console.error("❌ Error de conexión con el backend:", error);
            alert("No se pudo conectar con el servidor. Verifica que Node.js esté encendido en el puerto 3000.");
        }
    });
});

// --- FUNCIÓN PARA GENERAR EL COMPROBANTE INSTITUCIONAL CON jsPDF ---
function descargarComprobantePDF(datosRadicado) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Encabezado institucional
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ALCALDÍA MUNICIPAL", 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Sistema de Ventanilla Única - Comprobante de Recepción Documental", 105, 27, { align: "center" });

    // Línea divisoria
    doc.setLineWidth(0.4);
    doc.line(20, 32, 190, 32);

    // Caja destacada para el radicado principal
    doc.setFillColor(241, 245, 249);
    doc.rect(20, 38, 170, 24, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Número de Radicado:", 25, 47);
    doc.setTextColor(30, 64, 175); // Azul corporativo
    doc.text(datosRadicado.numero_radicado, 68, 47);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text("Fecha y Hora:", 25, 56);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleString(), 55, 56);

    // Detalles específicos solicitados
    let y = 72;
    doc.setFont("helvetica", "bold");
    doc.text("Detalles del Trámite:", 20, y);

    y += 8;
    doc.setFont("helvetica", "normal");

    const itemsDetalle = [
        `Tipo de Comunicación: ${datosRadicado.tipo_comunicacion}`,
        `Número de Radicado: ${datosRadicado.numero_radicado}`,
        `Número de Folios: ${datosRadicado.numero_folios || '1'}`,
        `Dependencia Destino: ${datosRadicado.dependencia_destino}`,
        `Funcionario / Quien Recibe: ${datosRadicado.usuario_recibe || 'Ventanilla Única'}`,
        `Remitente: ${datosRadicado.remitente_nombre} (${datosRadicado.remitente_documento || 'N/A'})`
    ];

    itemsDetalle.forEach(detalle => {
        doc.text(`• ${detalle}`, 24, y);
        y += 7;
    });

    // Asunto
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Asunto del Trámite:", 20, y);

    y += 6;
    doc.setFont("helvetica", "normal");
    const asuntoDividido = doc.splitTextToSize(datosRadicado.asunto_documento, 170);
    doc.text(asuntoDividido, 20, y);

    // Pie de página institucional
    doc.setLineWidth(0.2);
    doc.line(20, 270, 190, 270);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Este documento sirve como constancia oficial de radicación ante la Alcaldía Municipal.", 105, 275, { align: "center" });
    doc.text("Conserve este número de radicado para realizar seguimiento a su solicitud en el sistema.", 105, 280, { align: "center" });

    // Descargar archivo PDF
    doc.save(`Comprobante_${datosRadicado.numero_radicado}.pdf`);
}