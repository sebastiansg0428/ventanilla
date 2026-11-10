import { useEffect, useRef, useState } from "react";
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
  CeldaAdaptable,
} from "../componentes/Compartidos";
import { contrasenaValida, POLITICA_CONTRASENA } from "../servicios/contrasenas";

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

const ROLES_USUARIOS = {
  administrador: "Administrador",
  ventanilla: "Ventanilla Única",
  funcionario: "Funcionario de dependencia",
};

function CamposUsuario({ formulario, dependencias, actualizarCampo, edicion = false }) {
  const prefijo = edicion ? "editar-" : "";
  const esFuncionario = formulario.rol === "funcionario";
  return (
    <>
      <div className="auth-field">
        <label htmlFor={`${prefijo}nombre`}>Nombre completo *</label>
        <input id={`${prefijo}nombre`} name="nombre" value={formulario.nombre}
          onChange={actualizarCampo} autoComplete="name" maxLength="150" required />
      </div>
      <div className="auth-field">
        <label htmlFor={`${prefijo}register-email`}>Correo electrónico *</label>
        <input id={`${prefijo}register-email`} name="email" type="email" value={formulario.email}
          onChange={actualizarCampo} autoComplete="email" maxLength="254" required />
      </div>
      <div className="auth-field">
        <label htmlFor={`${prefijo}rol`}>Rol en el sistema *</label>
        <select id={`${prefijo}rol`} name="rol" value={formulario.rol} onChange={actualizarCampo} required>
          <option value="">Selecciona un rol</option>
          {Object.entries(ROLES_USUARIOS).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
      </div>
      <div className="auth-field">
        <label htmlFor={`${prefijo}dependencia_id`}>Dependencia asignada</label>
        <select id={`${prefijo}dependencia_id`} name="dependencia_id" value={formulario.dependencia_id}
          onChange={actualizarCampo} disabled={!esFuncionario} required={esFuncionario}>
          <option value="">Selecciona la dependencia</option>
          {dependencias.map(dep => <option key={dep.id} value={dep.id}>{dep.nombre}</option>)}
        </select>
      </div>
      <div className="auth-field auth-field--full">
        <label htmlFor={`${prefijo}register-password`}>Contraseña {edicion ? "(opcional)" : "*"}</label>
        <input id={`${prefijo}register-password`} name="password" type="password" value={formulario.password}
          onChange={actualizarCampo} autoComplete="new-password" minLength={formulario.password ? 10 : undefined}
          maxLength="72" aria-describedby={`${prefijo}politica-contrasena`}
          aria-invalid={formulario.password !== "" && !contrasenaValida(formulario.password)}
          required={!edicion} placeholder={edicion ? "Déjalo vacío para conservar la contraseña" : ""} />
        <small id={`${prefijo}politica-contrasena`}>{POLITICA_CONTRASENA}</small>
      </div>
    </>
  );
}

function DrawerEdicionUsuario({ id, usuario, dependencias, cargarUsuarios, cargarDependencias, alCerrar, alGuardar }) {
  const dialogo = useRef(null);
  const titulo = useRef(null);
  const ocupado = useRef(false);
  const vigente = useRef(false);
  const [formulario, setFormulario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tono: "" });

  useEffect(() => {
    const panel = dialogo.current;
    const origen = document.activeElement;
    const overflow = document.body.style.overflow;
    vigente.current = true;
    document.body.style.overflow = "hidden";
    panel.showModal();
    titulo.current.focus({ preventScroll: true });
    return () => {
      vigente.current = false;
      panel.close();
      document.body.style.overflow = overflow;
      const destino = origen?.isConnected ? origen
        : document.querySelector(`[data-editar-usuario="${id}"]`) ||
          document.querySelector(".users-layout .users-table-toolbar > button");
      destino?.focus({ preventScroll: true });
    };
  }, [id]);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const respuesta = await solicitarApi(`/api/usuarios/${id}`);
        const resultado = await respuesta.json();
        if (cancelado) return;
        if (!resultado.usuario || String(resultado.usuario.id) !== String(id)) {
          throw new Error("La respuesta no incluye los datos del usuario solicitado.");
        }
        const registro = resultado.usuario;
        setFormulario({ nombre: registro.nombre || "", email: registro.email || "", password: "",
          rol: registro.rol || "", dependencia_id: registro.dependencia_id ? String(registro.dependencia_id) : "" });
      } catch (error) {
        if (cancelado) return;
        if (error.status === 404) await cargarUsuarios();
        if (error.status === 422) await cargarDependencias();
        if (!cancelado) setMensaje({ texto: error.message, tono: "error" });
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    cargar();
    return () => { cancelado = true; };
  }, [id]);

  function cerrar() {
    if (!ocupado.current) alCerrar();
  }

  async function guardar(evento) {
    evento.preventDefault();
    if (ocupado.current || !formulario) return;
    if (formulario.password !== "" && !contrasenaValida(formulario.password)) {
      setMensaje({ texto: POLITICA_CONTRASENA, tono: "error" });
      return;
    }
    ocupado.current = true;
    setGuardando(true);
    setMensaje({ texto: "Guardando los cambios del usuario…", tono: "" });
    const datos = { nombre: formulario.nombre.trim(), email: formulario.email.trim(), rol: formulario.rol,
      dependencia_id: formulario.rol === "funcionario" ? Number(formulario.dependencia_id) : null };
    if (formulario.password !== "") datos.password = formulario.password;
    try {
      const respuesta = await solicitarApi(`/api/usuarios/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos),
      });
      const resultado = await respuesta.json();
      if (!vigente.current) return;
      if (String(id) === String(usuario.id)) {
        limpiarSesion();
        window.location.replace("login.html");
        return;
      }
      const listaActualizada = await cargarUsuarios();
      if (vigente.current) alGuardar(resultado.message || "Usuario actualizado con éxito.", listaActualizada);
    } catch (error) {
      if (!vigente.current) return;
      if (error.status === 404) await cargarUsuarios();
      if (error.status === 422) await cargarDependencias();
      if (vigente.current) setMensaje({ texto: error.message, tono: "error" });
    } finally {
      ocupado.current = false;
      if (vigente.current) setGuardando(false);
    }
  }

  return (
    <dialog ref={dialogo} className="users-edit-drawer" aria-labelledby="usuarios-edicion-titulo"
      onCancel={evento => { evento.preventDefault(); cerrar(); }}
      onKeyDown={evento => {
        if (evento.key !== "Tab") return;
        const controles = Array.from(dialogo.current.querySelectorAll("button, input, select, textarea"))
          .filter(control => !control.matches(":disabled") && control.tabIndex >= 0);
        const primero = controles[0];
        const ultimo = controles.at(-1);
        if (!primero) {
          evento.preventDefault();
          titulo.current.focus({ preventScroll: true });
          return;
        }
        if (evento.shiftKey && (document.activeElement === primero || !controles.includes(document.activeElement))) {
          evento.preventDefault();
          ultimo?.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primero?.focus();
        }
      }}>
      <header className="users-drawer-heading">
        <div>
          <p className="auth-eyebrow">Administración de acceso</p>
          <h2 ref={titulo} id="usuarios-edicion-titulo" tabIndex={-1}>Editar usuario</h2>
        </div>
        <button type="button" onClick={cerrar} disabled={guardando}>Cerrar edición</button>
      </header>
      {cargando ? <p role="status">Cargando los datos del usuario…</p> : formulario && (
        <form className="auth-form auth-form--grid" onSubmit={guardar}>
          <fieldset className="users-drawer-fields" disabled={guardando}>
            <CamposUsuario formulario={formulario} dependencias={dependencias} edicion
              actualizarCampo={evento => {
                const { name, value } = evento.target;
                setFormulario(actual => ({ ...actual, [name]: value,
                  ...(name === "rol" && value !== "funcionario" ? { dependencia_id: "" } : {}) }));
              }} />
          </fieldset>
          <div className="users-drawer-actions">
            <button type="submit" className="auth-submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" onClick={cerrar} disabled={guardando}>Cancelar edición</button>
          </div>
        </form>
      )}
      <MensajeEstado tono={mensaje.tono}>{mensaje.texto}</MensajeEstado>
    </dialog>
  );
}

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

  async function enviarFormulario(evento) {
    evento.preventDefault();
    if (!contrasenaValida(formulario.password)) {
      setMensaje({ texto: POLITICA_CONTRASENA, tono: "error" });
      return;
    }
    setEnProceso(true);
    setMensaje({
      texto: "Creando el usuario…",
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
    datos.password = formulario.password;

    try {
      const respuesta = await solicitarApi(
        "/api/usuarios",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(datos),
        },
      );
      const resultado = await respuesta.json();
      setFormulario(FORMULARIO_VACIO);
      setMensaje({
        texto:
          resultado.message ||
          "Usuario registrado con éxito.",
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

  return (
    <div className="app-page">
      <EncabezadoAplicacion usuario={usuario} pantallaActual="usuarios" />
      <main className="users-management-main users-layout">
        <header className="auth-heading users-page-heading">
          <p className="auth-eyebrow">Administración de acceso</p>
          <h1 id="register-title">Gestión de usuarios</h1>
          <p>Crea, edita, activa e inactiva cuentas del sistema.</p>
        </header>
        <section
          className="auth-card users-management-card"
          aria-labelledby="usuarios-formulario-titulo"
        >
          <form
            className="auth-form auth-form--grid users-registration-form"
            onSubmit={enviarFormulario}
          >
            <h2 id="usuarios-formulario-titulo" className="auth-field--full">
              Registrar usuario
            </h2>
            <CamposUsuario formulario={formulario} dependencias={dependencias} actualizarCampo={actualizarCampo} />
            <div className="auth-field--full users-form-actions">
              <button
                className="auth-submit"
                type="submit"
                disabled={enProceso}
              >
                {enProceso ? "Guardando…" : "Registrar usuario"}
              </button>
            </div>
            <MensajeEstado tono={mensaje.tono}>{mensaje.texto}</MensajeEstado>
          </form>
        </section>
          <section
            className="auth-card users-management-card users-table-section"
            aria-labelledby="usuarios-titulo"
          >
            <div className="users-table-toolbar">
              <div>
                <h2 id="usuarios-titulo">Usuarios registrados en el sistema</h2>
                <p className="users-table-description">Consulta las cuentas y administra sus datos y acceso al sistema.</p>
              </div>
              <button
                type="button"
                onClick={cargarUsuarios}
                disabled={cargandoUsuarios || enProceso}
              >
                Actualizar lista
              </button>
            </div>
            <div className="table-card users-table-card">
              <p className="tabla-ayuda">En pantallas intermedias, desplaza la tabla para ver todas las columnas.</p>
              <div className="table-scroll users-table-scroll" role="region" aria-label="Listado de usuarios" tabIndex={0}>
                <table id="tabla-usuarios" className="tabla-adaptable" role="table" aria-label="Usuarios">
                <thead role="rowgroup">
                  <tr role="row">
                    <th scope="col" role="columnheader">Nombre</th>
                    <th scope="col" role="columnheader">Correo</th>
                    <th scope="col" role="columnheader">Rol</th>
                    <th scope="col" role="columnheader">Dependencia</th>
                    <th scope="col" role="columnheader">Estado</th>
                    <th scope="col" role="columnheader">Acciones</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
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
                        <tr role="row" key={usuarioFila.id}>
                          <CeldaAdaptable etiqueta="Nombre"><strong className="users-account-name">{usuarioFila.nombre}</strong></CeldaAdaptable>
                          <CeldaAdaptable etiqueta="Correo">{usuarioFila.email}</CeldaAdaptable>
                          <CeldaAdaptable etiqueta="Rol">{ROLES_USUARIOS[usuarioFila.rol] || usuarioFila.rol}</CeldaAdaptable>
                          <CeldaAdaptable etiqueta="Dependencia">{dependencia?.nombre || "—"}</CeldaAdaptable>
                          <CeldaAdaptable etiqueta="Estado">
                            <span className={`users-status-badge users-status-badge--${estaActivo ? "active" : "inactive"}`}>
                              {estaActivo ? "Activo" : "Inactivo"}
                            </span>
                          </CeldaAdaptable>
                          <CeldaAdaptable etiqueta="Acciones">
                            <div className="users-table-actions">
                              <button
                                className="users-action-edit"
                                data-editar-usuario={usuarioFila.id}
                                type="button"
                                onClick={() => setUsuarioEnEdicion(usuarioFila.id)}
                                disabled={enProceso}
                              >
                                Editar
                              </button>
                              <button
                                className={estaActivo ? "users-action-deactivate" : "users-action-activate"}
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
                          </CeldaAdaptable>
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
      </main>
      {usuarioEnEdicion !== null && (
        <DrawerEdicionUsuario key={usuarioEnEdicion} id={usuarioEnEdicion} usuario={usuario}
          dependencias={dependencias} cargarUsuarios={cargarUsuarios} cargarDependencias={cargarDependencias}
          alCerrar={() => setUsuarioEnEdicion(null)}
          alGuardar={(texto, listaActualizada) => {
            setUsuarioEnEdicion(null);
            if (listaActualizada) setMensaje({ texto, tono: "success" });
            else setMensaje(actual => ({
              texto: `Los cambios se guardaron, pero no se pudo actualizar la lista. ${actual.texto}`,
              tono: "error",
            }));
          }} />
      )}
      <PiePagina />
    </div>
  );
}
