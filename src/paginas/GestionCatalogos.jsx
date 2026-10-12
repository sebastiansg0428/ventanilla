import { useEffect, useRef, useState } from "react";
import {
  EncabezadoAplicacion,
  MensajeEstado,
  PiePagina,
  ProteccionSesion,
} from "../componentes/Compartidos";
import { solicitarApi } from "../servicios/api";

const CATALOGO_DEPENDENCIAS = "dependencias";
const CATALOGO_TRAMITES = "tipos-tramite";
const FORMULARIO_DEPENDENCIA_VACIO = { nombre: "" };
const FORMULARIO_TRAMITE_VACIO = {
  codigo: "",
  nombre: "",
  categoria_general: "",
  dias: "",
  tipo_dias: "habiles",
  fundamento_legal: "",
  vigente_desde: "",
  orden: "",
};

function estaActivo(registro) {
  return Number(registro.activo) === 1;
}

async function leerResultado(respuesta) {
  if (respuesta.status === 204) return {};
  const tipoContenido = respuesta.headers?.get?.("content-type");
  if (tipoContenido && !tipoContenido.includes("application/json")) return {};
  return respuesta.json();
}

export function PaginaGestionCatalogos() {
  return (
    <ProteccionSesion soloAdministrador>
      {(usuario) => <GestionCatalogos usuario={usuario} />}
    </ProteccionSesion>
  );
}

