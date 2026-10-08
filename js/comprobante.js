function crearComprobantePDF(datosRadicado) {
    if (!window.jspdf?.jsPDF) {
        throw new Error('No se cargó jsPDF desde js/jspdf.umd.min.js. Comprueba que el archivo exista y que el servidor local lo entregue correctamente.');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ALCALDÍA MUNICIPAL", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Sistema de Ventanilla Única - Comprobante de Recepción Documental", 105, 27, { align: "center" });
    doc.setLineWidth(0.4);
    doc.line(20, 32, 190, 32);

    doc.setFillColor(241, 245, 249);
    doc.rect(20, 38, 170, 24, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Número de Radicado:", 25, 47);
    doc.setTextColor(30, 64, 175);
    doc.text(String(datosRadicado.numero_radicado), 68, 47);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text("Fecha y Hora:", 25, 56);
    doc.setFont("helvetica", "normal");
    doc.text(datosRadicado.fecha_hora, 55, 56);

    let y = 72;
    doc.setFont("helvetica", "bold");
    doc.text("Detalles del Trámite:", 20, y);
    y += 8;
    doc.setFont("helvetica", "normal");

    function escribirTexto(texto, x, ancho) {
        for (const linea of doc.splitTextToSize(texto, ancho)) {
            if (y > 255) {
                doc.addPage();
                y = 20;
            }
            doc.text(linea, x, y);
            y += 7;
        }
    }

    const itemsDetalle = [
        `Tipo de Comunicación: ${datosRadicado.tipo_comunicacion || 'No especificado'}`,
        `Número de Radicado: ${datosRadicado.numero_radicado}`,
        `Número de Folios: ${datosRadicado.numero_folios || '1'}`,
        `Dependencia Destino: ${datosRadicado.dependencia_destino || 'No registrado'}`,
        `Funcionario / Quien Recibe: ${datosRadicado.usuario_recibe || 'Ventanilla Única'}`,
        `Remitente: ${datosRadicado.remitente_nombre || 'No registrado'} (${datosRadicado.remitente_documento || datosRadicado.remitente_nit || 'N/A'})`
    ];
    itemsDetalle.forEach(detalle => escribirTexto(`• ${detalle}`, 24, 166));
    y += 4;
    doc.setFont("helvetica", "bold");
    escribirTexto("Asunto del Trámite:", 20, 170);
    doc.setFont("helvetica", "normal");
    escribirTexto(datosRadicado.asunto_documento || 'Sin asunto registrado', 20, 170);

    for (let pagina = 1; pagina <= doc.getNumberOfPages(); pagina++) {
        doc.setPage(pagina);
        doc.setLineWidth(0.2);
        doc.line(20, 270, 190, 270);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("Este documento sirve como constancia oficial de radicación ante la Alcaldía Municipal.", 105, 275, { align: "center" });
        doc.text("Conserve este número de radicado para realizar seguimiento a su solicitud en el sistema.", 105, 280, { align: "center" });
    }
    return doc;
}

function descargarComprobantePDF(datosRadicado) {
    crearComprobantePDF(datosRadicado).save(`Comprobante_${datosRadicado.numero_radicado}.pdf`);
}
