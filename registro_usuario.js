document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-registro-usuario');
    const selectorRol = document.getElementById('rol');
    const contenedorDependencia = document.getElementById('contenedor-dependencia');
    const selectDependencia = document.getElementById('dependencia_id');
    const mensaje = document.getElementById('registro-mensaje');
    const boton = document.getElementById('registro-submit');
    const textoOriginal = boton.textContent;
    let solicitudDependencias = null;

    AppAuth.confirmarSesion().then(usuario => {
        if (!usuario || usuario.rol === 'administrador') return;
        form.hidden = true;
        mostrarMensaje('Solo un administrador puede registrar usuarios. Inicia sesión con una cuenta administradora.', 'error');
    });

    function mostrarMensaje(texto, estado = '') {
        mensaje.textContent = texto;
        if (estado) mensaje.dataset.state = estado;
        else delete mensaje.dataset.state;
    }

    async function cargarDependenciasSelect() {
        if (solicitudDependencias) return solicitudDependencias;

        solicitudDependencias = (async () => {
            selectDependencia.disabled = true;
            selectDependencia.replaceChildren(new Option('Cargando dependencias…', ''));
            try {
                const response = await AppAuth.apiFetch('/api/dependencias');
                const dependencias = await response.json();
                if (dependencias.success !== true || !Array.isArray(dependencias.dependencias)) {
                    throw new Error('La respuesta de dependencias no tiene el formato esperado.');
                }

                selectDependencia.replaceChildren(new Option('Selecciona una dependencia', ''));
                dependencias.dependencias.forEach(dependencia => {
                    selectDependencia.add(new Option(dependencia.nombre, dependencia.id));
                });
                selectDependencia.disabled = dependencias.dependencias.length === 0;
                if (dependencias.dependencias.length === 0) {
                    selectDependencia.replaceChildren(new Option('No hay dependencias disponibles', ''));
                    mostrarMensaje('No hay dependencias disponibles para asignar. Intenta más tarde o consulta al administrador.', 'error');
                }
            } catch (error) {
                console.error('Error al cargar dependencias:', error);
                selectDependencia.replaceChildren(new Option('No se pudieron cargar las dependencias', ''));
                selectDependencia.disabled = true;
                mostrarMensaje('No se pudieron cargar las dependencias. Comprueba que el servidor esté disponible y vuelve a seleccionar el rol.', 'error');
            } finally {
                solicitudDependencias = null;
            }
        })();
        return solicitudDependencias;
    }

    function toggleDependencia(rolSeleccionado) {
        const esFuncionario = rolSeleccionado === 'funcionario';
        contenedorDependencia.hidden = !esFuncionario;
        selectDependencia.required = esFuncionario;
        if (esFuncionario) {
            cargarDependenciasSelect();
        } else {
            selectDependencia.value = '';
            selectDependencia.disabled = true;
        }
    }

    selectorRol.addEventListener('change', () => {
        mostrarMensaje();
        toggleDependencia(selectorRol.value);
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (selectorRol.value === 'funcionario' && (selectDependencia.disabled || !selectDependencia.value)) {
            mostrarMensaje('Selecciona una dependencia disponible antes de registrar el usuario.', 'error');
            return;
        }
        const formData = new FormData(form);
        const datosUsuario = {
            nombre: formData.get('nombre').trim(),
            email: formData.get('email').trim(),
            password: formData.get('password'),
            rol: formData.get('rol'),
            dependencia_id: formData.get('dependencia_id') ? Number.parseInt(formData.get('dependencia_id'), 10) : null
        };

        boton.disabled = true;
        boton.textContent = 'Registrando…';
        mostrarMensaje('Guardando los datos del usuario…');
        try {
            const response = await AppAuth.apiFetch('/api/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosUsuario)
            });
            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                throw new Error(resultado.error || resultado.message || 'No se pudo registrar el usuario.');
            }

            form.reset();
            toggleDependencia('');
            mostrarMensaje('Usuario registrado con éxito. Ya puedes iniciar sesión.', 'success');
        } catch (error) {
            console.error('Error al registrar usuario:', error);
            mostrarMensaje(error.message === 'Failed to fetch'
                ? 'No se pudo conectar con el servidor. Comprueba que esté encendido e intenta de nuevo.'
                : error.message, 'error');
        } finally {
            boton.disabled = false;
            boton.textContent = textoOriginal;
        }
    });
});
