import { useEffect, useRef, useState } from "react";
import {
  EncabezadoAplicacion,
  MensajeEstado,
  PiePagina,
  ProteccionSesion,
  CeldaAdaptable,
} from "../componentes/Compartidos";
import { solicitarApi } from "../servicios/api";

const CATALOGO_DEPENDENCIAS = "dependencias";
const CATALOGO_TRAMITES = "tipos-tramite";
const CATEGORIAS_TRAMITE = [
  { valor: "peticion_general", etiqueta: "Petición general" },
  {
    valor: "informacion_documentos",
    etiqueta: "Información y documentos",
  },
  { valor: "consulta", etiqueta: "Consulta" },
  { valor: "entre_autoridades", etiqueta: "Entre autoridades" },
  { valor: "especial", etiqueta: "Trámite especial" },
];
const FORMULARIO_DEPENDENCIA_VACIO = { nombre: "" };
const FORMULARIO_TRAMITE_VACIO = {
  requiere_respuesta: true,
  codigo: "",
  nombre: "",
  categoria_general: "",
  dias: "",
  tipo_dias: "habiles",
  fundamento_legal: "",
  vigente_desde: "",
  orden: "",
};

function generarCodigoTramite(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .replace(/_+$/g, "");
}

function estaActivo(registro) {
  return Number(registro.activo) === 1;
}

