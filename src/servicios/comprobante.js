// Usa la copia UMD local que se carga en las páginas que generan comprobantes.
export function crearPdfComprobante(datos) {
  const JsPdf = window.jspdf?.jsPDF;
  if (!JsPdf) throw new Error('No se cargó jsPDF desde el archivo local.');

  const documentoPdf = new JsPdf();
  documentoPdf.setFont('helvetica', 'bold');
  documentoPdf.setFontSize(16);
  documentoPdf.text('ALCALDÍA MUNICIPAL', 105, 20, { align: 'center' });
  documentoPdf.setFont('helvetica', 'normal');
  documentoPdf.setFontSize(10);
  documentoPdf.text('Sistema de Ventanilla Única - Comprobante de Recepción Documental', 105, 27, { align: 'center' });
  documentoPdf.line(20, 32, 190, 32);
  documentoPdf.setFillColor(241, 245, 249);
  documentoPdf.rect(20, 38, 170, 24, 'F');
  documentoPdf.setFont('helvetica', 'bold');
  documentoPdf.text('Número de Radicado:', 25, 47);
  documentoPdf.setTextColor(30, 64, 175);
  documentoPdf.text(String(datos.numero_radicado || ''), 68, 47);
  documentoPdf.setTextColor(0, 0, 0);
  documentoPdf.setFont('helvetica', 'normal');
  documentoPdf.text(`Fecha y Hora: ${datos.fecha_hora || ''}`, 25, 56);

  let coordenadaY = 74;
  documentoPdf.setFont('helvetica', 'bold');
  documentoPdf.text('Detalles del Trámite:', 20, coordenadaY);
  coordenadaY += 9;
  documentoPdf.setFont('helvetica', 'normal');
  const lineasDetalle = [
    ...(datos.requiere_respuesta === false || datos.requiere_respuesta === 0
      ? ['No requiere respuesta'] : []),
    `Tipo de Comunicación: ${datos.tipo_comunicacion || 'No especificado'}`,
    ...(datos.tipo_comunicacion === 'Interna'
      ? [`Dependencia Remitente: ${datos.dependencia_remitente || 'No registrada'}`]
      : datos.tipo_comunicacion === 'Externa' ? [
        `Tipo de Persona: ${datos.remitente_tipo_persona === 'juridica' ? 'Jurídica' : datos.remitente_tipo_persona === 'natural' ? 'Natural' : 'No registrado'}`,
        `Entidad / Razón Social: ${datos.remitente_entidad || 'No registrada'}`,
        `NIT: ${datos.remitente_nit || 'No registrado'}`,
        `Correo: ${datos.remitente_email || 'No registrado'}`,
      ] : []),
    `Tipo de Trámite: ${datos.tipo_tramite || 'No registrado'}`,
    `Número de Radicado: ${datos.numero_radicado || ''}`,
    `Número de Folios: ${datos.numero_folios || '1'}`,
    `Dependencia Destino: ${datos.dependencia_destino || 'No registrada'}`,
    `Funcionario / Quién Recibe: ${datos.usuario_recibe || 'No registrado'}`,
    `Remitente: ${datos.remitente_nombre || 'No registrado'} (${datos.remitente_documento || 'N/A'})`,
  ];
  const escribir = (texto, x = 24, ancho = 166) => {
    for (const linea of documentoPdf.splitTextToSize(texto, ancho)) {
      if (coordenadaY > 255) { documentoPdf.addPage(); coordenadaY = 20; }
      documentoPdf.text(linea, x, coordenadaY);
      coordenadaY += 7;
    }
  };
  lineasDetalle.forEach(linea => escribir(`• ${linea}`));
  coordenadaY += 4;
  documentoPdf.setFont('helvetica', 'bold');
  escribir('Asunto del Trámite:', 20, 170);
  documentoPdf.setFont('helvetica', 'normal');
  escribir(datos.asunto_documento || 'Sin asunto registrado', 20, 170);

  for (let numeroPagina = 1; numeroPagina <= documentoPdf.getNumberOfPages(); numeroPagina += 1) {
    documentoPdf.setPage(numeroPagina);
    documentoPdf.setFontSize(8);
    documentoPdf.setTextColor(100, 100, 100);
    documentoPdf.line(20, 270, 190, 270);
    documentoPdf.text('Conserve este número de radicado para realizar seguimiento a su solicitud.', 105, 277, { align: 'center' });
  }
  return documentoPdf;
}
