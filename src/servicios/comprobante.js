import { cargarJsPdf } from './cargar-jspdf.js';

const ANCHO_ETIQUETA = 100;
const ALTO_ETIQUETA = 150;
const MARGEN_HORIZONTAL = 6;
const ANCHO_UTIL = ANCHO_ETIQUETA - (MARGEN_HORIZONTAL * 2);
const ANCHO_CODIGO = 70;
const ALTO_CODIGO = 9;
const ANCHO_ESCUDO = 9;
const TAMANO_TITULO = 7.5;
const TAMANO_SUBTITULO = 4.8;
const Y_LINEA_CABECERA = 18;
const LIMITE_CONTENIDO = 137;
const ALTURA_LINEA = 4.4;

// Code 128: cada patrón contiene anchos alternados de barra y espacio.
const PATRONES_CODE128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213',
  '122312', '132212', '221213', '221312', '231212', '112232', '122132',
  '122231', '113222', '123122', '123221', '223211', '221132', '221231',
  '213212', '223112', '312131', '311222', '321122', '321221', '312212',
  '322112', '322211', '212123', '212321', '232121', '111323', '131123',
  '131321', '112313', '132113', '132311', '211313', '231113', '231311',
  '112133', '112331', '132131', '113123', '113321', '133121', '313121',
  '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111',
  '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114',
  '413111', '241112', '134111', '111242', '121142', '121241', '114212',
  '124112', '124211', '411212', '421112', '421211', '212141', '214121',
  '412121', '111143', '111341', '131141', '114113', '114311', '411113',
  '411311', '113141', '114131', '311141', '411131', '211412', '211214',
  '211232', '2331112',
];

function codificarCode128B(valor) {
  const texto = String(valor ?? '');
  const valores = Array.from(texto, (caracter) => {
    const codigo = caracter.charCodeAt(0);
    if (codigo < 32 || codigo > 126) {
      throw new Error('El número de radicado contiene caracteres no compatibles con Code 128.');
    }
    return codigo - 32;
  });
  const simbolos = [104, ...valores];
  const checksum = simbolos.reduce(
    (total, simbolo, indice) => total + (indice === 0 ? simbolo : simbolo * indice),
    0,
  ) % 103;
  simbolos.push(checksum, 106);
  return simbolos.map((simbolo) => PATRONES_CODE128[simbolo]);
}

function dibujarCode128(documentoPdf, valor, x, y, ancho, alto) {
  const patrones = codificarCode128B(valor);
  const zonaSilenciosa = 4;
  const modulos = patrones.reduce(
    (total, patron) => total + Array.from(patron, Number).reduce((subtotal, anchoBarra) => subtotal + anchoBarra, 0),
    0,
  );
  const anchoModulo = (ancho - (zonaSilenciosa * 2)) / modulos;
  let coordenadaX = x + zonaSilenciosa;
  documentoPdf.setFillColor(0, 0, 0);
  for (const patron of patrones) {
    let esBarra = true;
    for (const caracterAncho of patron) {
      const anchoSegmento = Number(caracterAncho) * anchoModulo;
      if (esBarra) documentoPdf.rect(coordenadaX, y, anchoSegmento, alto, 'F');
      coordenadaX += anchoSegmento;
      esBarra = !esBarra;
    }
  }
  return { anchoModulo, modulos, zonaSilenciosa };
}

