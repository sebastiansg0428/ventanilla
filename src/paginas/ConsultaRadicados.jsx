import { useEffect, useMemo, useRef, useState } from "react";
import {
  EncabezadoAplicacion,
  PiePagina,
  ProteccionSesion,
  MensajeEstado,
} from "../componentes/Compartidos";
import { solicitarApi } from "../servicios/api";
import { crearPdfComprobante } from "../servicios/comprobante";

const ESTADOS_POSIBLES = ["Recibido", "En trámite", "Pendiente", "Respondido"];
const normalizarTexto = (valor) =>
  String(valor || "")
    // normalize es un método integrado de JavaScript para normalizar tildes.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const convertirFechaLocal = (valor) => {
  const fecha = new Date(String(valor || "").replace(" ", "T"));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};
const obtenerFechaBogota = (valor) => {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor))
    return valor;
  const fechaEntrada = valor instanceof Date ? valor : String(valor || "");
  const fecha =
    fechaEntrada instanceof Date
      ? fechaEntrada
      : new Date(
          /(?:Z|[+-]\d{2}:?\d{2})$/i.test(fechaEntrada)
            ? fechaEntrada
            : `${fechaEntrada.replace(" ", "T")}-05:00`,
        );
  if (Number.isNaN(fecha.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valores = Object.fromEntries(
    partes.map(({ type, value }) => [type, value]),
  );
  return `${valores.year}-${valores.month}-${valores.day}`;
};
const estaEnEstadoCritico = (radicado) =>
  ["alerta", "vencido"].includes(normalizarTexto(radicado.semaforo?.nivel));
const obtenerTipoComunicacion = (radicado) => {
  const valor = normalizarTexto(
    radicado.tipo_comunicacion || radicado.tipo_documento,
  );
  return valor.includes("interna")
    ? "interna"
    : valor.includes("externa")
      ? "externa"
      : "sin-tipo";
};

export function PaginaConsultaRadicados() {
  return (
    <ProteccionSesion>
      {(usuario) => <VistaConsultaRadicados usuario={usuario} />}
    </ProteccionSesion>
  );
}

function VistaConsultaRadicados({ usuario }) {
  const [radicados, setRadicados] = useState([]);
  const [dependencias, setDependencias] = useState([]);
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [soloHoy, setSoloHoy] = useState(false);
  const [filtroComunicacion, setFiltroComunicacion] = useState("");
  const [cargando, setCargando] = useState(true);
  const [mensajeError, setMensajeError] = useState("");
  const [dependenciaAlertas, setDependenciaAlertas] = useState("");
  const [resumenAlertas, setResumenAlertas] = useState({
    porVencer: [],
    vencidos: [],
  });
  const [estadoAlertas, setEstadoAlertas] = useState(
    "Elige una dependencia para consultar alertas.",
  );
  const [radicadoSeleccionado, setRadicadoSeleccionado] = useState(null);
  const [archivoAdjunto, setArchivoAdjunto] = useState({
    url: "",
    estado: "",
    documentos: [],
  });
  const [urlComprobante, setUrlComprobante] = useState("");
  const [respuestaSeleccionada, setRespuestaSeleccionada] = useState(null);
  const [textoRespuesta, setTextoRespuesta] = useState("");
  const [plantillaRespuesta, setPlantillaRespuesta] = useState("");
  // Guardamos la selección en una lista porque el formulario permite varios PDF.
  const [archivosRespuesta, setArchivosRespuesta] = useState([]);
  const [enviandoRespuesta, setEnviandoRespuesta] = useState(false);
  const [mensajeRespuesta, setMensajeRespuesta] = useState("");
  const [respuestaConsultada, setRespuestaConsultada] = useState(null);
  const dialogoDetalle = useRef(null);
  const dialogoComprobante = useRef(null);
  const dialogoRespuesta = useRef(null);
  const entradaArchivosRespuesta = useRef(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      solicitarApi("/api/radicados").then((respuesta) => respuesta.json()),
      solicitarApi("/api/dependencias").then((respuesta) => respuesta.json()),
    ])
      .then(([resultadoRadicados, resultadoDependencias]) => {
        if (!vigente) return;
        if (
          resultadoRadicados.success !== true ||
          !Array.isArray(resultadoRadicados.radicados)
        )
          throw new Error(
            "La respuesta de radicados no tiene el formato esperado.",
          );
        setRadicados(resultadoRadicados.radicados);
        setDependencias(resultadoDependencias.dependencias || []);
        if (usuario.rol === "funcionario")
          setDependenciaAlertas(String(usuario.dependencia_id));
        setCargando(false);
      })
      .catch((error) => {
        if (!vigente) return;
        setMensajeError(error.message);
        setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [usuario.id, usuario.rol, usuario.dependencia_id]);

  const claveFechaHoy = obtenerFechaBogota(new Date());
  const radicadosVisibles = useMemo(() => {
    const q = normalizarTexto(textoBusqueda.trim());
    return radicados.filter((radicado) => {
      const coincideBusqueda = [
        "numero_radicado",
        "remitente_nombre",
        "remitente_documento",
        "remitente_nit",
      ].some((key) => normalizarTexto(radicado[key]).includes(q));
      const fecha = obtenerFechaBogota(radicado.fecha_creacion);
      return (
        coincideBusqueda &&
        (!soloCriticos || estaEnEstadoCritico(radicado)) &&
        (!soloHoy || fecha === claveFechaHoy) &&
        (!filtroComunicacion ||
          obtenerTipoComunicacion(radicado) === filtroComunicacion)
      );
    });
  }, [
    radicados,
    textoBusqueda,
    soloCriticos,
    soloHoy,
    filtroComunicacion,
    claveFechaHoy,
  ]);

  async function cargarAlertas() {
    if (!dependenciaAlertas) {
      setEstadoAlertas("Elige una dependencia para consultar alertas.");
      return;
    }
    setEstadoAlertas("Consultando alertas…");
    try {
      const respuesta = await solicitarApi(
        `/api/alertas?dependencia_id=${encodeURIComponent(dependenciaAlertas)}`,
      );
      const resultado = await respuesta.json();
      setResumenAlertas({
        porVencer: (resultado.alertas || []).filter(
          (radicado) => radicado.semaforo?.nivel === "alerta",
        ),
        vencidos: (resultado.alertas || []).filter(
          (radicado) => radicado.semaforo?.nivel === "vencido",
        ),
      });
      setEstadoAlertas(
        `${resultado.alertas?.length || 0} alertas encontradas.`,
      );
    } catch (error) {
      setEstadoAlertas(error.message);
    }
  }

  useEffect(() => {
    if (dependenciaAlertas) cargarAlertas();
  }, [usuario.rol, dependenciaAlertas]);

  useEffect(() => {
    if (
      radicadoSeleccionado &&
      dialogoDetalle.current &&
      !dialogoDetalle.current.open
    )
      dialogoDetalle.current.showModal();
    if (!radicadoSeleccionado && dialogoDetalle.current?.open)
      dialogoDetalle.current.close();
  }, [radicadoSeleccionado]);

  useEffect(() => {
    if (
      urlComprobante &&
      dialogoComprobante.current &&
      !dialogoComprobante.current.open
    )
      dialogoComprobante.current.showModal();
    if (!urlComprobante && dialogoComprobante.current?.open)
      dialogoComprobante.current.close();
  }, [urlComprobante]);

  useEffect(() => {
    if (
      (respuestaSeleccionada || respuestaConsultada) &&
      dialogoRespuesta.current &&
      !dialogoRespuesta.current.open
    )
      dialogoRespuesta.current.showModal();
    if (
      !respuestaSeleccionada &&
      !respuestaConsultada &&
      dialogoRespuesta.current?.open
    )
      dialogoRespuesta.current.close();
  }, [respuestaSeleccionada, respuestaConsultada]);

  useEffect(
    () => () => {
      // Los enlaces blob son temporales; liberamos memoria al cerrar o cambiar la respuesta.
      (respuestaConsultada?.documentos || []).forEach((documento) => {
        if (documento.url) URL.revokeObjectURL(documento.url);
      });
    },
    [respuestaConsultada],
  );

  function abrirFormularioRespuesta(radicado) {
    setTextoRespuesta("");
    setPlantillaRespuesta("");
    setArchivosRespuesta([]);
    if (entradaArchivosRespuesta.current)
      entradaArchivosRespuesta.current.value = "";
    setMensajeRespuesta("");
    setRespuestaSeleccionada(radicado);
  }

  async function enviarRespuesta(evento) {
    evento.preventDefault();
    if (!respuestaSeleccionada || !textoRespuesta.trim()) return;
    setEnviandoRespuesta(true);
    setMensajeRespuesta("Enviando respuesta…");
    try {
      const datos = new FormData();
      datos.append("contenido", textoRespuesta.trim());
      datos.append("plantilla", plantillaRespuesta);
      // El nombre del campo debe coincidir con uploadRespuesta.array("archivos") del backend.
      archivosRespuesta.forEach((archivo) => datos.append("archivos", archivo));
      const respuesta = await solicitarApi(
        `/api/radicados/${encodeURIComponent(respuestaSeleccionada.numero_radicado)}/respuesta`,
        { method: "POST", body: datos },
      );
      const resultado = await respuesta.json();
      if (!respuesta.ok || resultado.success !== true)
        throw new Error(resultado.message || "No se pudo enviar la respuesta.");
      setRadicados((actual) =>
        actual.map((fila) =>
          fila.numero_radicado === respuestaSeleccionada.numero_radicado
            ? {
                ...fila,
                estado: resultado.estado,
                fecha_respuesta: resultado.fecha_respuesta,
                semaforo: resultado.semaforo,
              }
            : fila,
        ),
      );
      setMensajeRespuesta("Respuesta enviada y registrada.");
      setRespuestaSeleccionada(null);
    } catch (error) {
      setMensajeRespuesta(error.message);
    } finally {
      setEnviandoRespuesta(false);
    }
  }

  async function consultarRespuesta(radicado) {
    setRespuestaSeleccionada(null);
    setRespuestaConsultada({ radicado, cargando: true, documentos: [] });
    const documentosCargados = [];
    try {
      const respuestaApi = await solicitarApi(
        `/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/respuesta`,
      );
      const resultado = await respuestaApi.json();
      // /uploads está protegido: cada PDF se obtiene con el token de sesión.
      const documentos = [];
      for (const documento of resultado.respuesta.documentos || []) {
        // Codificamos cada segmento por separado para conservar la carpeta en la URL.
        const rutaArchivo = documento.ruta_archivo
          .split("/")
          .map(encodeURIComponent)
          .join("/");
        const archivo = await solicitarApi(`/uploads/${rutaArchivo}`);
        const url = URL.createObjectURL(await archivo.blob());
        documentosCargados.push(url);
        documentos.push({ ...documento, url });
      }
      setRespuestaConsultada({
        radicado,
        ...resultado.respuesta,
        documentos,
        cargando: false,
      });
    } catch (error) {
      documentosCargados.forEach((url) => URL.revokeObjectURL(url));
      setRespuestaConsultada(null);
      window.alert(`No se pudo consultar la respuesta. ${error.message}`);
    }
  }

  useEffect(
    () => () => {
      if (archivoAdjunto.url) URL.revokeObjectURL(archivoAdjunto.url);
    },
    [archivoAdjunto.url],
  );
  useEffect(
    () => () => {
      if (urlComprobante) URL.revokeObjectURL(urlComprobante);
    },
    [urlComprobante],
  );

  async function abrirDetalle(radicado) {
    setRadicadoSeleccionado(radicado);
    setArchivoAdjunto({
      url: "",
      documentos: [],
      estado: "Cargando documentos…",
    });
    try {
      const respuesta = await solicitarApi(
        `/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/documentos`,
      );
      const resultado = await respuesta.json();
      const documentos = resultado.documentos || [];
      setArchivoAdjunto({
        url: "",
        documentos,
        estado: documentos.length
          ? `${documentos.length} documento(s) disponible(s).`
          : "Este radicado no tiene documentos adjuntos.",
      });
    } catch (error) {
      setArchivoAdjunto({
        url: "",
        documentos: [],
        estado: `No se pudo abrir el soporte. ${error.message}`,
      });
    }
  }

  async function abrirDocumentoAdjunto(documento) {
    try {
      const rutaArchivo = documento.ruta_archivo
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const respuesta = await solicitarApi(`/uploads/${rutaArchivo}`);
      const url = URL.createObjectURL(await respuesta.blob());
      setArchivoAdjunto((actual) => {
        if (actual.url) URL.revokeObjectURL(actual.url);
        return {
          ...actual,
          url,
          estado: `Vista previa: ${documento.nombre_archivo}`,
        };
      });
    } catch (error) {
      setArchivoAdjunto((actual) => ({
        ...actual,
        estado: `No se pudo abrir el documento. ${error.message}`,
      }));
    }
  }

  async function cambiarEstado(radicado, nuevoEstado) {
    const estadoAnterior = radicado.estado || "Recibido";
    setRadicados((actual) =>
      actual.map((fila) =>
        fila.numero_radicado === radicado.numero_radicado
          ? { ...fila, estado: nuevoEstado }
          : fila,
      ),
    );
    try {
      const respuesta = await solicitarApi(
        `/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/estado`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: nuevoEstado }),
        },
      );
      const resultado = await respuesta.json();
      setRadicados((actual) =>
        actual.map((fila) =>
          fila.numero_radicado === radicado.numero_radicado
            ? {
                ...fila,
                estado: resultado.estado,
                semaforo: resultado.semaforo,
              }
            : fila,
        ),
      );
    } catch (error) {
      setRadicados((actual) =>
        actual.map((fila) =>
          fila.numero_radicado === radicado.numero_radicado
            ? { ...fila, estado: estadoAnterior }
            : fila,
        ),
      );
      window.alert(error.message);
    }
  }

  function mostrarComprobante(radicado) {
    try {
      const fecha = convertirFechaLocal(radicado.fecha_creacion);
      if (!fecha) throw new Error("El radicado no tiene fecha válida.");
      const pdf = crearPdfComprobante({
        ...radicado,
        fecha_hora: fecha.toLocaleString("es-CO"),
      });
      if (urlComprobante) URL.revokeObjectURL(urlComprobante);
      setUrlComprobante(URL.createObjectURL(pdf.output("blob")));
    } catch (error) {
      window.alert(`No se pudo generar el comprobante. ${error.message}`);
    }
  }

  const radicadosHoy = radicados.filter(
    (radicado) =>
      convertirFechaLocal(radicado.fecha_creacion)?.toLocaleDateString(
        "en-CA",
      ) === claveFechaHoy,
  ).length;
  const radicadosCriticos = radicados.filter(estaEnEstadoCritico).length;
  const hayFiltrosActivos =
    soloCriticos || soloHoy || filtroComunicacion || textoBusqueda.trim();

  return (
    <div className="page-consult app-page">
      <EncabezadoAplicacion usuario={usuario} pantallaActual="consultar" />
      <main className="consult-main">
        <div className="consult-heading">
          <h1>Listado de documentos recibidos</h1>
          {usuario.rol !== "funcionario" && (
            <a href="index.html">← Registrar nuevo radicado</a>
          )}
        </div>

        <section className="dashboard-cards" aria-label="Resumen y filtros">
          <button
            className={`dashboard-card ${soloCriticos ? "filtro-activo" : ""}`}
            type="button"
            aria-pressed={soloCriticos}
            onClick={() => setSoloCriticos((valor) => !valor)}
          >
            <span>Total / críticos</span>
            <strong>{radicados.length}</strong>
            <small>{radicadosCriticos} en alerta o vencidos</small>
          </button>
          <button
            className={`dashboard-card ${soloHoy ? "filtro-activo" : ""}`}
            type="button"
            aria-pressed={soloHoy}
            onClick={() => setSoloHoy((valor) => !valor)}
          >
            <span>Registrados hoy</span>
            <strong>{radicadosHoy}</strong>
            <small>Activar o quitar filtro de hoy</small>
          </button>
          <label className="dashboard-card">
            <span>Tipo de comunicación</span>
            <select
              id="filtro-tipo-comunicacion"
              name="filtro_tipo_comunicacion"
              value={filtroComunicacion}
              onChange={(evento) => setFiltroComunicacion(evento.target.value)}
              disabled={cargando}
            >
              <option value="">Todos</option>
              <option value="interna">Interna</option>
              <option value="externa">Externa</option>
              <option value="sin-tipo">No especificado</option>
            </select>
          </label>
        </section>

        <section className="consult-filters">
          <input
            id="busqueda-radicados"
            name="busqueda_radicados"
            value={textoBusqueda}
            onChange={(evento) => setTextoBusqueda(evento.target.value)}
            disabled={cargando}
            placeholder="Buscar por radicado, documento o remitente…"
            aria-label="Buscar radicados"
          />
          <div>
            <p role="status" aria-live="polite">
              {cargando
                ? "Cargando radicados…"
                : mensajeError
                  ? `No se pudieron cargar radicados. ${mensajeError}`
                  : `Mostrando ${radicadosVisibles.length} de ${radicados.length}. ${hayFiltrosActivos ? "Hay filtros activos." : "Sin filtros activos."}`}
            </p>
            <button
              type="button"
              onClick={() => {
                setTextoBusqueda("");
                setSoloCriticos(false);
                setSoloHoy(false);
                setFiltroComunicacion("");
              }}
              disabled={!hayFiltrosActivos}
            >
              Limpiar filtros
            </button>
          </div>
        </section>

        <section className="table-card">
          <div className="table-scroll">
            <table id="tabla-radicados">
              <thead>
                <tr>
                  <th>Radicado</th>
                  <th>Tipo / fecha</th>
                  <th>Remitente</th>
                  <th>Semáforo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="6">Cargando radicados…</td>
                  </tr>
                ) : mensajeError ? (
                  <tr>
                    <td colSpan="6" className="text-red-500">
                      {mensajeError}
                    </td>
                  </tr>
                ) : radicadosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan="6">No se encontraron registros.</td>
                  </tr>
                ) : (
                  radicadosVisibles.map((radicado) => (
                    <tr key={radicado.numero_radicado}>
                      <td>
                        <button
                          className="ver-detalle"
                          type="button"
                          onClick={() => abrirDetalle(radicado)}
                        >
                          {radicado.numero_radicado}
                        </button>
                      </td>
                      <td>
                        <span
                          className={`badge-comunicacion badge-comunicacion--${obtenerTipoComunicacion(radicado)}`}
                        >
                          {obtenerTipoComunicacion(radicado)}
                        </span>
                        <small>
                          {convertirFechaLocal(
                            radicado.fecha_creacion,
                          )?.toLocaleString("es-CO") || "Fecha no disponible"}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {radicado.remitente_nombre || "No registrado"}
                        </strong>
                        <small>
                          CC/NIT:{" "}
                          {radicado.remitente_documento ||
                            radicado.remitente_nit ||
                            "N/A"}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`semaforo semaforo--${radicado.semaforo?.nivel === "completado" ? "verde" : radicado.semaforo?.nivel === "vencido" ? "rojo" : radicado.semaforo?.nivel === "alerta" ? "amarillo" : radicado.semaforo?.nivel === "a_tiempo" ? "verde" : "sin-calcular"}`}
                        >
                          <i className="semaforo__dot" />
                          {radicado.semaforo?.texto || "Sin calcular"}
                        </span>
                      </td>
                      <td>
                        <select
                          id={`estado-radicado-${String(radicado.numero_radicado).replace(/[^A-Za-z0-9_-]/g, "-")}`}
                          name={`estado_radicado_${String(radicado.numero_radicado).replace(/[^A-Za-z0-9_-]/g, "_")}`}
                          aria-label={`Estado de ${radicado.numero_radicado}`}
                          disabled={usuario.rol === "ventanilla"}
                          value={radicado.estado || "Recibido"}
                          onChange={(evento) =>
                            cambiarEstado(radicado, evento.target.value)
                          }
                        >
                          {ESTADOS_POSIBLES.map((estadoPosible) => (
                            <option key={estadoPosible}>{estadoPosible}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className="generar-comprobante"
                          type="button"
                          onClick={() => mostrarComprobante(radicado)}
                        >
                          Ver comprobante
                        </button>
                        {usuario.rol !== "ventanilla" &&
                          radicado.estado !== "Respondido" && (
                            <button
                              type="button"
                              className="generar-comprobante"
                              onClick={() => abrirFormularioRespuesta(radicado)}
                            >
                              Responder
                            </button>
                          )}
                        {radicado.estado === "Respondido" && (
                          <button
                            type="button"
                            className="generar-comprobante"
                            onClick={() => consultarRespuesta(radicado)}
                          >
                            Ver respuesta
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          id="seccion-alertas"
          className="alerts-card"
          aria-labelledby="alertas-titulo"
        >
          <h2 id="alertas-titulo">Alertas por dependencia</h2>
          <div className="alerts-controls">
            <label htmlFor="alertas-dependencia">Dependencia</label>
            <select
              id="alertas-dependencia"
              name="dependencia_alertas"
              value={dependenciaAlertas}
              disabled={usuario.rol === "funcionario"}
              onChange={(evento) => setDependenciaAlertas(evento.target.value)}
            >
              <option value="">Selecciona una dependencia</option>
              {dependencias.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!dependenciaAlertas}
              onClick={cargarAlertas}
            >
              Actualizar alertas
            </button>
          </div>
          <MensajeEstado>{estadoAlertas}</MensajeEstado>
          <div className="alerts-columns">
            <div>
              <h3>Próximos a vencer</h3>
              <ul>
                {resumenAlertas.porVencer.map((radicado) => (
                  <li key={radicado.numero_radicado}>
                    {radicado.numero_radicado} · {radicado.remitente_nombre} ·{" "}
                    {radicado.semaforo?.texto}
                  </li>
                ))}
                {resumenAlertas.porVencer.length === 0 && (
                  <li>Sin alertas en este grupo.</li>
                )}
              </ul>
            </div>
            <div>
              <h3>Vencidos</h3>
              <ul>
                {resumenAlertas.vencidos.map((radicado) => (
                  <li key={radicado.numero_radicado}>
                    {radicado.numero_radicado} · {radicado.remitente_nombre} ·{" "}
                    {radicado.semaforo?.texto}
                  </li>
                ))}
                {resumenAlertas.vencidos.length === 0 && (
                  <li>Sin alertas en este grupo.</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      </main>
      <PiePagina />

      <dialog
        ref={dialogoDetalle}
        id="modal-detalle"
        onClose={() => {
          setRadicadoSeleccionado(null);
          if (archivoAdjunto.url) URL.revokeObjectURL(archivoAdjunto.url);
          setArchivoAdjunto({ url: "", estado: "" });
        }}
      >
        {radicadoSeleccionado && (
          <div className="modal-dialog">
            <div className="modal-header">
              <h2>
                Detalle del radicado: {radicadoSeleccionado.numero_radicado}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => dialogoDetalle.current?.close()}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <CampoDetalle
                etiqueta="Fecha de radicación"
                valor={convertirFechaLocal(
                  radicadoSeleccionado.fecha_creacion,
                )?.toLocaleString("es-CO")}
              />
              <CampoDetalle
                etiqueta="Estado"
                valor={radicadoSeleccionado.estado || "Recibido"}
              />
              <CampoDetalle
                etiqueta="Remitente"
                valor={radicadoSeleccionado.remitente_nombre}
              />
              <CampoDetalle
                etiqueta="Documento"
                valor={
                  radicadoSeleccionado.remitente_documento ||
                  radicadoSeleccionado.remitente_nit
                }
              />
              <CampoDetalle
                etiqueta="Dependencia destino"
                valor={radicadoSeleccionado.dependencia_destino}
              />
              <CampoDetalle
                etiqueta="Tiempo de respuesta"
                valor={radicadoSeleccionado.tiempo_de_respuesta}
              />
              <CampoDetalle
                etiqueta="Fecha límite"
                valor={radicadoSeleccionado.fecha_limite_actual}
              />
              <CampoDetalle
                etiqueta="Fundamento legal"
                valor={radicadoSeleccionado.fundamento_legal_aplicado}
              />
              <CampoDetalle
                etiqueta="Teléfono"
                valor={radicadoSeleccionado.remitente_telefono}
              />
              <CampoDetalle
                etiqueta="Correo"
                valor={radicadoSeleccionado.remitente_email}
              />
              <div className="modal-field">
                <strong>Asunto</strong>
                <p>
                  {radicadoSeleccionado.asunto_documento ||
                    "Sin observaciones."}
                </p>
              </div>
              <section>
                <h3>Documentos adjuntos</h3>
                <p role="status">{archivoAdjunto.estado}</p>
                {archivoAdjunto.documentos.map((documento) => (
                  <p key={documento.id}>
                    <button
                      type="button"
                      onClick={() => abrirDocumentoAdjunto(documento)}
                    >
                      Ver {documento.nombre_archivo || "archivo PDF"}
                    </button>
                  </p>
                ))}
                {archivoAdjunto.url && (
                  <>
                    <a
                      href={archivoAdjunto.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir PDF en otra pestaña
                    </a>
                    <iframe
                      title="Documento adjunto"
                      src={archivoAdjunto.url}
                    />
                  </>
                )}
              </section>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => dialogoDetalle.current?.close()}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={dialogoRespuesta}
        className="respuesta-dialog"
        onClose={() => {
          setRespuestaSeleccionada(null);
          setRespuestaConsultada(null);
        }}
      >
        {respuestaConsultada && (
          <div className="modal-dialog">
            <div className="modal-header">
              <h2>
                Respuesta institucional ·{" "}
                {respuestaConsultada.radicado.numero_radicado}
              </h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => dialogoRespuesta.current?.close()}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              {respuestaConsultada.cargando ? (
                <p role="status">Cargando respuesta y documentos…</p>
              ) : (
                <>
                  <CampoDetalle
                    etiqueta="Respondida por"
                    valor={respuestaConsultada.funcionario_nombre}
                  />
                  <CampoDetalle
                    etiqueta="Fecha de envío"
                    valor={convertirFechaLocal(
                      respuestaConsultada.fecha_envio,
                    )?.toLocaleString("es-CO")}
                  />
                  <CampoDetalle
                    etiqueta="Plantilla"
                    valor={respuestaConsultada.plantilla || "Sin plantilla"}
                  />
                  <div className="modal-field">
                    <strong>Contenido de la respuesta</strong>
                    <p>{respuestaConsultada.contenido}</p>
                  </div>
                  <section>
                    <h3>Documentos adjuntos</h3>
                    {respuestaConsultada.documentos.length ? (
                      <ul>
                        {respuestaConsultada.documentos.map((documento) => (
                          <li key={documento.id}>
                            <a
                              href={documento.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {documento.nombre_archivo}
                            </a>
                            <span>
                              {" "}
                              ·{" "}
                              {(
                                Number(documento.tamano_bytes) /
                                (1024 * 1024)
                              ).toFixed(1)}{" "}
                              MB
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>La respuesta no tiene PDF adjuntos.</p>
                    )}
                  </section>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => dialogoRespuesta.current?.close()}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
        {respuestaSeleccionada && (
          <form className="modal-dialog" onSubmit={enviarRespuesta}>
            <div className="modal-header">
              <h2>
                Respuesta institucional ·{" "}
                {respuestaSeleccionada.numero_radicado}
              </h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={() => dialogoRespuesta.current?.close()}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <p>
                <strong>Asunto:</strong>{" "}
                {respuestaSeleccionada.asunto_documento || "Sin asunto"}
              </p>
              <p>
                <strong>Remitente:</strong>{" "}
                {respuestaSeleccionada.remitente_nombre || "No registrado"}
              </p>
              <label htmlFor="plantilla-respuesta">
                Plantilla institucional
              </label>
              <select
                id="plantilla-respuesta"
                value={plantillaRespuesta}
                onChange={(e) => {
                  const plantilla = e.target.value;
                  setPlantillaRespuesta(plantilla);
                  if (plantilla === "general")
                    setTextoRespuesta(
                      "En atención a su solicitud, nos permitimos informarle que ",
                    );
                  else if (plantilla === "informacion")
                    setTextoRespuesta(
                      "En atención a su solicitud, adjuntamos la información requerida. ",
                    );
                  else if (plantilla === "traslado")
                    setTextoRespuesta(
                      "De acuerdo con nuestras competencias, su solicitud fue trasladada a la dependencia correspondiente. ",
                    );
                }}
              >
                <option value="">Sin plantilla</option>
                <option value="general">Respuesta general</option>
                <option value="informacion">Entrega de información</option>
                <option value="traslado">Traslado por competencia</option>
              </select>
              <label htmlFor="contenido-respuesta">
                Contenido de la respuesta *
              </label>
              <textarea
                id="contenido-respuesta"
                required
                minLength={10}
                maxLength={10000}
                rows={8}
                value={textoRespuesta}
                onChange={(e) => setTextoRespuesta(e.target.value)}
                placeholder="Redacta la respuesta para el remitente…"
              />
              <label htmlFor="adjunto-respuesta">
                Documentos de respuesta (hasta 5 PDF, máximo 10 MB cada uno)
              </label>
              <input
                ref={entradaArchivosRespuesta}
                id="adjunto-respuesta"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={(e) => {
                  const seleccion = Array.from(e.target.files || []);
                  const pdfsValidos =
                    seleccion.length <= 5 &&
                    seleccion.every(
                      (archivo) =>
                        archivo.name.toLowerCase().endsWith(".pdf") &&
                        archivo.size <= 10 * 1024 * 1024,
                    );
                  if (!pdfsValidos) {
                    setMensajeRespuesta(
                      "Selecciona máximo 5 archivos PDF, cada uno de hasta 10 MB.",
                    );
                    e.target.value = "";
                    setArchivosRespuesta([]);
                    return;
                  }
                  setMensajeRespuesta("");
                  setArchivosRespuesta(seleccion);
                }}
              />
              {archivosRespuesta.length > 0 && (
                <ul aria-label="Archivos seleccionados">
                  {archivosRespuesta.map((archivo) => (
                    <li key={`${archivo.name}-${archivo.lastModified}`}>
                      {archivo.name} (
                      {(archivo.size / (1024 * 1024)).toFixed(1)} MB)
                    </li>
                  ))}
                </ul>
              )}
              <p role="status" aria-live="polite">
                {mensajeRespuesta}
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => dialogoRespuesta.current?.close()}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  enviandoRespuesta || textoRespuesta.trim().length < 10
                }
              >
                {enviandoRespuesta ? "Enviando…" : "Enviar respuesta"}
              </button>
            </div>
          </form>
        )}
      </dialog>

      <dialog
        ref={dialogoComprobante}
        className="receipt-dialog"
        onClose={() => {
          if (urlComprobante) URL.revokeObjectURL(urlComprobante);
          setUrlComprobante("");
        }}
      >
        <div className="comprobante-cabecera">
          <h2>Comprobante de recepción</h2>
          <button
            type="button"
            onClick={() => dialogoComprobante.current?.close()}
          >
            Cerrar
          </button>
        </div>
        {urlComprobante && (
          <iframe title="Vista previa del comprobante" src={urlComprobante} />
        )}
      </dialog>
    </div>
  );
}

function CampoDetalle({ etiqueta, valor }) {
  return (
    <div className="modal-field">
      <strong>{etiqueta}</strong>
      <p>{valor || "No registrado"}</p>
    </div>
  );
}
