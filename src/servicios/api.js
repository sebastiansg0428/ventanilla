const URL_BASE_API = 'http://localhost:3000';
const CLAVE_SESION = 'ventanilla.sesion';

export function obtenerSesion() {
  try {
    const valorGuardado = sessionStorage.getItem(CLAVE_SESION);
    if (!valorGuardado) return null;
    const sesion = JSON.parse(valorGuardado);
    return sesion?.token && sesion?.usuario ? sesion : null;
  } catch {
    sessionStorage.removeItem(CLAVE_SESION);
    return null;
  }
}

export function guardarSesion(token, usuario) {
  if (!token || !usuario || typeof usuario !== 'object') {
    throw new Error('El servidor no devolvió una sesión válida.');
  }
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ token, usuario }));
}

export function limpiarSesion() {
  sessionStorage.removeItem(CLAVE_SESION);
}

// Centralizar las peticiones mantiene un solo lugar para adjuntar el token y tratar errores.
export async function solicitarApi(ruta, opciones = {}) {
  const { requiereSesion = true, ...opcionesSolicitud } = opciones;
  const direccionSolicitud = new URL(ruta, URL_BASE_API);
  if (direccionSolicitud.origin !== URL_BASE_API) throw new Error('La solicitud no pertenece al servidor de la aplicación.');

  const encabezados = new Headers(opcionesSolicitud.headers);
  if (requiereSesion) {
    const sesion = obtenerSesion();
    if (!sesion) {
      window.location.replace('login.html');
      throw new Error('Inicia sesión para continuar.');
    }
    encabezados.set('Authorization', `Bearer ${sesion.token}`);
  }

  let respuesta;
  try {
    respuesta = await fetch(direccionSolicitud, { ...opcionesSolicitud, headers: encabezados });
  } catch (error) {
    throw new Error(`No se pudo conectar con el servidor. ${error.message}`);
  }

  const tipoContenido = respuesta.headers.get('content-type') || '';
  const resultado = tipoContenido.includes('application/json') ? await respuesta.clone().json() : null;
  if (respuesta.status === 401 && requiereSesion) {
    limpiarSesion();
    window.location.replace('login.html');
  }
  if (!respuesta.ok || resultado?.success === false) {
    throw new Error(resultado?.message || `El servidor rechazó la solicitud (HTTP ${respuesta.status}).`);
  }
  return respuesta;
}

export async function confirmarSesion() {
  const respuesta = await solicitarApi('/api/auth/me');
  const resultado = await respuesta.json();
  const sesionActual = obtenerSesion();
  guardarSesion(sesionActual.token, resultado.usuario);
  return resultado.usuario;
}
