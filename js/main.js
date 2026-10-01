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
                alert(`¡Radicado exitoso!\nNúmero asignado: ${resultado.radicado}`);

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