function normalizarBusqueda(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function coincideBusqueda(registro, catalogo, busqueda) {
  const termino = normalizarBusqueda(busqueda);
  if (!termino) return true;
  const categoria = CATEGORIAS_TRAMITE.find(
    ({ valor }) => valor === registro.categoria_general,
  )?.etiqueta;
  const valores = [registro.nombre];
  if (catalogo === CATALOGO_TRAMITES) {
    valores.push(registro.codigo, registro.categoria_general, categoria);
  }
  return valores.some((valor) => normalizarBusqueda(valor).includes(termino));
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
  const [busqueda, setBusqueda] = useState("");
  const [dependencias, setDependencias] = useState([]);
  const [tiposTramite, setTiposTramite] = useState([]);
  const [formularioDependencia, setFormularioDependencia] = useState(
    FORMULARIO_DEPENDENCIA_VACIO,
  );
  const [formularioTramite, setFormularioTramite] = useState(
    FORMULARIO_TRAMITE_VACIO,
  );
  const [registroEnEdicion, setRegistroEnEdicion] = useState(null);
  const [codigoTramiteEditado, setCodigoTramiteEditado] = useState(false);
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
    setCodigoTramiteEditado(false);
    setFormularioDependencia(FORMULARIO_DEPENDENCIA_VACIO);
    setFormularioTramite(FORMULARIO_TRAMITE_VACIO);
    setMensaje({ texto: "", tono: "" });
  }

  function seleccionarCatalogo(catalogo) {
    setCatalogoActual(catalogo);
    setBusqueda("");
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
        setCodigoTramiteEditado(true);
        setFormularioTramite({
          ...FORMULARIO_TRAMITE_VACIO,
          codigo: registro.codigo || "",
          requiere_respuesta: registro.requiere_respuesta !== false && registro.requiere_respuesta !== 0,
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
            requiere_respuesta: formularioTramite.requiere_respuesta,
            ...(formularioTramite.orden !== ""
              ? { orden: Number(formularioTramite.orden) }
              : {}),
          }
        : {
            codigo: formularioTramite.codigo.trim(),
            nombre: formularioTramite.nombre.trim(),
            categoria_general: formularioTramite.categoria_general.trim(),
            requiere_respuesta: formularioTramite.requiere_respuesta,
            ...(formularioTramite.requiere_respuesta ? {
            dias: Number(formularioTramite.dias),
            tipo_dias: formularioTramite.tipo_dias,
            fundamento_legal: formularioTramite.fundamento_legal.trim(),
            ...(formularioTramite.vigente_desde
              ? { vigente_desde: formularioTramite.vigente_desde }
              : {}),
            } : {}),
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
      setCodigoTramiteEditado(false);
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
        texto: `${resultado.message || "Plazo guardado."} Se aplicará a nuevas radicaciones según su vigencia. Actualiza los trámites del formulario de radicación para consultar su disponibilidad.`,
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
  const registrosFiltrados = registros.filter((registro) =>
    coincideBusqueda(registro, catalogoActual, busqueda),
  );
  const resumenCatalogo = {
    total: registros.length,
    activos: registros.filter(estaActivo).length,
    inactivos: registros.filter((registro) => !estaActivo(registro)).length,
  };
  const editando = Boolean(registroEnEdicion);

  return (
    <div className="app-page">
      <EncabezadoAplicacion usuario={usuario} pantallaActual="catalogos" />
      <main className="users-management-main">
        <section className="auth-card users-management-card">
          <div className="auth-heading catalog-header">
            <div className="catalog-header__meta">
              <p className="auth-eyebrow">Administración del sistema</p>
              <span className="catalog-header__badge">Solo administradores</span>
            </div>
            <h1>Gestión de catálogos</h1>
            <p>
              Mantén organizadas las dependencias, los tipos de trámite y sus
              términos legales desde un solo lugar.
            </p>
          </div>

          <div className="catalog-summary-grid" aria-label="Resumen del catálogo">
            <article className="catalog-summary-card catalog-summary-card--primary">
              <span className="catalog-summary-card__label">Registros totales</span>
              <strong>{resumenCatalogo.total}</strong>
              <small>
                {catalogoActual === CATALOGO_DEPENDENCIAS
                  ? "Dependencias del sistema"
                  : "Tipos de trámite del sistema"}
              </small>
            </article>
            <article className="catalog-summary-card">
              <span className="catalog-summary-card__label">Activos</span>
              <strong>{resumenCatalogo.activos}</strong>
              <small>Disponibles para la operación</small>
            </article>
            <article className="catalog-summary-card">
              <span className="catalog-summary-card__label">Inactivos</span>
              <strong>{resumenCatalogo.inactivos}</strong>
              <small>Conservados para consulta histórica</small>
            </article>
          </div>

          <div className="catalog-tabs" role="tablist" aria-label="Catálogos">
            <button
              type="button"
              role="tab"
              aria-label="Dependencias"
              aria-selected={catalogoActual === CATALOGO_DEPENDENCIAS}
              onClick={() => seleccionarCatalogo(CATALOGO_DEPENDENCIAS)}
            >
              <span>Dependencias</span>
              <span className="catalog-tab-count" aria-hidden="true">
                {dependencias.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-label="Tipos de trámite"
              aria-selected={catalogoActual === CATALOGO_TRAMITES}
              onClick={() => seleccionarCatalogo(CATALOGO_TRAMITES)}
            >
              <span>Tipos de trámite</span>
              <span className="catalog-tab-count" aria-hidden="true">
                {tiposTramite.length}
              </span>
            </button>
          </div>

          <section className="catalog-editor-panel" aria-labelledby="catalogo-formulario-titulo">
            <div className="catalog-panel-heading">
              <div>
                <p className="catalog-panel-kicker">Editor de catálogo</p>
                <h2 id="catalogo-formulario-titulo">
                  {editando
                    ? `Editar ${catalogoActual === CATALOGO_DEPENDENCIAS ? "dependencia" : "tipo de trámite"}`
                    : `Crear ${catalogoActual === CATALOGO_DEPENDENCIAS ? "dependencia" : "tipo de trámite"}`}
                </h2>
              </div>
              <span className="catalog-panel-icon" aria-hidden="true">
                {editando ? "✎" : "+"}
              </span>
            </div>
            <form
              ref={formularioCatalogoRef}
              className="auth-form auth-form--grid catalog-form"
              onSubmit={guardarRegistro}
            >
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
                <div className="catalog-form-section-heading catalog-form-section-heading--first auth-field--full">
                  <h3>Identificación del trámite</h3>
                  <p>Define el nombre que verá el personal y el código interno del sistema.</p>
                </div>
                <div className="auth-field">
                  <label htmlFor="tramite-codigo">Código técnico *</label>
                  <input
                    id="tramite-codigo"
                    value={formularioTramite.codigo}
                    onChange={(evento) => {
                      setCodigoTramiteEditado(true);
                      setFormularioTramite((actual) => ({
                        ...actual,
                        codigo: evento.target.value,
                      }));
                    }}
                    maxLength="60"
                    minLength="2"
                    pattern="[a-z0-9_]{2,60}"
                    title="Usa de 2 a 60 caracteres: minúsculas sin tildes, números y guion bajo."
                    placeholder="Ejemplo: accion_tutela"
                    aria-describedby="tramite-codigo-ayuda"
                    autoComplete="off"
                    spellCheck="false"
                    required
                  />
                  <small id="tramite-codigo-ayuda">
                    Es un identificador para el sistema. Se completa a partir
                    del nombre; si lo cambias, usa minúsculas, números y guion
                    bajo.
                  </small>
                </div>
                <div className="auth-field">
                  <label htmlFor="tramite-nombre">Nombre *</label>
                  <input
                    id="tramite-nombre"
                    aria-describedby="tramite-nombre-ayuda"
                    value={formularioTramite.nombre}
                    onChange={(evento) => {
                      const nombre = evento.target.value;
                      setFormularioTramite((actual) => ({
                        ...actual,
                        nombre,
                        ...(!registroEnEdicion && !codigoTramiteEditado
                          ? { codigo: generarCodigoTramite(nombre) }
                          : {}),
                      }));
                    }}
                    maxLength="150"
                    required
                  />
                  <small id="tramite-nombre-ayuda">
                    Escribe el nombre que aparecerá al seleccionar este trámite.
                  </small>
                </div>
                <div className="catalog-form-section-heading auth-field--full">
                  <h3>Clasificación</h3>
                  <p>La categoría ayuda a organizar el trámite; no determina por sí sola el plazo.</p>
                </div>
                <div className="auth-field auth-field--full">
                  <label htmlFor="tramite-categoria">Categoría general *</label>
                  <select
                    id="tramite-categoria"
                    value={formularioTramite.categoria_general}
                    onChange={(evento) =>
                      setFormularioTramite((actual) => ({
                        ...actual,
                        categoria_general: evento.target.value,
                      }))
                    }
                    aria-describedby="tramite-categoria-ayuda"
                    required
                  >
                    <option value="">Selecciona una categoría</option>
                    {CATEGORIAS_TRAMITE.map(({ valor, etiqueta }) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </select>
                  <small id="tramite-categoria-ayuda">
                    Selecciona el grupo que mejor describe el trámite. El plazo
                    legal se define por separado.
                  </small>
                </div>
                <div className="auth-field auth-field--full">
                  <label htmlFor="tramite-requiere-respuesta">
                    <input id="tramite-requiere-respuesta" type="checkbox"
                      checked={formularioTramite.requiere_respuesta}
                      onChange={(evento) => setFormularioTramite((actual) => ({
                        ...actual, requiere_respuesta: evento.target.checked,
                      }))} />
                    Requiere respuesta
                  </label>
                  <small>Aplica solo a futuras radicaciones. Si exige respuesta, debe tener un término vigente. Valida esta clasificación con el responsable documental.</small>
                </div>
                {editando ? (
                  <div className="auth-field">
                    <label htmlFor="tramite-orden">Orden (opcional)</label>
                    <input
                      id="tramite-orden"
                      aria-describedby="tramite-orden-ayuda"
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
                    <small id="tramite-orden-ayuda">
                      Controla la posición del trámite en las listas. Déjalo
                      vacío si no necesitas cambiarla.
                    </small>
                  </div>
                ) : formularioTramite.requiere_respuesta ? (
                  <>
                    <div className="catalog-form-section-heading auth-field--full">
                      <h3>Plazo legal inicial</h3>
                      <p>Indica el tiempo para responder y la norma que lo respalda.</p>
                    </div>
                    <div className="auth-field">
                      <label htmlFor="tramite-dias">Cantidad de días para responder *</label>
                      <input
                        id="tramite-dias"
                        type="number"
                        min="1"
                        aria-describedby="tramite-dias-ayuda"
                        value={formularioTramite.dias}
                        onChange={(evento) =>
                          setFormularioTramite((actual) => ({
                            ...actual,
                            dias: evento.target.value,
                          }))
                        }
                        required
                      />
                      <small id="tramite-dias-ayuda">
                        Escribe el número de días establecido para este trámite.
                      </small>
                    </div>
                    <div className="auth-field">
                      <label htmlFor="tramite-tipo-dias">Cómo contar los días *</label>
                      <select
                        id="tramite-tipo-dias"
                        aria-describedby="tramite-tipo-dias-ayuda"
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
                      <small id="tramite-tipo-dias-ayuda">
                        Hábiles: no cuentan sábados, domingos ni festivos. Calendario:
                        cuenta todos los días.
                      </small>
                    </div>
                    <div className="auth-field auth-field--full">
                      <label htmlFor="tramite-fundamento">
                        Norma que establece el plazo *
                      </label>
                      <textarea
                        id="tramite-fundamento"
                        aria-describedby="tramite-fundamento-ayuda"
                        value={formularioTramite.fundamento_legal}
                        onChange={(evento) =>
                          setFormularioTramite((actual) => ({
                            ...actual,
                            fundamento_legal: evento.target.value,
                          }))
                        }
                        maxLength="500"
                        required
                      />
                      <small id="tramite-fundamento-ayuda">
                        Escribe la ley, decreto o artículo que respalda el plazo.
                      </small>
                    </div>
                    <div className="auth-field">
                      <label htmlFor="tramite-vigencia">
                        Fecha desde la que aplica (opcional)
                      </label>
                      <input
                        id="tramite-vigencia"
                        aria-describedby="tramite-vigencia-ayuda"
                        type="date"
                        value={formularioTramite.vigente_desde}
                        onChange={(evento) =>
                          setFormularioTramite((actual) => ({
                            ...actual,
                            vigente_desde: evento.target.value,
                          }))
                        }
                      />
                      <small id="tramite-vigencia-ayuda">
                        Si la dejas vacía, el plazo aplicará desde hoy.
                      </small>
                    </div>
                  </>
                ) : null}
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
          </section>

          <section className="users-table-section catalog-list-panel" aria-labelledby="catalogo-lista-titulo">
            <div className="users-table-toolbar catalog-list-toolbar">
              <div className="catalog-list-heading">
                <p className="catalog-panel-kicker">Directorio</p>
                <h2 id="catalogo-lista-titulo">
                  {catalogoActual === CATALOGO_DEPENDENCIAS
                    ? "Dependencias registradas"
                    : "Tipos de trámite registrados"}
                </h2>
              </div>
              <div className="catalog-list-controls">
                <label className="catalog-search">
                  <span>Buscar en el catálogo</span>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    placeholder={
                      catalogoActual === CATALOGO_DEPENDENCIAS
                        ? "Buscar por nombre"
                        : "Buscar por nombre, código o categoría"
                    }
                  />
                </label>
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
            </div>
            <p className="catalog-results-summary" role="status" aria-live="polite">
              {cargando
                ? "Cargando registros…"
                : `${registrosFiltrados.length} ${registrosFiltrados.length === 1 ? "resultado" : "resultados"}${busqueda.trim() ? " para tu búsqueda" : ""}.`}
            </p>
            <div className="table-card users-table-card">
              <p className="tabla-ayuda">En pantallas intermedias, desplaza la tabla para ver todas las columnas.</p>
              <div className="table-scroll users-table-scroll" role="region" aria-label="Listado del catálogo" tabIndex={0}>
                <table id="tabla-catalogos" className="tabla-adaptable" role="table" aria-label="Catálogo">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th scope="col" role="columnheader">Nombre</th>
                      {catalogoActual === CATALOGO_TRAMITES && (
                        <>
                          <th scope="col" role="columnheader">Código</th>
                          <th scope="col" role="columnheader">Categoría</th>
                          <th scope="col" role="columnheader">Término vigente</th>
                        </>
                      )}
                      <th scope="col" role="columnheader">Estado</th>
                      <th scope="col" role="columnheader">Acciones</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
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
                    ) : registrosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={catalogoActual === CATALOGO_TRAMITES ? 6 : 3}>
                          No hay registros que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      registrosFiltrados.map((registro) => (
                        <tr role="row" key={registro.id}>
                          <CeldaAdaptable etiqueta="Nombre">{registro.nombre}</CeldaAdaptable>
                          {catalogoActual === CATALOGO_TRAMITES && (
                            <>
                              <CeldaAdaptable etiqueta="Código">{registro.codigo || "—"}</CeldaAdaptable>
                              <CeldaAdaptable etiqueta="Categoría">{registro.categoria_general || "—"}</CeldaAdaptable>
                              <CeldaAdaptable etiqueta="Término vigente">
                                {registro.requiere_respuesta === 0 || registro.requiere_respuesta === false
                                  ? "No requiere respuesta" : registro.termino_legal_id
                                  ? `${registro.dias} ${registro.tipo_dias || "días"}`
                                  : "Sin término vigente"}
                              </CeldaAdaptable>
                            </>
                          )}
                          <CeldaAdaptable etiqueta="Estado">
                            <span
                              className={`catalog-status ${estaActivo(registro) ? "catalog-status--active" : "catalog-status--inactive"}`}
                            >
                              {estaActivo(registro) ? "Activo" : "Inactivo"}
                            </span>
                          </CeldaAdaptable>
                          <CeldaAdaptable etiqueta="Acciones">
                            <div className="users-table-actions">
                              <button
                                type="button"
                                className="catalog-action-edit"
                                onClick={() => editarRegistro(registro.id)}
                                disabled={enProceso}
                              >
                                Editar
                              </button>
                              {catalogoActual === CATALOGO_TRAMITES && (
                                <button
                                  type="button"
                                  className="catalog-action-term"
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
                                  {registro.termino_legal_id ? "Actualizar plazo" : "Configurar plazo"}
                                </button>
                              )}
                              <button
                                type="button"
                                className="catalog-action-toggle"
                                onClick={() => cambiarEstado(registro)}
                                disabled={enProceso}
                              >
                                {estaActivo(registro) ? "Inactivar" : "Activar"}
                              </button>
                            </div>
                          </CeldaAdaptable>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {tramiteTerminoNuevo && catalogoActual === CATALOGO_TRAMITES && (
            <section className="catalog-term-panel" aria-labelledby="catalogo-termino-titulo">
              <div className="users-table-toolbar">
                <div>
                  <p className="catalog-panel-kicker">Reglas de respuesta</p>
                  <h2 id="catalogo-termino-titulo">{tramiteTerminoNuevo.termino_legal_id ? "Actualizar plazo" : "Configurar plazo"}: {tramiteTerminoNuevo.nombre}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setTramiteTerminoNuevo(null)}
                >
                  Cerrar
                </button>
              </div>
              <p className="catalog-term-intro">Indica el número de días y cómo contarlos, con su fundamento y fecha de vigencia.
                {" "}El plazo se aplicará a nuevas radicaciones según esa fecha; no modifica los plazos ya registrados.
                {" "}Si hay versiones anteriores o futuras, revisa su historial antes de guardar.</p>
              {terminosVigentes.length > 0 && (
                <div className="table-card users-table-card">
                  <p className="tabla-ayuda">En pantallas intermedias, desplaza la tabla para ver todas las columnas.</p>
                  <div className="table-scroll users-table-scroll" role="region" aria-label="Historial de términos legales" tabIndex={0}>
                    <table id="tabla-terminos-legales" className="tabla-adaptable" role="table" aria-label="Términos legales">
                      <thead role="rowgroup">
                        <tr role="row">
                          <th scope="col" role="columnheader">Días</th>
                          <th scope="col" role="columnheader">Tipo</th>
                          <th scope="col" role="columnheader">Fundamento legal</th>
                          <th scope="col" role="columnheader">Vigente desde</th>
                          <th scope="col" role="columnheader">Vigente hasta</th>
                        </tr>
                      </thead>
                      <tbody role="rowgroup">
                        {terminosVigentes.map((termino) => (
                          <tr role="row" key={termino.id}>
                            <CeldaAdaptable etiqueta="Días">{termino.dias}</CeldaAdaptable>
                            <CeldaAdaptable etiqueta="Tipo">{termino.tipo_dias}</CeldaAdaptable>
                            <CeldaAdaptable etiqueta="Fundamento legal">{termino.fundamento_legal}</CeldaAdaptable>
                            <CeldaAdaptable etiqueta="Vigente desde">{termino.vigente_desde || "—"}</CeldaAdaptable>
                            <CeldaAdaptable etiqueta="Vigente hasta">{termino.vigente_hasta || "Actual"}</CeldaAdaptable>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="catalog-term-form-card">
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
                  <small>Hábiles: no cuentan sábados, domingos ni festivos. Calendario: cuenta todos los días.</small>
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
                    maxLength="500"
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
                  <small>Si la dejas vacía, aplica desde hoy. No se admiten fechas anteriores a hoy.
                    {" "}Una vigencia futura no habilita el trámite antes de esa fecha.</small>
                </div>
                <div className="auth-field--full">
                  <button
                    className="auth-submit"
                    type="submit"
                    disabled={enProceso}
                  >
                    {enProceso ? "Registrando…" : "Guardar plazo"}
                  </button>
                </div>
                </form>
              </div>
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
