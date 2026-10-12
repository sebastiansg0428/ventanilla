document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const mensaje = document.getElementById('login-mensaje');
    const boton = document.getElementById('login-submit');
    const textoOriginal = boton.textContent;

    function mostrarMensaje(texto, estado = '') {
        mensaje.textContent = texto;
        if (estado) mensaje.dataset.state = estado;
        else delete mensaje.dataset.state;
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        boton.disabled = true;
        boton.textContent = 'Verificando…';
        mostrarMensaje('Verificando tus credenciales…');
        try {
            const response = await apiFetch('/api/auth/login', {
                autenticado: false,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('email').value.trim(),
                    password: document.getElementById('password').value
                })
            });
            const resultado = await response.json();
            if (resultado.success !== true) {
                throw new Error(resultado.message || 'No se pudo iniciar sesión.');
            }
            AppAuth.guardarSesion(resultado.token, resultado.usuario);
            location.replace(resultado.usuario.rol === 'funcionario' ? 'consultar.html' : 'index.html');
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            mostrarMensaje(error.message, 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = textoOriginal;
        }
    });
});
