import { useEffect, useState } from "react";
import { solicitarApi, guardarSesion } from "../servicios/api";
import {
  MarcaInstitucional,
  ProteccionSesion,
  MensajeEstado,
} from "../componentes/Compartidos";

export function PaginaInicioSesion() {
  const [enProceso, setEnProceso] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tono: "" });

  async function enviarFormulario(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datosFormulario = new FormData(formulario);
    setEnProceso(true);
    setMensaje({ texto: "Verificando tus credenciales…", tono: "" });
    try {
      const respuesta = await solicitarApi("/api/auth/login", {
        requiereSesion: false,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(datosFormulario.get("email")).trim(),
          password: datosFormulario.get("password"),
        }),
      });
      const resultado = await respuesta.json();
      guardarSesion(resultado.token, resultado.usuario);
      window.location.replace(
        resultado.usuario.rol === "funcionario"
          ? "consultar.html"
          : "index.html",
      );
    } catch (error) {
      setMensaje({ texto: error.message, tono: "error" });
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <MarcaInstitucional />
        <div className="auth-heading">
          <p className="auth-eyebrow">Sistema de gestión documental</p>
          <h1 id="login-title">Bienvenido de nuevo</h1>
          <p>Inicia sesión con tu cuenta institucional para continuar.</p>
        </div>
        <form className="auth-form" onSubmit={enviarFormulario}>
          <div className="auth-field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              maxLength="254"
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength="128"
              required
            />
          </div>
          <button className="auth-submit" type="submit" disabled={enProceso}>
            {enProceso ? "Verificando…" : "Iniciar sesión"}
          </button>
          <MensajeEstado tono={mensaje.tono}>{mensaje.texto}</MensajeEstado>
        </form>
        <p className="auth-footnote">
          Acceso para personal autorizado. El alta de usuarios debe realizarla
          un administrador.
        </p>
      </section>
    </main>
  );
}

export function PaginaRegistroUsuarios() {
  return (
    <ProteccionSesion soloAdministrador>
      {(usuario) => <FormularioRegistroUsuario usuario={usuario} />}
    </ProteccionSesion>
  );
}

function FormularioRegistroUsuario() {
  const [rolSeleccionado, setRolSeleccionado] = useState("");
  const [dependencias, setDependencias] = useState([]);
  const [enProceso, setEnProceso] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tono: "" });

  useEffect(() => {
    if (rolSeleccionado !== "funcionario") return;
    let vigente = true;
    solicitarApi("/api/dependencias")
      .then((respuesta) => respuesta.json())
      .then((resultado) => {
        if (vigente) setDependencias(resultado.dependencias || []);
      })
      .catch((error) => {
        if (vigente) setMensaje({ texto: error.message, tono: "error" });
      });
    return () => {
      vigente = false;
    };
  }, [rolSeleccionado]);

  async function enviarFormulario(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datosFormulario = new FormData(formulario);
    setEnProceso(true);
    setMensaje({ texto: "Guardando los datos del usuario…", tono: "" });
    try {
      const respuesta = await solicitarApi("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: String(datosFormulario.get("nombre")).trim(),
          email: String(datosFormulario.get("email")).trim(),
          password: datosFormulario.get("password"),
          rol: datosFormulario.get("rol"),
          dependencia_id: datosFormulario.get("dependencia_id")
            ? Number(datosFormulario.get("dependencia_id"))
            : null,
        }),
      });
      await respuesta.json();
      formulario.reset();
      setRolSeleccionado("");
      setMensaje({ texto: "Usuario registrado con éxito.", tono: "success" });
    } catch (error) {
      setMensaje({ texto: error.message, tono: "error" });
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <main className="auth-shell auth-shell--wide">
      <section className="auth-card" aria-labelledby="register-title">
        <MarcaInstitucional />
        <div className="auth-heading">
          <p className="auth-eyebrow">Administración de acceso</p>
          <h1 id="register-title">Registrar usuario</h1>
          <p>Completa los datos para crear una cuenta en el sistema.</p>
        </div>
        <form className="auth-form auth-form--grid" onSubmit={enviarFormulario}>
          <div className="auth-field auth-field--full">
            <label htmlFor="nombre">Nombre completo *</label>
            <input
              id="nombre"
              name="nombre"
              autoComplete="name"
              maxLength="150"
              required
            />
          </div>
          <div className="auth-field auth-field--full">
            <label htmlFor="register-email">Correo electrónico *</label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength="254"
              required
            />
          </div>
          <div className="auth-field auth-field--full">
            <label htmlFor="register-password">Contraseña *</label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength="10"
              maxLength="128"
              required
            />
            <small>Debe tener entre 10 y 128 caracteres.</small>
          </div>
          <div className="auth-field auth-field--full">
            <label htmlFor="rol">Rol en el sistema *</label>
            <select
              id="rol"
              name="rol"
              value={rolSeleccionado}
              onChange={(evento) => setRolSeleccionado(evento.target.value)}
              required
            >
              <option value="">Selecciona un rol</option>
              <option value="administrador">Administrador</option>
              <option value="ventanilla">Ventanilla Única</option>
              <option value="funcionario">Funcionario de dependencia</option>
            </select>
          </div>
          {rolSeleccionado === "funcionario" && (
            <div className="auth-field auth-field--full">
              <label htmlFor="dependencia_id">Dependencia asignada *</label>
              <select id="dependencia_id" name="dependencia_id" required>
                <option value="">Selecciona la dependencia</option>
                {dependencias.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            className="auth-submit auth-field--full"
            type="submit"
            disabled={enProceso}
          >
            {enProceso ? "Registrando…" : "Registrar usuario"}
          </button>
          <MensajeEstado tono={mensaje.tono}>{mensaje.texto}</MensajeEstado>
        </form>
        <p className="auth-switch">
          <a href="index.html">Volver al sistema</a>
        </p>
      </section>
    </main>
  );
}
