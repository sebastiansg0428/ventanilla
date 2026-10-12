const AppAuth = (() => {
    const apiBase = 'http://localhost:3000';
    const sessionKey = 'ventanilla.sesion';

    function obtenerSesion() {
        const guardada = sessionStorage.getItem(sessionKey);
        if (!guardada) return null;
        try {
            const sesion = JSON.parse(guardada);
            if (typeof sesion.token !== 'string' || !sesion.token || !sesion.usuario) {
                throw new Error('La sesion guardada no es valida.');
            }
            return sesion;
        } catch (error) {
            console.error('Error al leer la sesion:', error);
            sessionStorage.removeItem(sessionKey);
            return null;
        }
    }

    function guardarSesion(token, usuario) {
        if (typeof token !== 'string' || !token || !usuario || typeof usuario !== 'object' || Array.isArray(usuario)) {
            throw new Error('El servidor no devolvio una sesion valida.');
        }
        sessionStorage.setItem(sessionKey, JSON.stringify({ token, usuario }));
    }

    function cerrarSesionLocal() {
        sessionStorage.removeItem(sessionKey);
        location.replace('login.html');
    }

    async function apiFetch(ruta, opciones = {}) {
        const { autenticado = true, ...init } = opciones;
        const url = new URL(ruta, apiBase);
        if (url.origin !== apiBase) {
            throw new Error('La solicitud no pertenece al servidor de la aplicacion.');
        }
        const headers = new Headers(init.headers);
        if (autenticado) {
            const sesion = obtenerSesion();
            if (!sesion) {
                cerrarSesionLocal();
                throw new Error('Inicia sesion para continuar.');
            }
            headers.set('Authorization', `Bearer ${sesion.token}`);
        }
        let response;
        try {
            response = await fetch(url.href, { ...init, headers });
        } catch (error) {
            throw new Error(`No se pudo conectar con el servidor. ${error.message}`);
        }
        if (response.status === 401 && autenticado) {
            cerrarSesionLocal();
            throw new Error('Tu sesion ha expirado. Inicia sesion nuevamente.');
        }
        const esJSON = response.headers.get('content-type')?.includes('application/json');
        const resultado = esJSON && init.method !== 'HEAD' ? await response.clone().json() : null;
        if (!response.ok || resultado?.success === false) {
            const error = new Error(resultado?.message || `El servidor rechazo la solicitud (HTTP ${response.status}).`);
            error.status = response.status;
            throw error;
        }
        return response;
    }

    function aplicarPresentacion(usuario) {
        document.querySelectorAll('[data-accion="radicar"]').forEach(elemento => {
            elemento.hidden = usuario.rol === 'funcionario';
        });
        document.querySelectorAll('[data-rol="administrador"]').forEach(elemento => {
            elemento.hidden = usuario.rol !== 'administrador';
        });
        document.querySelectorAll('[data-cerrar-sesion]').forEach(boton => {
            boton.addEventListener('click', async () => {
                boton.disabled = true;
                try {
                    await apiFetch('/api/auth/logout', { method: 'POST' });
                    cerrarSesionLocal();
                } catch (error) {
                    console.error('Error al cerrar sesion:', error);
                    alert(error.message);
                    boton.disabled = false;
                }
            });
        });
    }

    async function confirmarSesion({ recepcion = false } = {}) {
        try {
            const response = await apiFetch('/api/auth/me');
            const resultado = await response.json();
            const sesion = obtenerSesion();
            guardarSesion(sesion.token, resultado.usuario);
            if (recepcion && resultado.usuario.rol === 'funcionario') {
                location.replace('consultar.html');
                return null;
            }
            aplicarPresentacion(resultado.usuario);
            document.body.removeAttribute('data-sesion-pendiente');
            document.getElementById('sesion-estado').hidden = true;
            return resultado.usuario;
        } catch (error) {
            console.error('Error al confirmar sesion:', error);
            document.getElementById('sesion-estado').textContent =
                `${error.message} Recarga la pagina para reintentar.`;
            return null;
        }
    }

    return { apiFetch, guardarSesion, confirmarSesion };
})();

const apiFetch = AppAuth.apiFetch;
