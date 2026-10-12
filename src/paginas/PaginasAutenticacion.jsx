import { useEffect, useState } from "react";
import {
  solicitarApi,
  guardarSesion,
  limpiarSesion,
} from "../servicios/api";
import {
  MarcaInstitucional,
  ProteccionSesion,
  MensajeEstado,
  EncabezadoAplicacion,
  PiePagina,
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
      {(usuario) => <GestionUsuarios usuario={usuario} />}
    </ProteccionSesion>
  );
}

const FORMULARIO_VACIO = {
  nombre: "",
  email: "",
  password: "",
  rol: "",
  dependencia_id: "",
};

function GestionUsuarios({ usuario }) {
  const [usuarios, setUsuarios] = useState([]);
  const [dependencias, setDependencias] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [usuarioEnEdicion, setUsuarioEnEdicion] = useState(null);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [enProceso, setEnProceso] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tono: "" });

  async function cargarUsuarios() {
    setCargandoUsuarios(true);
    try {
      const respuesta = await solicitarApi("/api/usuarios");
      const resultado = await respuesta.json();
      if (!Array.isArray(resultado.usuarios)) {
        throw new Error("La respuesta de usuarios no tiene el formato esperado.");
      }
      setUsuarios(resultado.usuarios);
      return true;
    } catch (error) {
      setMensaje({ texto: error.message, tono: "error" });
      return false;
    } finally {
      setCargandoUsuarios(false);
    }
  }

  async function cargarDependencias() {
    try {
      const respuesta = await solicitarApi("/api/dependencias");
      const resultado = await respuesta.json();
      if (!Array.isArray(resultado.dependencias)) {
        throw new Error(
          "La respuesta de dependencias no tiene el formato esperado.",
        );
      }
      setDependencias(resultado.dependencias);
    } catch (error) {
      setMensaje({ texto: error.message, tono: "error" });
    }
  }

  useEffect(() => {
    cargarUsuarios();
    cargarDependencias();
  }, []);

  function actualizarCampo(evento) {
    const { name, value } = evento.target;
    setFormulario((actual) => ({
      ...actual,
      [name]: value,
      ...(name === "rol" && value !== "funcionario"
        ? { dependencia_id: "" }
        : {}),
    }));
  }

  function cancelarEdicion() {
    setUsuarioEnEdicion(null);
    setFormulario(FORMULARIO_VACIO);
    setMensaje({ texto: "", tono: "" });
  }

  async function editarUsuario(id) {
    setMensaje({ texto: "Cargando los datos del usuario…", tono: "" });
    try {
      const respuesta = await solicitarApi(`/api/usuarios/${id}`);
      const resultado = await respuesta.json();
      if (!resultado.usuario) {
        throw new Error("La respuesta no incluye los datos del usuario.");
      }
      const usuarioEditado = resultado.usuario;
      setUsuarioEnEdicion(usuarioEditado);
      setFormulario({
        nombre: usuarioEditado.nombre || "",
        email: usuarioEditado.email || "",
        password: "",
        rol: usuarioEditado.rol || "",
        dependencia_id: usuarioEditado.dependencia_id
          ? String(usuarioEditado.dependencia_id)
          : "",
      });
      setMensaje({ texto: "", tono: "" });
    } catch (error) {
      if (error.status === 404) await cargarUsuarios();
      if (error.status === 422) await cargarDependencias();
      setMensaje({ texto: error.message, tono: "error" });
    }
  }

  async function enviarFormulario(evento) {
    evento.preventDefault();
    setEnProceso(true);
    setMensaje({
      texto: usuarioEnEdicion
        ? "Guardando los cambios del usuario…"
        : "Creando el usuario…",
      tono: "",
    });

    const datos = {
      nombre: formulario.nombre.trim(),
      email: formulario.email.trim(),
      rol: formulario.rol,
      dependencia_id:
        formulario.rol === "funcionario"
          ? Number(formulario.dependencia_id)
          : null,
    };
    if (!usuarioEnEdicion || formulario.password !== "") {
      datos.password = formulario.password;
    }

    try {
      const respuesta = await solicitarApi(
        usuarioEnEdicion
          ? `/api/usuarios/${usuarioEnEdicion.id}`
          : "/api/usuarios",
        {
          method: usuarioEnEdicion ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(datos),
        },
      );
      const resultado = await respuesta.json();
      const usuarioActualizadoEsPropio =
        usuarioEnEdicion &&
        String(usuarioEnEdicion.id) === String(usuario.id);

      if (usuarioActualizadoEsPropio) {
        limpiarSesion();
        window.location.replace("login.html");
        return;
      }

      if (!usuarioEnEdicion) {
        setFormulario(FORMULARIO_VACIO);
      } else {
        setUsuarioEnEdicion(null);
        setFormulario(FORMULARIO_VACIO);
      }
      setMensaje({
        texto:
          resultado.message ||
          (usuarioEnEdicion
            ? "Usuario actualizado con éxito."
            : "Usuario registrado con éxito."),
        tono: "success",
      });
      await cargarUsuarios();
    } catch (error) {
      if (error.status === 404) await cargarUsuarios();
      if (error.status === 422) await cargarDependencias();
      setMensaje({ texto: error.message, tono: "error" });
    } finally {
      setEnProceso(false);
    }
  }

  async function cambiarEstadoUsuario(usuarioObjetivo) {
    const activoNuevo = usuarioObjetivo.activo === 1 ? 0 : 1;
    const accion = activoNuevo === 1 ? "activar" : "inactivar";
    if (
      !window.confirm(
        `¿Deseas ${accion} la cuenta de ${usuarioObjetivo.nombre}?`,
      )
    ) {
      return;
    }

    setEnProceso(true);
    setMensaje({ texto: "", tono: "" });
    try {
      const respuesta = await solicitarApi(
        `/api/usuarios/${usuarioObjetivo.id}/estado`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo: activoNuevo }),
        },
      );
      const resultado = await respuesta.json();
      setMensaje({
        texto:
          resultado.message ||
          `La cuenta de ${usuarioObjetivo.nombre} se ${accion} correctamente.`,
        tono: "success",
      });
      await cargarUsuarios();
    } catch (error) {
      if (error.status === 404) await cargarUsuarios();
      if (error.status === 422) await cargarDependencias();
      setMensaje({ texto: error.message, tono: "error" });
    } finally {
      setEnProceso(false);
    }
  }

  const esFuncionario = formulario.rol === "funcionario";

  return (
    <div className="app-page">
      <EncabezadoAplicacion usuario={usuario} pantallaActual="usuarios" />
      <main className="users-management-main">
        <section
          className="auth-card users-management-card"
          aria-labelledby="register-title"
        >
          <div className="auth-heading">
            <p className="auth-eyebrow">Administración de acceso</p>
            <h1 id="register-title">Gestión de usuarios</h1>
            <p>Crea, edita, activa e inactiva cuentas del sistema.</p>
          </div>
          <form
            className="auth-form auth-form--grid"
            onSubmit={enviarFormulario}
          >
            <h2 className="auth-field--full">
              {usuarioEnEdicion ? "Editar usuario" : "Registrar usuario"}
            </h2>
            <div className="auth-field auth-field--full">
              <label htmlFor="nombre">Nombre completo *</label>
              <input
                id="nombre"
                name="nombre"
                value={formulario.nombre}
                onChange={actualizarCampo}
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
                value={formulario.email}
                onChange={actualizarCampo}
                autoComplete="email"
                maxLength="254"
                required
              />
            </div>
            <div className="auth-field auth-field--full">
              <label htmlFor="register-password">
                Contraseña {usuarioEnEdicion ? "(opcional)" : "*"}
              </label>
              <input
                id="register-password"
                name="password"
                type="password"
                value={formulario.password}
                onChange={actualizarCampo}
                autoComplete="new-password"
                minLength={formulario.password ? 10 : undefined}
                maxLength="128"
                required={!usuarioEnEdicion}
                placeholder={
                  usuarioEnEdicion
                    ? "Déjalo vacío para conservar la contraseña"
                    : ""
                }
              />
              {!usuarioEnEdicion && (
                <small>Debe tener entre 10 y 128 caracteres.</small>
              )}
            </div>
            <div className="auth-field auth-field--full">
              <label htmlFor="rol">Rol en el sistema *</label>
              <select
                id="rol"
                name="rol"
                value={formulario.rol}
                onChange={actualizarCampo}
                required
              >
                <option value="">Selecciona un rol</option>
                <option value="administrador">Administrador</option>
                <option value="ventanilla">Ventanilla Única</option>
                <option value="funcionario">Funcionario de dependencia</option>
              </select>
            </div>
            <div className="auth-field auth-field--full">
              <label htmlFor="dependencia_id">Dependencia asignada</label>
              <select
                id="dependencia_id"
                name="dependencia_id"
                value={formulario.dependencia_id}
                onChange={actualizarCampo}
                disabled={!esFuncionario}
                required={esFuncionario}
              >
                <option value="">Selecciona la dependencia</option>
                {dependencias.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="auth-field auth-field--full">
              <button
                className="auth-submit"
                type="submit"
                disabled={enProceso}
              >
                {enProceso
                  ? "Guardando…"
                  : usuarioEnEdicion
                    ? "Guardar cambios"
                    : "Registrar usuario"}
              </button>
              {usuarioEnEdicion && (
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  disabled={enProceso}
                >
                  Cancelar edición
                </button>
              )}
            </div>
            <MensajeEstado tono={mensaje.tono}>{mensaje.texto}</MensajeEstado>
          </form>

          <section
            className="users-table-section"
            aria-labelledby="usuarios-titulo"
          >
            <div className="users-table-toolbar">
              <h2 id="usuarios-titulo">Usuarios registrados en el sistema</h2>
              <button
                type="button"
                onClick={cargarUsuarios}
                disabled={cargandoUsuarios || enProceso}
              >
                Actualizar lista
              </button>
            </div>
            <div className="table-card users-table-card">
              <div className="table-scroll users-table-scroll">
                <table id="tabla-usuarios">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Dependencia</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargandoUsuarios ? (
                    <tr>
                      <td colSpan="6">Cargando usuarios…</td>
                    </tr>
                  ) : usuarios.length === 0 ? (
                    <tr>
                      <td colSpan="6">No hay usuarios para mostrar.</td>
                    </tr>
                  ) : (
                    usuarios.map((usuarioFila) => {
                      const estaActivo = usuarioFila.activo === 1;
                      const esSesionActual =
                        String(usuarioFila.id) === String(usuario.id);
                      const dependencia = dependencias.find(
                        (dep) =>
                          String(dep.id) ===
                          String(usuarioFila.dependencia_id),
                      );
                      return (
                        <tr key={usuarioFila.id}>
                          <td>{usuarioFila.nombre}</td>
                          <td>{usuarioFila.email}</td>
                          <td>{usuarioFila.rol}</td>
                          <td>{dependencia?.nombre || "—"}</td>
                          <td>{estaActivo ? "Activo" : "Inactivo"}</td>
                          <td>
                            <div className="users-table-actions">
                              <button
                                type="button"
                                onClick={() => editarUsuario(usuarioFila.id)}
                                disabled={enProceso}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  cambiarEstadoUsuario(usuarioFila)
                                }
                                disabled={
                                  enProceso ||
                                  (esSesionActual &&
                                    usuarioFila.rol === "administrador" &&
                                    estaActivo)
                                }
                              >
                                {estaActivo ? "Inactivar" : "Activar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </section>
          <p className="auth-switch">
            <a href="index.html">Volver al sistema</a>
          </p>
        </section>
      </main>
      <PiePagina />
    </div>
  );
}
