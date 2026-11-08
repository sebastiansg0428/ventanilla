let cargaPendiente;

export function cargarJsPdf() {
  if (typeof window.jspdf?.jsPDF === 'function') return Promise.resolve(window.jspdf.jsPDF);
  if (cargaPendiente) return cargaPendiente;

  const script = document.createElement('script');
  script.src = `${import.meta.env.BASE_URL}vendor/jspdf.umd.min.js`;
  script.async = true;
  const carga = new Promise((resolve, reject) => {
    const terminar = error => {
      clearTimeout(limite);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else resolve(window.jspdf.jsPDF);
    };
    const limite = setTimeout(() => terminar(new Error(
      'La carga de jsPDF tardó demasiado. Reintenta la descarga del comprobante.',
    )), 15000);
    script.onload = () => terminar(typeof window.jspdf?.jsPDF === 'function' ? null
      : new Error('El archivo local de jsPDF no proporcionó un generador válido.'));
    script.onerror = () => terminar(new Error(
      'No se pudo cargar jsPDF desde el archivo local. Reintenta la descarga del comprobante.',
    ));
    try {
      document.head.appendChild(script);
    } catch (error) {
      terminar(error);
    }
  });
  cargaPendiente = carga;
  void carga.then(() => {
    if (cargaPendiente === carga) cargaPendiente = undefined;
  }, () => {
    if (cargaPendiente === carga) cargaPendiente = undefined;
  });
  return carga;
}