export async function crearPdfComprobante(datos) {
  const JsPdf = await cargarJsPdf();

  const documentoPdf = new JsPdf({
    unit: 'mm',
    format: [ANCHO_ETIQUETA, ALTO_ETIQUETA],
    orientation: 'portrait',
    compress: true,
  });
  const respuestaEscudo = await fetch(`${import.meta.env.BASE_URL}img/escudo-miranda.png`);
  if (!respuestaEscudo.ok) throw new Error(`No se pudo cargar el escudo institucional (HTTP ${respuestaEscudo.status}).`);
  const escudo = new Uint8Array(await respuestaEscudo.arrayBuffer());
  const dimensiones = documentoPdf.getImageProperties(escudo);

  const dibujarCabecera = (continuacion = false) => {
    const altoEscudo = ANCHO_ESCUDO * dimensiones.height / dimensiones.width;
    documentoPdf.addImage(escudo, 'PNG', MARGEN_HORIZONTAL, 5, ANCHO_ESCUDO, altoEscudo, 'escudo-miranda');
    documentoPdf.setTextColor(0, 0, 0);
    documentoPdf.setFont('helvetica', 'bold');
    documentoPdf.setFontSize(TAMANO_TITULO);
    documentoPdf.text('ALCALDÍA MUNICIPAL', 18, 10);
    documentoPdf.setFont('helvetica', 'normal');
    documentoPdf.setFontSize(TAMANO_SUBTITULO);
    documentoPdf.text('Sistema de Ventanilla Única', 18, 13.2);
    documentoPdf.line(MARGEN_HORIZONTAL, Y_LINEA_CABECERA, ANCHO_ETIQUETA - MARGEN_HORIZONTAL, Y_LINEA_CABECERA);
    if (continuacion) {
      documentoPdf.setFontSize(6.2);
      documentoPdf.text(`Comprobante ${datos.numero_radicado || ''} - continuación`, MARGEN_HORIZONTAL, 23);
    }
  };

  dibujarCabecera();
  documentoPdf.setFillColor(245, 245, 245);
  documentoPdf.rect(MARGEN_HORIZONTAL, 24, ANCHO_UTIL, 24, 'F');
  documentoPdf.setTextColor(0, 0, 0);
  documentoPdf.setFont('helvetica', 'bold');
  documentoPdf.setFontSize(6.6);
  documentoPdf.text('NÚMERO DE RADICADO', MARGEN_HORIZONTAL + 2, 30);
  documentoPdf.setFontSize(9.5);
  documentoPdf.text(String(datos.numero_radicado || ''), MARGEN_HORIZONTAL + 2, 38);
  documentoPdf.setFont('helvetica', 'normal');
  documentoPdf.setFontSize(6.2);
  documentoPdf.text(`Fecha y hora: ${datos.fecha_hora || ''}`, MARGEN_HORIZONTAL + 2, 45);

  const codigoY = 52;
  dibujarCode128(
    documentoPdf,
    String(datos.numero_radicado || ''),
    (ANCHO_ETIQUETA - ANCHO_CODIGO) / 2,
    codigoY,
    ANCHO_CODIGO,
    ALTO_CODIGO,
  );

  let coordenadaY = 67;
  const iniciarPagina = () => {
    documentoPdf.addPage([ANCHO_ETIQUETA, ALTO_ETIQUETA], 'portrait');
    dibujarCabecera(true);
    coordenadaY = 31;
  };
  const asegurarEspacio = (altoNecesario = ALTURA_LINEA) => {
    if (coordenadaY + altoNecesario > LIMITE_CONTENIDO) iniciarPagina();
  };
  const escribir = (texto, opciones = {}) => {
    const { x = MARGEN_HORIZONTAL, ancho = ANCHO_UTIL, tamano = 6.8, interlineado = ALTURA_LINEA } = opciones;
    documentoPdf.setFontSize(tamano);
    for (const linea of documentoPdf.splitTextToSize(String(texto), ancho)) {
      asegurarEspacio(interlineado);
      documentoPdf.text(linea, x, coordenadaY);
      coordenadaY += interlineado;
    }
  };

  const escribirCampo = (etiqueta, valor, opciones = {}) => {
    const {
      x = MARGEN_HORIZONTAL,
      ancho = ANCHO_UTIL,
      tamano = 6.8,
      interlineado = ALTURA_LINEA,
      valorDebajo = false,
    } = opciones;
    const textoEtiqueta = `${etiqueta}:`;
    const textoValor = String(valor ?? '');
    documentoPdf.setFontSize(tamano);
    documentoPdf.setFont('helvetica', 'bold');

    if (valorDebajo) {
      asegurarEspacio(interlineado);
      documentoPdf.text(textoEtiqueta, x, coordenadaY);
      coordenadaY += interlineado;
      documentoPdf.setFont('helvetica', 'normal');
      for (const linea of documentoPdf.splitTextToSize(textoValor, ancho)) {
        asegurarEspacio(interlineado);
        documentoPdf.text(linea, x, coordenadaY);
        coordenadaY += interlineado;
      }
      return;
    }

    const anchoEtiqueta = documentoPdf.getTextWidth(textoEtiqueta);
    const separacion = 1.2;
    const anchoPrimeraLinea = Math.max(20, ancho - anchoEtiqueta - separacion);
    const lineasValor = documentoPdf.splitTextToSize(textoValor, anchoPrimeraLinea);
    asegurarEspacio(interlineado);
    documentoPdf.text(textoEtiqueta, x, coordenadaY);
    documentoPdf.setFont('helvetica', 'normal');
    documentoPdf.text(lineasValor.shift() || '', x + anchoEtiqueta + separacion, coordenadaY);
    coordenadaY += interlineado;
    const xContinuacion = x + anchoEtiqueta + separacion;
    for (const linea of lineasValor) {
      asegurarEspacio(interlineado);
      documentoPdf.text(linea, xContinuacion, coordenadaY);
      coordenadaY += interlineado;
    }
  };

  documentoPdf.setFont('helvetica', 'bold');
  documentoPdf.setFontSize(8);
  documentoPdf.text('DETALLES DEL TRÁMITE', MARGEN_HORIZONTAL, coordenadaY);
  coordenadaY += 6;
  documentoPdf.setFont('helvetica', 'normal');

  if (datos.requiere_respuesta === false || datos.requiere_respuesta === 0) {
    documentoPdf.setFont('helvetica', 'bold');
    escribir('No requiere respuesta');
    documentoPdf.setFont('helvetica', 'normal');
  }

  const camposDetalle = [
    ['Tipo de comunicación', datos.tipo_comunicacion || 'No especificado'],
    ...(datos.tipo_comunicacion === 'Interna'
      ? [['Dependencia remitente', datos.dependencia_remitente || 'No registrada']]
      : datos.tipo_comunicacion === 'Externa' ? [
        ['Tipo de persona', datos.remitente_tipo_persona === 'juridica' ? 'Jurídica' : datos.remitente_tipo_persona === 'natural' ? 'Natural' : 'No registrado'],
        ['Entidad / razón social', datos.remitente_entidad || 'No registrada'],
        ['NIT', datos.remitente_nit || 'No registrado'],
        ['Correo', datos.remitente_email || 'No registrado'],
      ] : []),
    ['Tipo de trámite', datos.tipo_tramite || 'No registrado'],
    ['Número de folios', datos.numero_folios || '1'],
    ['Dependencia destino', datos.dependencia_destino || 'No registrada'],
    ['Funcionario / quién recibe', datos.usuario_recibe || 'No registrado'],
    ['Remitente', `${datos.remitente_nombre || 'No registrado'} (${datos.remitente_documento || 'N/A'})`],
  ];
  camposDetalle.forEach(([etiqueta, valor]) => escribirCampo(etiqueta, valor));
  coordenadaY += 2;
  escribirCampo('Asunto del trámite', datos.asunto_documento || 'Sin asunto registrado', {
    tamano: 7.2,
    valorDebajo: true,
  });

  for (let numeroPagina = 1; numeroPagina <= documentoPdf.getNumberOfPages(); numeroPagina += 1) {
    documentoPdf.setPage(numeroPagina);
    documentoPdf.setFont('helvetica', 'normal');
    documentoPdf.setFontSize(5.2);
    documentoPdf.setTextColor(55, 55, 55);
    documentoPdf.line(MARGEN_HORIZONTAL, 141, ANCHO_ETIQUETA - MARGEN_HORIZONTAL, 141);
    documentoPdf.text('Conserve este número de radicado para seguimiento.', ANCHO_ETIQUETA / 2, 146, { align: 'center' });
  }
  return documentoPdf;
}