function GestionCatalogos({ usuario }) {
  const formularioCatalogoRef = useRef(null);
  const [catalogoActual, setCatalogoActual] = useState(CATALOGO_DEPENDENCIAS);
  const [incluirInactivos, setIncluirInactivos] = useState(true);
  const [dependencias, setDependencias] = useState([]);
  const [tiposTramite, setTiposTramite] = useState([]);
  const [formularioDependencia, setFormularioDependencia] = useState(
    FORMULARIO_DEPENDENCIA_VACIO,
  );
  const [formularioTramite, setFormularioTramite] = useState(
    FORMULARIO_TRAMITE_VACIO,
  );
  const [registroEnEdicion, setRegistroEnEdicion] = useState(null);
  const [tramiteTerminoNuevo, setTramiteTerminoNuevo] = useState(null);
  const [formularioTermino, setFormularioTermino] = useState({
    dias: "",
    tipo_dias: "habiles",
    fundamento_legal: "",
    vigente_desde: "",
  });
  const [terminosVigentes, setTerminosVigentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enProceso, setEnProceso] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tono: "" });

  const rutaCatalogos = incluirInactivos
    ? {
        dependencias: "/api/dependencias?incluir_inactivos=1",
        tramites: "/api/tipos-tramite?incluir_inactivos=1",
      }
    : {
        dependencias: "/api/dependencias",
        tramites: "/api/tipos-tramite",
      };

  async function cargarCatalogos() {
    setCargando(true);
    try {
      const [respuestaDependencias, respuestaTramites] = await Promise.all([
        solicitarApi(rutaCatalogos.dependencias),
        solicitarApi(rutaCatalogos.tramites),
      ]);
      const [resultadoDependencias, resultadoTramites] = await Promise.all([
        respuestaDependencias.json(),
        respuestaTramites.json(),
      ]);
      if (!Array.isArray(resultadoDependencias.dependencias)) {
        throw new Error(
          "La respuesta de dependencias no tiene el formato esperado.",
        );
      }
      if (!Array.isArray(resultadoTramites.tipos_tramite)) {
        throw new Error(
          "La respuesta de tipos de trámite no tiene el formato esperado.",
        );
      }
      setDependencias(resultadoDependencias.dependencias);
      setTiposTramite(resultadoTramites.tipos_tramite);
    } catch (error) {
      setMensaje({ texto: error.message, tono: "error" });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarCatalogos();
  }, [incluirInactivos]);

  useEffect(() => {
    if (!registroEnEdicion || !formularioCatalogoRef.current) return;
    formularioCatalogoRef.current.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
    formularioCatalogoRef.current
      .querySelector("input:not([type='hidden']), textarea")
      ?.focus();
  }, [registroEnEdicion]);

  async function cargarTerminos(tipoTramiteId) {
    try {
      const respuesta = await solicitarApi(
        `/api/terminos-legales?tipo_tramite_id=${encodeURIComponent(tipoTramiteId)}`,
      );
      const resultado = await leerResultado(respuesta);
      const lista =
        resultado.terminos_legales ||
        resultado.terminos ||
        resultado.historial ||
        [];
      if (!Array.isArray(lista)) {
        throw new Error("La respuesta de términos legales no es válida.");
      }
      setTerminosVigentes(lista);
    } catch (error) {
      setMensaje({ texto: error.message, tono: "error" });
      setTerminosVigentes([]);
    }
  }

  function limpiarFormulario() {
    setRegistroEnEdicion(null);
    setFormularioDependencia(FORMULARIO_DEPENDENCIA_VACIO);
    setFormularioTramite(FORMULARIO_TRAMITE_VACIO);
    setMensaje({ texto: "", tono: "" });
  }

  function seleccionarCatalogo(catalogo) {
    setCatalogoActual(catalogo);
    limpiarFormulario();
    setTramiteTerminoNuevo(null);
  }

  async function editarRegistro(id) {
    const esDependencia = catalogoActual === CATALOGO_DEPENDENCIAS;
    const ruta = esDependencia
      ? `/api/dependencias/${id}`
      : `/api/tipos-tramite/${id}`;
    setMensaje({ texto: "Cargando datos para editar…", tono: "" });
    try {
      const respuesta = await solicitarApi(ruta);
      const resultado = await leerResultado(respuesta);
      const registro =
        resultado.dependencia ||
        resultado.tipo_tramite ||
        resultado.tipoTramite;
      if (!registro) {
        throw new Error("La respuesta no incluye los datos del registro.");
      }
      setRegistroEnEdicion(registro);
      if (esDependencia) {
        setFormularioDependencia({ nombre: registro.nombre || "" });
      } else {
        setFormularioTramite({
          ...FORMULARIO_TRAMITE_VACIO,
          codigo: registro.codigo || "",
          nombre: registro.nombre || "",
          categoria_general: registro.categoria_general || "",
          orden:
            registro.orden === null || registro.orden === undefined
              ? ""
              : String(registro.orden),
        });
      }
      setMensaje({ texto: "", tono: "" });
    } catch (error) {
      if (error.status === 404) await cargarCatalogos();
      setMensaje({ texto: error.message, tono: "error" });
    }
  }

  async function guardarRegistro(evento) {
    evento.preventDefault();
    const esDependencia = catalogoActual === CATALOGO_DEPENDENCIAS;
    const id = registroEnEdicion?.id;
    const ruta = esDependencia
      ? id
        ? `/api/dependencias/${id}`
        : "/api/dependencias"
      : id
        ? `/api/tipos-tramite/${id}`
        : "/api/tipos-tramite";
    const metodo = id ? "PUT" : "POST";
    const datos = esDependencia
      ? { nombre: formularioDependencia.nombre.trim() }
      : id
        ? {
            codigo: formularioTramite.codigo.trim(),
            nombre: formularioTramite.nombre.trim(),
            categoria_general: formularioTramite.categoria_general.trim(),
            ...(formularioTramite.orden !== ""
              ? { orden: Number(formularioTramite.orden) }
              : {}),
          }
        : {
            codigo: formularioTramite.codigo.trim(),
            nombre: formularioTramite.nombre.trim(),
            categoria_general: formularioTramite.categoria_general.trim(),
            dias: Number(formularioTramite.dias),
            tipo_dias: formularioTramite.tipo_dias,
            fundamento_legal: formularioTramite.fundamento_legal.trim(),
            ...(formularioTramite.vigente_desde
              ? { vigente_desde: formularioTramite.vigente_desde }
              : {}),
          };

    setEnProceso(true);
    setMensaje({
      texto: id ? "Guardando cambios…" : "Creando registro…",
      tono: "",
    });
    try {
      const respuesta = await solicitarApi(ruta, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const resultado = await leerResultado(respuesta);
      setMensaje({
        texto:
          resultado.message ||
          (id ? "Cambios guardados correctamente." : "Registro creado."),
        tono: "success",
      });
      setRegistroEnEdicion(null);
      setFormularioDependencia(FORMULARIO_DEPENDENCIA_VACIO);
      setFormularioTramite(FORMULARIO_TRAMITE_VACIO);
      await cargarCatalogos();
    } catch (error) {
      if (error.status === 404) await cargarCatalogos();
      setMensaje({ texto: error.message, tono: "error" });
    } finally {
      setEnProceso(false);
    }
  }

  async function cambiarEstado(registro) {
    const activar = !estaActivo(registro);
    const accion = activar ? "activar" : "inactivar";
    if (
      !window.confirm(
        `¿Deseas ${accion} "${registro.nombre}"? Los registros históricos se conservarán.`,
      )
    ) {
      return;
    }
    const rutaBase =
      catalogoActual === CATALOGO_DEPENDENCIAS
        ? "/api/dependencias"
        : "/api/tipos-tramite";
    setEnProceso(true);
    try {
      const respuesta = await solicitarApi(
        `${rutaBase}/${registro.id}/estado`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo: activar ? 1 : 0 }),
        },
      );
      const resultado = await leerResultado(respuesta);
      setMensaje({
        texto:
          resultado.message ||
          `El registro se ${activar ? "activó" : "inactivó"} correctamente.`,
        tono: "success",
      });
      await cargarCatalogos();
    } catch (error) {
      if (error.status === 404) await cargarCatalogos();
      setMensaje({ texto: error.message, tono: "error" });
    } finally {
      setEnProceso(false);
    }
  }

  async function registrarTermino(evento) {
    evento.preventDefault();
    const datos = {
      tipo_tramite_id: Number(tramiteTerminoNuevo.id),
      dias: Number(formularioTermino.dias),
      tipo_dias: formularioTermino.tipo_dias,
      fundamento_legal: formularioTermino.fundamento_legal.trim(),
      ...(formularioTermino.vigente_desde
        ? { vigente_desde: formularioTermino.vigente_desde }
        : {}),
    };
    setEnProceso(true);
    try {
      const respuesta = await solicitarApi("/api/terminos-legales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const resultado = await leerResultado(respuesta);
      setMensaje({
        texto: resultado.message || "Nueva versión del término registrada.",
        tono: "success",
      });
      setTramiteTerminoNuevo(null);
      setFormularioTermino({
        dias: "",
        tipo_dias: "habiles",
        fundamento_legal: "",
        vigente_desde: "",
      });
      await cargarCatalogos();
      await cargarTerminos(datos.tipo_tramite_id);
    } catch (error) {
      if (error.status === 404 || error.status === 422) await cargarCatalogos();
      setMensaje({ texto: error.message, tono: "error" });
    } finally {
      setEnProceso(false);
    }
  }

  const registros =
    catalogoActual === CATALOGO_DEPENDENCIAS ? dependencias : tiposTramite;
  const editando = Boolean(registroEnEdicion);

  return (
    <div className="app-page">
      <EncabezadoAplicacion usuario={usuario} pantallaActual="catalogos" />
      <main className="users-management-main">
        <section className="auth-card users-management-card">
          <div className="auth-heading">
            <p className="auth-eyebrow">Administración del sistema</p>
            <h1>Gestión de catálogos</h1>
            <p>
              Administra dependencias, tipos de trámite y sus términos legales.
            </p>
          </div>

          <div className="catalog-tabs" role="tablist" aria-label="Catálogos">
            <button
              type="button"
              role="tab"
              aria-selected={catalogoActual === CATALOGO_DEPENDENCIAS}
              onClick={() => seleccionarCatalogo(CATALOGO_DEPENDENCIAS)}
            >
              Dependencias
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={catalogoActual === CATALOGO_TRAMITES}
              onClick={() => seleccionarCatalogo(CATALOGO_TRAMITES)}
            >
              Tipos de trámite
            </button>
          </div>

          <form
            ref={formularioCatalogoRef}
            className="auth-form auth-form--grid catalog-form"
            onSubmit={guardarRegistro}
          >
            <h2 className="auth-field--full">
              {editando
                ? `Editar ${catalogoActual === CATALOGO_DEPENDENCIAS ? "dependencia" : "tipo de trámite"}`
                : `Crear ${catalogoActual === CATALOGO_DEPENDENCIAS ? "dependencia" : "tipo de trámite"}`}
            </h2>
            {catalogoActual === CATALOGO_DEPENDENCIAS ? (
              <div className="auth-field auth-field--full">
                <label htmlFor="catalogo-nombre">Nombre de la dependencia *</label>
                <input
                  id="catalogo-nombre"
                  name="nombre"
                  value={formularioDependencia.nombre}
                  onChange={(evento) =>
                    setFormularioDependencia({ nombre: evento.target.value })
                  }
                  maxLength="150"
                  required
                />
              </div>
            ) : (
              <>
                <div className="auth-field">
                  <label htmlFor="tramite-codigo">Código *</label>
                  <input
                    id="tramite-codigo"
                    value={formularioTramite.codigo}
                    onChange={(evento) =>
                      setFormularioTramite((actual) => ({
                        ...actual,
                        codigo: evento.target.value,
                      }))
                    }
                    maxLength="50"
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="tramite-nombre">Nombre *</label>
                  <input
                    id="tramite-nombre"
                    value={formularioTramite.nombre}
                    onChange={(evento) =>
                      setFormularioTramite((actual) => ({
                        ...actual,
                        nombre: evento.target.value,
                      }))
                    }
                    maxLength="150"
                    required
                  />
                </div>
                <div className="auth-field auth-field--full">
                  <label htmlFor="tramite-categoria">Categoría general *</label>
                  <input
                    id="tramite-categoria"
                    value={formularioTramite.categoria_general}
                    onChange={(evento) =>
                      setFormularioTramite((actual) => ({
                        ...actual,
                        categoria_general: evento.target.value,
                      }))
                    }
                    maxLength="150"
                    required
                  />
                </div>
                {editando ? (
                  <div className="auth-field">
                    <label htmlFor="tramite-orden">Orden (opcional)</label>
                    <input
                      id="tramite-orden"
                      type="number"
                      min="0"
                      value={formularioTramite.orden}
                      onChange={(evento) =>
                        setFormularioTramite((actual) => ({
                          ...actual,
                          orden: evento.target.value,
                        }))
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="auth-field">
                      <label htmlFor="tramite-dias">Plazo inicial (días) *</label>
                      <input
                        id="tramite-dias"
                        type="number"
                        min="1"
                        value={formularioTramite.dias}
                        onChange={(evento) =>
                          setFormularioTramite((actual) => ({
                            ...actual,
                            dias: evento.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="auth-field">
                      <label htmlFor="tramite-tipo-dias">Tipo de días *</label>
                      <select
                        id="tramite-tipo-dias"
                        value={formularioTramite.tipo_dias}
                        onChange={(evento) =>
                          setFormularioTramite((actual) => ({
                            ...actual,
                            tipo_dias: evento.target.value,
                          }))
                        }
                        required
                      >
                        <option value="habiles">Días hábiles</option>
                        <option value="calendario">Días calendario</option>
                      </select>
                    </div>
                    <div className="auth-field auth-field--full">
                      <label htmlFor="tramite-fundamento">
                        Fundamento legal *
                      </label>
                      <textarea
                        id="tramite-fundamento"
                        value={formularioTramite.fundamento_legal}
                        onChange={(evento) =>
                          setFormularioTramite((actual) => ({
                            ...actual,
                            fundamento_legal: evento.target.value,
                          }))
                        }
                        maxLength="1000"
                        required
                      />
                    </div>
                    <div className="auth-field">
                      <label htmlFor="tramite-vigencia">
                        Vigente desde (opcional)
                      </label>
                      <input
                        id="tramite-vigencia"
                        type="date"
                        value={formularioTramite.vigente_desde}
                        onChange={(evento) =>
                          setFormularioTramite((actual) => ({
                            ...actual,
                            vigente_desde: evento.target.value,
                          }))
                        }
                      />
                    </div>
                  </>
                )}
              </>
            )}
            <div className="auth-field--full catalog-form-actions">
              <button className="auth-submit" type="submit" disabled={enProceso}>
                {enProceso
                  ? "Guardando…"
                  : editando
                    ? "Guardar cambios"
                    : "Crear"}
              </button>
              {editando && (
                <button type="button" onClick={limpiarFormulario}>
                  Cancelar edición
                </button>
              )}
            </div>
            <MensajeEstado tono={mensaje.tono}>{mensaje.texto}</MensajeEstado>
          </form>

          <section className="users-table-section" aria-labelledby="catalogo-lista-titulo">
            <div className="users-table-toolbar">
              <h2 id="catalogo-lista-titulo">
                {catalogoActual === CATALOGO_DEPENDENCIAS
                  ? "Dependencias registradas"
                  : "Tipos de trámite registrados"}
              </h2>
              <label className="catalog-inactive-toggle">
                <input
                  type="checkbox"
                  checked={incluirInactivos}
                  onChange={(evento) =>
                    setIncluirInactivos(evento.target.checked)
                  }
                />
                Mostrar inactivos
              </label>
            </div>
            <div className="table-card users-table-card">
              <div className="table-scroll users-table-scroll">
                <table id="tabla-catalogos">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      {catalogoActual === CATALOGO_TRAMITES && (
                        <>
                          <th>Código</th>
                          <th>Categoría</th>
                          <th>Término vigente</th>
                        </>
                      )}
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando ? (
                      <tr>
                        <td colSpan={catalogoActual === CATALOGO_TRAMITES ? 6 : 3}>
                          Cargando catálogo…
                        </td>
                      </tr>
                    ) : registros.length === 0 ? (
                      <tr>
                        <td colSpan={catalogoActual === CATALOGO_TRAMITES ? 6 : 3}>
                          No hay registros para mostrar.
                        </td>
                      </tr>
                    ) : (
                      registros.map((registro) => (
                        <tr key={registro.id}>
                          <td>{registro.nombre}</td>
                          {catalogoActual === CATALOGO_TRAMITES && (
                            <>
                              <td>{registro.codigo || "—"}</td>
                              <td>{registro.categoria_general || "—"}</td>
                              <td>
                                {registro.termino_legal_id
                                  ? `${registro.dias} ${registro.tipo_dias || "días"}`
                                  : "Sin término vigente"}
                              </td>
                            </>
                          )}
                          <td>
                            <span
                              className={`catalog-status ${estaActivo(registro) ? "catalog-status--active" : "catalog-status--inactive"}`}
                            >
                              {estaActivo(registro) ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td>
                            <div className="users-table-actions">
                              <button
                                type="button"
                                onClick={() => editarRegistro(registro.id)}
                                disabled={enProceso}
                              >
                                Editar
                              </button>
                              {catalogoActual === CATALOGO_TRAMITES && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTramiteTerminoNuevo(registro);
                                    setFormularioTermino({
                                      dias: "",
                                      tipo_dias: "habiles",
                                      fundamento_legal: "",
                                      vigente_desde: "",
                                    });
                                    cargarTerminos(registro.id);
                                  }}
                                  disabled={enProceso || !estaActivo(registro)}
                                >
                                  Nueva versión de término
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => cambiarEstado(registro)}
                                disabled={enProceso}
                              >
                                {estaActivo(registro) ? "Inactivar" : "Activar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {tramiteTerminoNuevo && catalogoActual === CATALOGO_TRAMITES && (
            <section className="catalog-term-panel">
              <div className="users-table-toolbar">
                <h2>Nueva versión del término: {tramiteTerminoNuevo.nombre}</h2>
                <button
                  type="button"
                  onClick={() => setTramiteTerminoNuevo(null)}
                >
                  Cerrar
                </button>
              </div>
              {terminosVigentes.length > 0 && (
                <div className="table-card users-table-card">
                  <div className="table-scroll users-table-scroll">
                    <table id="tabla-terminos-legales">
                      <thead>
                        <tr>
                          <th>Días</th>
                          <th>Tipo</th>
                          <th>Fundamento legal</th>
                          <th>Vigente desde</th>
                          <th>Vigente hasta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {terminosVigentes.map((termino) => (
                          <tr key={termino.id}>
                            <td>{termino.dias}</td>
                            <td>{termino.tipo_dias}</td>
                            <td>{termino.fundamento_legal}</td>
                            <td>{termino.vigente_desde || "—"}</td>
                            <td>{termino.vigente_hasta || "Actual"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <form
                className="auth-form auth-form--grid catalog-form"
                onSubmit={registrarTermino}
              >
                <div className="auth-field">
                  <label htmlFor="termino-dias">Plazo (días) *</label>
                  <input
                    id="termino-dias"
                    type="number"
                    min="1"
                    value={formularioTermino.dias}
                    onChange={(evento) =>
                      setFormularioTermino((actual) => ({
                        ...actual,
                        dias: evento.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="termino-tipo-dias">Tipo de días *</label>
                  <select
                    id="termino-tipo-dias"
                    value={formularioTermino.tipo_dias}
                    onChange={(evento) =>
                      setFormularioTermino((actual) => ({
                        ...actual,
                        tipo_dias: evento.target.value,
                      }))
                    }
                    required
                  >
                    <option value="habiles">Días hábiles</option>
                    <option value="calendario">Días calendario</option>
                  </select>
                </div>
                <div className="auth-field auth-field--full">
                  <label htmlFor="termino-fundamento">Fundamento legal *</label>
                  <textarea
                    id="termino-fundamento"
                    value={formularioTermino.fundamento_legal}
                    onChange={(evento) =>
                      setFormularioTermino((actual) => ({
                        ...actual,
                        fundamento_legal: evento.target.value,
                      }))
                    }
                    maxLength="1000"
                    required
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="termino-vigencia">
                    Vigente desde (opcional)
                  </label>
                  <input
                    id="termino-vigencia"
                    type="date"
                    value={formularioTermino.vigente_desde}
                    onChange={(evento) =>
                      setFormularioTermino((actual) => ({
                        ...actual,
                        vigente_desde: evento.target.value,
                      }))
                    }
                  />
                </div>
                <div className="auth-field--full">
                  <button
                    className="auth-submit"
                    type="submit"
                    disabled={enProceso}
                  >
                    {enProceso ? "Registrando…" : "Registrar nueva versión"}
                  </button>
                </div>
              </form>
            </section>
          )}
          <p className="auth-switch">
            <a href="index.html">Volver al sistema</a>
          </p>
        </section>
      </main>
      <PiePagina />
    </div>
  );
}
