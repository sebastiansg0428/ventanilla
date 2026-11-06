import { useEffect, useRef, useState } from "react";
import {
  EncabezadoAplicacion,
  PiePagina,
  ProteccionSesion,
  MensajeEstado,
  CeldaAdaptable,
} from "../componentes/Compartidos";
import { solicitarApi } from "../servicios/api";
import { crearPdfComprobante } from "../servicios/comprobante";
import { BandejaTraslados, SolicitudTraslado } from "../componentes/Traslados";
import { SeguimientoEntrega } from "../componentes/SeguimientoEntrega";
import { RespuestasInternas, TrazabilidadInterna } from "../componentes/RespuestasInternas";
import {
  obtenerFechaBogota,
  obtenerDiaRadicacion,
  formatearFechaRadicacion,
} from "../servicios/fechas";

const ESTADOS_POSIBLES = ["Recibido", "En trámite", "Pendiente"];
const NOMBRES_PLANTILLA = {
  general: "Respuesta general",
  informacion: "Entrega de información",
  traslado: "Traslado por competencia",
};
const requiereRespuesta = (radicado) =>
  radicado.requiere_respuesta !== false && radicado.requiere_respuesta !== 0;
const esFinal = (radicado) =>
  ["Respondido", "Enterado"].includes(radicado.estado);
const claveEstado = (radicado) =>
  `${radicado.numero_radicado}-${radicado.radicado_dependencia_id || "single"}`;
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
const ETIQUETAS_EVENTO = {
  radicado_creado: "Radicado recibido",
  radicado_asignado: "Asignado a dependencia",
  documentos_radicado_adjuntados: "Documentos originales adjuntados",
  estado_cambiado: "Cambio de estado",
  respuesta_enviada: "Respuesta institucional registrada",
  documentos_respuesta_adjuntados: "Documentos de respuesta adjuntados",
  termino_ampliado: "Término ampliado",
  regla_respuesta_aplicada: "Regla de respuesta aplicada",
  traslado_solicitado: "Traslado solicitado a Ventanilla",
  traslado_aprobado: "Traslado aprobado por Ventanilla",
  traslado_rechazado: "Traslado rechazado",
  traslado_cancelado: "Traslado cancelado por finalización",
  entrega_registrada: "Envío/entrega registrado",
  entrega_anulada: "Registro de entrega anulado",
  respuesta_interna_abierta: "Primera apertura de respuesta interna",
};
const DESCRIPCIONES_EVENTO = {
  radicado_creado: "Se registró el ingreso del documento al sistema.",
  radicado_asignado: "El expediente quedó asignado a la dependencia indicada.",
  documentos_radicado_adjuntados:
    "Se incorporaron documentos originales al expediente.",
  estado_cambiado: "Se actualizó el estado del expediente.",
  respuesta_enviada: "Se registró la respuesta institucional.",
  documentos_respuesta_adjuntados:
    "Se incorporaron documentos de soporte de la respuesta.",
  termino_ampliado: "Se amplió la fecha límite de respuesta.",
  regla_respuesta_aplicada:
    "Se configuró la regla de respuesta al registrar el radicado.",
  traslado_solicitado: "La dependencia solicitó la revisión de su asignación; el plazo continúa.",
  traslado_aprobado: "El control central cambió la dependencia responsable sin reiniciar plazos.",
  traslado_rechazado: "La dependencia de origen conserva la responsabilidad.",
  traslado_cancelado: "El expediente finalizó antes de resolver la solicitud.",
  entrega_registrada: "Se registró una actuación manual de envío o entrega.",
  entrega_anulada: "Se anuló una actuación; su evidencia se conserva.",
  respuesta_interna_abierta: "Un funcionario de la dependencia de origen abrió la respuesta interna en el sistema.",
};
function presentarFechaEvento(evento) {
  if (evento.ocurrido_en_utc) {
    const fechaUtc = new Date(
      `${String(evento.ocurrido_en_utc).replace(" ", "T")}Z`,
    );
    return Number.isNaN(fechaUtc.getTime())
      ? "Fecha UTC inválida"
      : new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota",
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(fechaUtc);
  }
  return evento.creado_en
    ? `${evento.creado_en} · zona horaria histórica no confirmada`
    : "Fecha histórica no disponible";
}
const nombreActor = (evento) =>
  evento.actor_name ||
  (evento.usuario
    ? /^\d+$/.test(String(evento.usuario))
      ? "Usuario histórico sin nombre registrado"
      : `Referencia histórica: ${evento.usuario}`
    : null) ||
  "No identificado en el registro histórico";
const CONTEXTO_DEPENDENCIA = {
  radicado_creado: "Dependencia destinataria",
  radicado_asignado: "Dependencia destinataria",
  documentos_radicado_adjuntados: "Dependencia destinataria",
  estado_cambiado: "Dependencia atendida",
  respuesta_enviada: "Dependencia atendida",
  documentos_respuesta_adjuntados: "Dependencia atendida",
  traslado_solicitado: "Oficina que solicita el traslado",
  traslado_aprobado: "Oficina de origen del traslado",
  traslado_rechazado: "Oficina de origen del traslado",
  traslado_cancelado: "Oficina de origen del traslado",
  respuesta_interna_abierta: "Dependencia de origen que abrió la respuesta",
};
function identidadActor(evento) {
  if (Number.isSafeInteger(evento.actor_id) && evento.actor_id > 0) {
    return `id:${evento.actor_id}:${evento.actor_name || ""}`;
  }
  if (evento.actor_id != null) return null;
  return evento.actor_name ? `nombre:${evento.actor_name}` : evento.usuario
    ? `historico:${evento.usuario}` : null;
}
function presentarMinutoEvento(evento) {
  if (!evento.ocurrido_en_utc) return presentarFechaEvento(evento);
  const fecha = new Date(`${String(evento.ocurrido_en_utc).replace(" ", "T")}Z`);
  if (Number.isNaN(fecha.getTime())) return "Fecha UTC inválida";
  return `${new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota", year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(fecha)} · Bogotá`;
}
const claseEstadoDetalle = (estado) =>
  normalizarTexto(estado || "Recibido").replace(/[^a-z0-9]+/g, "-");
function minutoEvento(evento) {
  // El minuto UTC coincide con el de Bogotá porque su desfase es de horas completas.
  const valor = evento.ocurrido_en_utc || evento.creado_en;
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(String(valor || ""))
    ? `${evento.ocurrido_en_utc ? "utc" : "local"}:${String(valor).slice(0, 16)}`
    : null;
}
// La agrupación visual no demuestra una única operación ni simultaneidad exacta.
function agruparEventos(eventos) {
  return eventos.reduce((grupos, evento) => {
    const anterior = grupos.at(-1)?.at(-1);
    const actor = identidadActor(evento);
    const minuto = minutoEvento(evento);
    if (
      anterior &&
      actor &&
      minuto &&
      identidadActor(anterior) === actor &&
      minutoEvento(anterior) === minuto
    ) {
      grupos.at(-1).push(evento);
    } else {
      grupos.push([evento]);
    }
    return grupos;
  }, []);
}

export function PaginaConsultaRadicados() {
  return (
    <ProteccionSesion>
      {(usuario) => <VistaConsultaRadicados usuario={usuario} />}
    </ProteccionSesion>
  );
}

function VistaConsultaRadicados({ usuario }) {
  const [solicitudTraslado, setSolicitudTraslado] = useState(null);
  const [mensajeTraslado, setMensajeTraslado] = useState("");
  const botonTraslado = useRef(null);
  const [radicados, setRadicados] = useState([]);
  const [dependencias, setDependencias] = useState([]);
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [soloHoy, setSoloHoy] = useState(false);
  const [filtroComunicacion, setFiltroComunicacion] = useState("");
  const [busquedaConsulta, setBusquedaConsulta] = useState("");
  const [navegacion, setNavegacion] = useState({ filtros: "", pagina: 1 });
  const [revisionConsulta, setRevisionConsulta] = useState(0);
  const [paginacion, setPaginacion] = useState({ total: 0, paginas: 0 });
  const [resumenConsulta, setResumenConsulta] = useState({ total: 0, hoy: 0, criticos: 0 });
  const [cargando, setCargando] = useState(true);
  const [mensajeError, setMensajeError] = useState("");
  const [guardandoEstados, setGuardandoEstados] = useState({});
  const [erroresEstado, setErroresEstado] = useState({});
  const estadosEnProceso = useRef(new Set());
  const [dependenciaAlertas, setDependenciaAlertas] = useState("");
  const [resumenAlertas, setResumenAlertas] = useState({
    porVencer: [],
    vencidos: [],
  });
  const [estadoAlertas, setEstadoAlertas] = useState(
    "Elige una dependencia para consultar alertas.",
  );
  const [paginaAlertas, setPaginaAlertas] = useState(1);
  const [paginacionAlertas, setPaginacionAlertas] = useState({ paginas: 0 });
  const [cargandoAlertas, setCargandoAlertas] = useState(false);
  const [consultaAlertasValida, setConsultaAlertasValida] = useState(false);
  const solicitudAlertas = useRef(0);
  const [radicadoSeleccionado, setRadicadoSeleccionado] = useState(null);
  const [archivoAdjunto, setArchivoAdjunto] = useState({
    url: "",
    estado: "",
    documentos: [],
  });
  const [historial, setHistorial] = useState({
    eventos: [],
    cargando: false,
    error: "",
    cursor: null,
    hayMas: false,
  });
  const [urlComprobante, setUrlComprobante] = useState("");
  const [generandoComprobante, setGenerandoComprobante] = useState(false);
  const solicitudComprobante = useRef(0);
  const comprobanteEnProceso = useRef(false);
  const [respuestaSeleccionada, setRespuestaSeleccionada] = useState(null);
  const [textoRespuesta, setTextoRespuesta] = useState("");
  const [plantillaRespuesta, setPlantillaRespuesta] = useState("");
  // Guardamos la selección en una lista porque el formulario permite varios PDF.
  const [archivosRespuesta, setArchivosRespuesta] = useState([]);
  const [errorArchivosRespuesta, setErrorArchivosRespuesta] = useState("");
  const [enviandoRespuesta, setEnviandoRespuesta] = useState(false);
  const [guardandoEntrega, setGuardandoEntrega] = useState(false);
  const [mensajeRespuesta, setMensajeRespuesta] = useState("");
  const [respuestaConsultada, setRespuestaConsultada] = useState(null);
  const dialogoDetalle = useRef(null);
  const tituloDetalle = useRef(null);
  const botonDetalle = useRef(null);
  const dialogoComprobante = useRef(null);
  const dialogoRespuesta = useRef(null);
  const tituloRespuesta = useRef(null);
  const entradaArchivosRespuesta = useRef(null);
  const solicitudDetalle = useRef(0);
  const solicitudHistorial = useRef(0);
  const solicitudDocumento = useRef(0);
  const solicitudRespuesta = useRef(0);
  const respuestaEnProceso = useRef(false);
  const urlsRespuestaEnCarga = useRef(new Set());

  function liberarUrlsRespuestaEnCarga() {
    urlsRespuestaEnCarga.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRespuestaEnCarga.current.clear();
  }

  useEffect(
    () => () => {
      solicitudDetalle.current += 1;
      solicitudHistorial.current += 1;
      solicitudDocumento.current += 1;
      solicitudRespuesta.current += 1;
      liberarUrlsRespuestaEnCarga();
    },
    [],
  );

  function cerrarDetalle() {
    solicitudDetalle.current += 1;
    solicitudHistorial.current += 1;
    solicitudDocumento.current += 1;
    setRadicadoSeleccionado(null);
    setArchivoAdjunto({ url: "", documentos: [], estado: "" });
    setHistorial({
      eventos: [],
      cargando: false,
      error: "",
      cursor: null,
      hayMas: false,
    });
    if (dialogoDetalle.current?.open) dialogoDetalle.current.close();
    if (botonDetalle.current?.isConnected) botonDetalle.current.focus();
  }

  function cerrarRespuesta() {
    if (respuestaEnProceso.current) return;
    solicitudRespuesta.current += 1;
    liberarUrlsRespuestaEnCarga();
    setRespuestaSeleccionada(null);
    setRespuestaConsultada(null);
    if (dialogoRespuesta.current?.open) dialogoRespuesta.current.close();
  }

  function cerrarComprobante() {
    solicitudComprobante.current += 1;
    comprobanteEnProceso.current = false;
    setGenerandoComprobante(false);
    setUrlComprobante("");
    if (dialogoComprobante.current?.open) dialogoComprobante.current.close();
  }

  function retirarVistasSinAcceso(error) {
    if (![403, 404].includes(error.status)) return false;
    respuestaEnProceso.current = false;
    setEnviandoRespuesta(false);
    cerrarDetalle();
    cerrarRespuesta();
    cerrarComprobante();
    setRevisionConsulta((valor) => valor + 1);
    window.alert(`El expediente o documento ya no está disponible para esta sesión. ${error.message}`);
    return true;
  }

  useEffect(() => {
    const temporizador = setTimeout(
      () => setBusquedaConsulta(textoBusqueda.trim()),
      250,
    );
    return () => clearTimeout(temporizador);
  }, [textoBusqueda]);

  const claveFechaHoy = obtenerFechaBogota(new Date());
  const filtrosConsulta = new URLSearchParams({
    busqueda: busquedaConsulta,
    criticos: soloCriticos ? "1" : "0",
    hoy: soloHoy ? "1" : "0",
    tipo_comunicacion: filtroComunicacion,
  }).toString();
  const paginaConsulta =
    navegacion.filtros === filtrosConsulta ? navegacion.pagina : 1;

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setMensajeError("");
    solicitarApi(
      `/api/radicados?pagina=${paginaConsulta}&limite=25&${filtrosConsulta}`,
    )
      .then((respuesta) => respuesta.json())
      .then((resultadoRadicados) => {
        if (!vigente) return;
        if (
          resultadoRadicados.success !== true ||
          !Array.isArray(resultadoRadicados.radicados) ||
          !Number.isInteger(resultadoRadicados.total) ||
          !Number.isInteger(resultadoRadicados.paginas) ||
          !resultadoRadicados.resumen ||
          !["total", "hoy", "criticos"].every((campo) =>
            Number.isInteger(resultadoRadicados.resumen[campo]),
          )
        )
          throw new Error(
            "La respuesta de radicados no tiene el formato esperado.",
          );
        setRadicados(resultadoRadicados.radicados);
        setPaginacion({
          total: resultadoRadicados.total,
          paginas: resultadoRadicados.paginas,
        });
        setResumenConsulta(resultadoRadicados.resumen);
        if (paginaConsulta > Math.max(1, resultadoRadicados.paginas)) {
          setNavegacion({
            filtros: filtrosConsulta,
            pagina: Math.max(1, resultadoRadicados.paginas),
          });
        }
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
  }, [
    usuario.id, usuario.rol, usuario.dependencia_id, paginaConsulta,
    filtrosConsulta, revisionConsulta, claveFechaHoy,
  ]);

  useEffect(() => {
    let vigente = true;
    solicitarApi("/api/dependencias")
      .then((respuesta) => respuesta.json())
      .then((resultadoDependencias) => {
        if (!vigente) return;
        if (
          resultadoDependencias.success !== true ||
          !Array.isArray(resultadoDependencias.dependencias)
        )
          throw new Error("No se pudieron cargar las dependencias.");
        setDependencias(resultadoDependencias.dependencias);
        if (usuario.rol === "funcionario")
          setDependenciaAlertas(String(usuario.dependencia_id));
      })
      .catch((error) => {
        if (!vigente) return;
        setEstadoAlertas(error.message);
      });
    return () => {
      vigente = false;
    };
  }, [usuario.id, usuario.rol, usuario.dependencia_id]);

  const radicadosVisibles = radicados;

  async function cargarAlertas() {
    if (!dependenciaAlertas) {
      setEstadoAlertas("Elige una dependencia para consultar alertas.");
      return;
    }
    const solicitud = ++solicitudAlertas.current;
    setCargandoAlertas(true);
    setConsultaAlertasValida(false);
    setResumenAlertas({ porVencer: [], vencidos: [] });
    setEstadoAlertas("Consultando alertas…");
    try {
      const respuesta = await solicitarApi(
        `/api/alertas?dependencia_id=${encodeURIComponent(dependenciaAlertas)}&pagina=${paginaAlertas}&limite=25`,
      );
      const resultado = await respuesta.json();
      if (solicitud !== solicitudAlertas.current) return;
      if (
        resultado.success !== true ||
        !Array.isArray(resultado.alertas) ||
        !Number.isInteger(resultado.total) ||
        !Number.isInteger(resultado.paginas)
      )
        throw new Error(
          resultado.message || "La respuesta de alertas no tiene el formato esperado.",
        );
      setResumenAlertas({
        porVencer: resultado.alertas.filter(
          (radicado) => radicado.semaforo?.nivel === "alerta",
        ),
        vencidos: resultado.alertas.filter(
          (radicado) => radicado.semaforo?.nivel === "vencido",
        ),
      });
      setEstadoAlertas(
        `${resultado.total} alertas encontradas. Mostrando ${resultado.alertas.length}.`,
      );
      setPaginacionAlertas({ paginas: resultado.paginas });
      setConsultaAlertasValida(true);
      if (paginaAlertas > Math.max(1, resultado.paginas))
        setPaginaAlertas(Math.max(1, resultado.paginas));
    } catch (error) {
      if (solicitud === solicitudAlertas.current) setEstadoAlertas(error.message);
    } finally {
      if (solicitud === solicitudAlertas.current) setCargandoAlertas(false);
    }
  }

  useEffect(() => {
    if (dependenciaAlertas) cargarAlertas();
    return () => {
      solicitudAlertas.current += 1;
    };
  }, [usuario.rol, dependenciaAlertas, paginaAlertas, revisionConsulta]);

  useEffect(() => {
    if (
      radicadoSeleccionado &&
      dialogoDetalle.current &&
      !dialogoDetalle.current.open
    ) {
      dialogoDetalle.current.showModal();
      tituloDetalle.current?.focus();
    }
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

  useEffect(() => {
    if (respuestaConsultada) tituloRespuesta.current?.focus();
  }, [respuestaSeleccionada, respuestaConsultada?.cargando]);

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
    if (respuestaEnProceso.current) return;
    solicitudRespuesta.current += 1;
    liberarUrlsRespuestaEnCarga();
    setRespuestaConsultada(null);
    setTextoRespuesta("");
    setPlantillaRespuesta("");
    setArchivosRespuesta([]);
    setErrorArchivosRespuesta("");
    if (entradaArchivosRespuesta.current)
      entradaArchivosRespuesta.current.value = "";
    setMensajeRespuesta("");
    setRespuestaSeleccionada(radicado);
  }

  function aceptarArchivosRespuesta(evento) {
    const seleccion = Array.from(evento.target.files || []);
    if (!seleccion.length) return;
    let error =
      seleccion.length > 5 ? "Puedes adjuntar máximo 5 archivos PDF." : "";
    for (const archivo of seleccion) {
      if (error) break;
      if (!archivo.name.toLowerCase().endsWith(".pdf")) {
        error = `El archivo "${archivo.name}" no tiene extensión PDF. Selecciona un documento .pdf.`;
      } else if (archivo.size === 0) {
        error = `El archivo "${archivo.name}" está vacío. Selecciona un PDF con contenido.`;
      } else if (archivo.size > 10 * 1024 * 1024) {
        error = `El archivo "${archivo.name}" pesa ${(archivo.size / 1024 / 1024).toFixed(2)} MB (${archivo.size} bytes) y supera el máximo de 10 MB (10485760 bytes) por archivo.`;
      }
    }
    setMensajeRespuesta("");
    setErrorArchivosRespuesta(error);
    if (error) {
      evento.target.value = "";
      return;
    }
    setArchivosRespuesta(seleccion);
  }

  async function enviarRespuesta(evento) {
    evento.preventDefault();
    if (
      respuestaEnProceso.current ||
      !respuestaSeleccionada ||
      !textoRespuesta.trim()
    )
      return;
    respuestaEnProceso.current = true;
    const solicitud = solicitudRespuesta.current;
    setEnviandoRespuesta(true);
    setMensajeRespuesta("Enviando respuesta…");
    try {
      const datos = new FormData();
      datos.append("contenido", textoRespuesta.trim());
      datos.append("plantilla", plantillaRespuesta);
      if (respuestaSeleccionada.radicado_dependencia_id)
        datos.append(
          "radicado_dependencia_id",
          respuestaSeleccionada.radicado_dependencia_id,
        );
      // El nombre del campo debe coincidir con uploadRespuesta.array("archivos") del backend.
      archivosRespuesta.forEach((archivo) => datos.append("archivos", archivo));
      const respuesta = await solicitarApi(
        `/api/radicados/${encodeURIComponent(respuestaSeleccionada.numero_radicado)}/respuesta`,
        { method: "POST", body: datos },
      );
      const resultado = await respuesta.json();
      if (solicitud !== solicitudRespuesta.current) return;
      if (!respuesta.ok || resultado.success !== true)
        throw new Error(resultado.message || "No se pudo enviar la respuesta.");
      setRadicados((actual) =>
        actual.map((fila) =>
          (
            respuestaSeleccionada.radicado_dependencia_id
              ? fila.radicado_dependencia_id ===
                respuestaSeleccionada.radicado_dependencia_id
              : fila.numero_radicado === respuestaSeleccionada.numero_radicado
          )
            ? {
                ...fila,
                estado: resultado.estado,
                fecha_respuesta: resultado.fecha_respuesta,
                semaforo: resultado.semaforo,
              }
            : fila,
        ),
      );
      setRevisionConsulta((valor) => valor + 1);
      setEnviandoRespuesta(false);
      respuestaEnProceso.current = false;
      consultarRespuesta({
        ...respuestaSeleccionada,
        estado: resultado.estado,
        fecha_respuesta: resultado.fecha_respuesta,
        semaforo: resultado.semaforo,
      }, { guardada: true });
    } catch (error) {
      if (solicitud === solicitudRespuesta.current && retirarVistasSinAcceso(error)) return;
      if (solicitud === solicitudRespuesta.current)
        setMensajeRespuesta(error.message);
    } finally {
      respuestaEnProceso.current = false;
      if (solicitud === solicitudRespuesta.current) setEnviandoRespuesta(false);
    }
  }

  async function consultarRespuesta(radicado, { guardada = false } = {}) {
    if (respuestaEnProceso.current) return;
    const solicitud = ++solicitudRespuesta.current;
    liberarUrlsRespuestaEnCarga();
    setRespuestaSeleccionada(null);
    setRespuestaConsultada({ radicado, guardada, cargando: true, documentos: [] });
    const documentosCargados = [];
    let publicados = false;
    try {
      const respuestaApi = await solicitarApi(
        `/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/respuesta${radicado.radicado_dependencia_id ? `?radicado_dependencia_id=${encodeURIComponent(radicado.radicado_dependencia_id)}` : ""}`,
      );
      const resultado = await respuestaApi.json();
      if (solicitud !== solicitudRespuesta.current) return;
      // /uploads está protegido: cada PDF se obtiene con el token de sesión.
      const documentos = [];
      for (const documento of resultado.respuesta.documentos || []) {
        // Codificamos cada segmento por separado para conservar la carpeta en la URL.
        const rutaArchivo = documento.ruta_archivo
          .split("/")
          .map(encodeURIComponent)
          .join("/");
        const archivo = await solicitarApi(`/uploads/${rutaArchivo}`);
        const blob = await archivo.blob();
        if (solicitud !== solicitudRespuesta.current) return;
        const url = URL.createObjectURL(blob);
        documentosCargados.push(url);
        urlsRespuestaEnCarga.current.add(url);
        documentos.push({ ...documento, url });
      }
      setRespuestaConsultada({
        radicado,
        ...resultado.respuesta,
        guardada,
        documentos,
        cargando: false,
      });
      publicados = true;
      documentosCargados.forEach((url) =>
        urlsRespuestaEnCarga.current.delete(url),
      );
    } catch (error) {
      if (solicitud !== solicitudRespuesta.current) return;
      if (retirarVistasSinAcceso(error)) return;
      if (guardada) {
        setRespuestaConsultada({
          radicado, guardada, cargando: false, documentos: [],
          error: `No se pudo cargar la respuesta o sus documentos. ${error.message}`,
        });
      } else {
        setRespuestaConsultada(null);
        window.alert(`No se pudo consultar la respuesta. ${error.message}`);
      }
    } finally {
      if (!publicados)
        documentosCargados.forEach((url) => {
          if (urlsRespuestaEnCarga.current.delete(url))
            URL.revokeObjectURL(url);
        });
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
    const solicitud = ++solicitudDetalle.current;
    const solicitudAuditoria = ++solicitudHistorial.current;
    solicitudDocumento.current += 1;
    setRadicadoSeleccionado(radicado);
    setArchivoAdjunto({
      url: "",
      documentos: [],
      estado: "Cargando documentos…",
    });
    setHistorial({
      eventos: [],
      cargando: true,
      error: "",
      cursor: null,
      hayMas: false,
    });
    cargarHistorial(radicado, solicitudAuditoria, null, false);
    try {
      const respuesta = await solicitarApi(
        `/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/documentos`,
      );
      const resultado = await respuesta.json();
      if (solicitud !== solicitudDetalle.current) return;
      const documentos = resultado.documentos || [];
      setArchivoAdjunto({
        url: "",
        documentos,
        estado: documentos.length
          ? `${documentos.length} documento(s) disponible(s).`
          : "Este radicado no tiene documentos adjuntos.",
      });
    } catch (error) {
      if (solicitud !== solicitudDetalle.current) return;
      if (retirarVistasSinAcceso(error)) return;
      setArchivoAdjunto({
        url: "",
        documentos: [],
        estado: `No se pudo abrir el soporte. ${error.message}`,
      });
    }
  }

  async function cargarHistorial(radicado, solicitud, cursor, anexar) {
    try {
      const parametros = new URLSearchParams({ limite: "25" });
      if (cursor) parametros.set("cursor", String(cursor));
      const respuesta = await solicitarApi(
        `/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/historial?${parametros}`,
      );
      const resultado = await respuesta.json();
      if (solicitud !== solicitudHistorial.current) return;
      const eventos = resultado.historial || [];
      setHistorial((actual) => ({
        eventos: anexar ? [...actual.eventos, ...eventos] : eventos,
        cargando: false,
        error: "",
        cursor: resultado.next_cursor ?? null,
        hayMas: resultado.has_more === true,
      }));
    } catch (error) {
      if (solicitud !== solicitudHistorial.current) return;
      if (retirarVistasSinAcceso(error)) return;
      setHistorial((actual) => ({
        ...actual,
        cargando: false,
        error: error.message,
      }));
    }
  }

  function cargarMasHistorial() {
    if (
      !radicadoSeleccionado ||
      historial.cargando ||
      !historial.hayMas ||
      !historial.cursor
    )
      return;
    setHistorial((actual) => ({ ...actual, cargando: true, error: "" }));
    cargarHistorial(
      radicadoSeleccionado,
      solicitudHistorial.current,
      historial.cursor,
      true,
    );
  }

  async function abrirDocumentoAdjunto(documento) {
    const solicitud = ++solicitudDocumento.current;
    try {
      const rutaArchivo = documento.ruta_archivo
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const respuesta = await solicitarApi(`/uploads/${rutaArchivo}`);
      const blob = await respuesta.blob();
      if (solicitud !== solicitudDocumento.current) return;
      const url = URL.createObjectURL(blob);
      setArchivoAdjunto((actual) => {
        return {
          ...actual,
          url,
          estado: `Vista previa: ${documento.nombre_archivo}`,
        };
      });
    } catch (error) {
      if (solicitud !== solicitudDocumento.current) return;
      if (retirarVistasSinAcceso(error)) return;
      setArchivoAdjunto((actual) => ({
        ...actual,
        estado: `No se pudo abrir el documento. ${error.message}`,
      }));
    }
  }

  async function cambiarEstado(radicado, nuevoEstado) {
    const clave = claveEstado(radicado);
    if (estadosEnProceso.current.has(clave)) return;
    estadosEnProceso.current.add(clave);
    setGuardandoEstados((actual) => ({ ...actual, [clave]: true }));
    setErroresEstado((actual) => ({ ...actual, [clave]: "" }));
    const estadoAnterior = radicado.estado || "Recibido";
    setRadicados((actual) =>
      actual.map((fila) =>
        (
          radicado.radicado_dependencia_id
            ? fila.radicado_dependencia_id === radicado.radicado_dependencia_id
            : fila.numero_radicado === radicado.numero_radicado
        )
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
          body: JSON.stringify({
            estado: nuevoEstado,
            radicado_dependencia_id: radicado.radicado_dependencia_id || null,
          }),
        },
      );
      const resultado = await respuesta.json();
      if (resultado.success === false || !resultado.estado)
        throw new Error(resultado.message || "No se pudo guardar el estado.");
      setRadicados((actual) =>
        actual.map((fila) =>
          (
            radicado.radicado_dependencia_id
              ? fila.radicado_dependencia_id ===
                radicado.radicado_dependencia_id
              : fila.numero_radicado === radicado.numero_radicado
          )
            ? {
                ...fila,
                estado: resultado.estado,
                semaforo: resultado.semaforo,
                fecha_enterado: resultado.fecha_enterado,
              }
            : fila,
        ),
      );
      setRevisionConsulta((valor) => valor + 1);
    } catch (error) {
      if (retirarVistasSinAcceso(error)) return;
      setRadicados((actual) =>
        actual.map((fila) =>
          (
            radicado.radicado_dependencia_id
              ? fila.radicado_dependencia_id ===
                radicado.radicado_dependencia_id
              : fila.numero_radicado === radicado.numero_radicado
          )
            ? { ...fila, estado: estadoAnterior }
            : fila,
        ),
      );
      window.alert(error.message);
      setErroresEstado((actual) => ({ ...actual, [clave]: error.message }));
    } finally {
      estadosEnProceso.current.delete(clave);
      setGuardandoEstados((actual) => ({ ...actual, [clave]: false }));
    }
  }

  useEffect(
    () => () => {
      solicitudComprobante.current += 1;
    },
    [],
  );

  async function mostrarComprobante(radicado) {
    if (comprobanteEnProceso.current) return;
    comprobanteEnProceso.current = true;
    setGenerandoComprobante(true);
    const solicitud = ++solicitudComprobante.current;
    try {
      if (!obtenerDiaRadicacion(radicado))
        throw new Error("El radicado no tiene fecha válida.");
      const pdf = await crearPdfComprobante({
        ...radicado,
        fecha_hora: formatearFechaRadicacion(radicado),
      });
      if (solicitud !== solicitudComprobante.current) return;
      setUrlComprobante(URL.createObjectURL(pdf.output("blob")));
    } catch (error) {
      if (solicitud === solicitudComprobante.current) {
        window.alert(`No se pudo generar el comprobante. ${error.message}`);
      }
    } finally {
      if (solicitud === solicitudComprobante.current) {
        comprobanteEnProceso.current = false;
        setGenerandoComprobante(false);
      }
    }
  }

  const radicadosHoy = resumenConsulta.hoy;
  const radicadosCriticos = resumenConsulta.criticos;
  const hayFiltrosActivos =
    soloCriticos || soloHoy || filtroComunicacion || textoBusqueda.trim();
  const filtrosActivos = [
    soloHoy
      ? {
          key: "hoy",
          label: "Fecha: hoy",
          onRemove: () => setSoloHoy(false),
        }
      : null,
    soloCriticos
      ? {
          key: "criticos",
          label: "Críticos: alerta y vencido",
          onRemove: () => setSoloCriticos(false),
        }
      : null,
    filtroComunicacion
      ? {
          key: "tipo",
          label: `Tipo: ${filtroComunicacion === "sin-tipo" ? "No especificado" : filtroComunicacion === "interna" ? "Interna" : "Externa"}`,
          onRemove: () => setFiltroComunicacion(""),
        }
      : null,
    textoBusqueda.trim()
      ? {
          key: "busqueda",
          label: `Búsqueda: ${textoBusqueda.trim()}`,
          onRemove: () => setTextoBusqueda(""),
        }
      : null,
  ].filter(Boolean);

  function limpiarFiltros() {
    setTextoBusqueda("");
    setBusquedaConsulta("");
    setSoloCriticos(false);
    setSoloHoy(false);
    setFiltroComunicacion("");
  }

  function trasladoGuardado() {
    setSolicitudTraslado(null);
    botonTraslado.current?.focus();
    cerrarDetalle();
    cerrarRespuesta();
    cerrarComprobante();
    setRevisionConsulta((valor) => valor + 1);
  }

  return (
    <div className="page-consult app-page">
      <EncabezadoAplicacion usuario={usuario} pantallaActual="consultar" />
      <main className="consult-main">
        {usuario.rol === "funcionario" && <RespuestasInternas key={usuario.id} usuario={usuario} />}
        <div className="consult-heading">
          <h1>Listado de documentos recibidos</h1>
          {usuario.rol !== "funcionario" && (
            <a href="index.html">← Registrar nuevo radicado</a>
          )}
        </div>

        <BandejaTraslados usuario={usuario}
          revision={revisionConsulta} alGuardar={trasladoGuardado} />
        {mensajeTraslado && <MensajeEstado tono="success">{mensajeTraslado}</MensajeEstado>}
        {solicitudTraslado && <SolicitudTraslado key={solicitudTraslado.numero_radicado}
          radicado={solicitudTraslado}
          alCerrar={() => { setSolicitudTraslado(null); botonTraslado.current?.focus(); }} alGuardar={(resultado) => {
            setMensajeTraslado(`Solicitud confirmada para ${resultado.numero_radicado}. Consulta Mis solicitudes de traslado para ver su estado.`);
            trasladoGuardado();
          }} />}

        <section className="dashboard-cards" aria-label="Resumen y filtros">
          <button
            className={`dashboard-card ${!hayFiltrosActivos ? "filtro-activo" : ""}`}
            type="button"
            aria-pressed={!hayFiltrosActivos}
            onClick={limpiarFiltros}
          >
            <span>Total</span>
            <strong>{resumenConsulta.total}</strong>
            <small>Mostrar todos los registros</small>
          </button>
          <button
            className={`dashboard-card ${soloCriticos ? "filtro-activo" : ""}`}
            type="button"
            aria-pressed={soloCriticos}
            onClick={() => setSoloCriticos((valor) => !valor)}
          >
            <span>Críticos</span>
            <strong>{radicadosCriticos}</strong>
            <small>Filtrar alerta y vencido</small>
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
        <div className="filtros-activos-resumen" aria-live="polite">
          {filtrosActivos.length ? (
            <ul className="filtros-activos-lista" aria-label="Filtros activos">
              {filtrosActivos.map((filtro) => (
                <li key={filtro.key}>
                  <button
                    type="button"
                    className="filtro-badge"
                    onClick={filtro.onRemove}
                    aria-label={`Quitar filtro ${filtro.label}`}
                  >
                    <span>{filtro.label}</span>
                    <strong aria-hidden="true">×</strong>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Sin filtros activos.</p>
          )}
        </div>

        <section className="consult-filters">
          <input
            id="busqueda-radicados"
            name="busqueda_radicados"
            value={textoBusqueda}
            maxLength={150}
            onChange={(evento) => setTextoBusqueda(evento.target.value)}
            placeholder="Buscar por radicado, documento o remitente…"
            aria-label="Buscar radicados"
          />
          <div>
            <p role="status" aria-live="polite">
              {cargando
                ? "Cargando radicados…"
                : mensajeError
                  ? `No se pudieron cargar radicados. ${mensajeError}`
                  : `Mostrando ${radicadosVisibles.length} de ${resumenConsulta.total}. ${hayFiltrosActivos ? "Hay filtros activos." : "Sin filtros activos."}`}
            </p>
            {!cargando && !mensajeError && <p>{paginacion.total} registros coinciden con los filtros.</p>}
            <button
              type="button"
              onClick={limpiarFiltros}
              disabled={!hayFiltrosActivos}
            >
              Limpiar filtros
            </button>
            {mensajeError && (
              <button type="button" onClick={() => setRevisionConsulta((valor) => valor + 1)}>
                Reintentar consulta
              </button>
            )}
          </div>
        </section>

        <section className="table-card">
          <p className="tabla-ayuda">En pantallas intermedias, desplaza la tabla para ver todas las columnas.</p>
          <div className="table-scroll" role="region" aria-label="Listado de radicados" tabIndex={0}>
            <table id="tabla-radicados" className="tabla-adaptable" role="table" aria-label="Radicados">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">Radicado</th>
                  <th scope="col" role="columnheader">Tipo / fecha</th>
                  <th scope="col" role="columnheader">Remitente</th>
                  <th scope="col" role="columnheader">Semáforo</th>
                  <th scope="col" role="columnheader">Estado</th>
                  <th scope="col" role="columnheader">Acciones</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
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
                    <tr
                      role="row"
                      key={`${radicado.numero_radicado}-${radicado.radicado_dependencia_id || "single"}`}
                    >
                      <CeldaAdaptable etiqueta="Radicado">
                        <small className="regla-respuesta">
                          {requiereRespuesta(radicado)
                            ? "Requiere respuesta"
                            : "No requiere respuesta"}
                        </small>
                        <button
                          className="ver-detalle"
                          type="button"
                          onClick={(evento) => {
                            botonDetalle.current = evento.currentTarget;
                            abrirDetalle(radicado);
                          }}
                        >
                          {radicado.numero_radicado}
                        </button>
                        {radicado.destino_todas_dependencias === 1 &&
                          radicado.seguimiento_dependencia_nombre && (
                            <small>
                              Seguimiento:{" "}
                              {radicado.seguimiento_dependencia_nombre}
                            </small>
                          )}
                      </CeldaAdaptable>
                      <CeldaAdaptable etiqueta="Tipo / fecha">
                        <span
                          className={`badge-comunicacion badge-comunicacion--${obtenerTipoComunicacion(radicado)}`}
                        >
                          {obtenerTipoComunicacion(radicado)}
                        </span>
                        <small>{formatearFechaRadicacion(radicado)}</small>
                      </CeldaAdaptable>
                      <CeldaAdaptable etiqueta="Remitente">
                        <strong>
                          {radicado.remitente_nombre || "No registrado"}
                        </strong>
                        <small>
                          CC/NIT:{" "}
                          {radicado.remitente_documento ||
                            radicado.remitente_nit ||
                            "N/A"}
                        </small>
                      </CeldaAdaptable>
                      <CeldaAdaptable etiqueta="Semáforo">
                        <span
                          className={`semaforo semaforo--${radicado.semaforo?.nivel === "completado" ? "verde" : radicado.semaforo?.nivel === "vencido" ? "rojo" : radicado.semaforo?.nivel === "alerta" ? "amarillo" : radicado.semaforo?.nivel === "a_tiempo" ? "verde" : "sin-calcular"}`}
                        >
                          <i className="semaforo__dot" />
                          {radicado.semaforo?.texto || "Sin calcular"}
                        </span>
                      </CeldaAdaptable>
                      <CeldaAdaptable etiqueta="Estado">
                        {esFinal(radicado) &&
                        !guardandoEstados[claveEstado(radicado)] ? (
                          <span
                            className="estado-final"
                            aria-label={`Estado de ${radicado.numero_radicado}: ${radicado.estado}`}
                          >
                            {radicado.estado}
                          </span>
                        ) : (
                          <select
                            id={`estado-radicado-${String(radicado.numero_radicado).replace(/[^A-Za-z0-9_-]/g, "-")}-${String(radicado.radicado_dependencia_id || "single").replace(/[^A-Za-z0-9_-]/g, "-")}`}
                            name={`estado_radicado_${String(radicado.numero_radicado).replace(/[^A-Za-z0-9_-]/g, "_")}_${String(radicado.radicado_dependencia_id || "single").replace(/[^A-Za-z0-9_-]/g, "_")}`}
                            aria-label={`Estado de ${radicado.numero_radicado}`}
                            disabled={
                              usuario.rol === "ventanilla" ||
                              guardandoEstados[claveEstado(radicado)]
                            }
                            value={radicado.estado || "Recibido"}
                            onChange={(evento) =>
                              cambiarEstado(radicado, evento.target.value)
                            }
                          >
                            {[
                              ...ESTADOS_POSIBLES,
                              ...(!requiereRespuesta(radicado)
                                ? ["Enterado"]
                                : []),
                              ...(![...ESTADOS_POSIBLES, "Enterado"].includes(
                                radicado.estado || "Recibido",
                              )
                                ? [radicado.estado]
                                : []),
                            ].map((estadoPosible) => (
                              <option
                                key={estadoPosible}
                                disabled={
                                  !ESTADOS_POSIBLES.includes(estadoPosible) &&
                                  estadoPosible !== "Enterado"
                                }
                              >
                                {estadoPosible}
                              </option>
                            ))}
                          </select>
                        )}
                        {guardandoEstados[claveEstado(radicado)] && (
                          <small role="status">Guardando estado…</small>
                        )}
                        {erroresEstado[claveEstado(radicado)] && (
                          <small role="alert">
                            {erroresEstado[claveEstado(radicado)]}
                          </small>
                        )}
                      </CeldaAdaptable>
                      <CeldaAdaptable etiqueta="Acciones">
                        {usuario.rol === "funcionario" && !radicado.destino_todas_dependencias &&
                          radicado.dependencia_destino_id && !esFinal(radicado) && (
                            <button type="button" className="generar-comprobante"
                              onClick={(evento) => {
                                botonTraslado.current = evento.currentTarget;
                                setSolicitudTraslado(radicado);
                              }}>Solicitar traslado</button>
                          )}
                        <button
                          className="generar-comprobante"
                          disabled={generandoComprobante}
                          type="button"
                          onClick={() => mostrarComprobante(radicado)}
                        >
                          Ver comprobante
                        </button>
                        {usuario.rol !== "ventanilla" &&
                          !(usuario.rol === "administrador" &&
                            String(radicado.tipo_comunicacion).trim().toLowerCase() === "interna" &&
                            !radicado.destino_todas_dependencias) &&
                          requiereRespuesta(radicado) &&
                          !esFinal(radicado) && (
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
                      </CeldaAdaptable>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <nav className="alerts-controls" aria-label="Paginación de radicados">
          <button
            type="button"
            disabled={cargando || paginaConsulta <= 1}
            onClick={() => setNavegacion({
              filtros: filtrosConsulta, pagina: paginaConsulta - 1,
            })}
          >
            Anterior
          </button>
          <span>Página {paginaConsulta} de {Math.max(1, paginacion.paginas)}</span>
          <button
            type="button"
            disabled={cargando || paginaConsulta >= paginacion.paginas}
            onClick={() => setNavegacion({
              filtros: filtrosConsulta, pagina: paginaConsulta + 1,
            })}
          >
            Siguiente
          </button>
        </nav>
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
              onChange={(evento) => {
                setPaginaAlertas(1);
                setCargandoAlertas(false);
                setDependenciaAlertas(evento.target.value);
                setResumenAlertas({ porVencer: [], vencidos: [] });
                setPaginacionAlertas({ paginas: 0 });
                setConsultaAlertasValida(false);
                setEstadoAlertas("Elige una dependencia para consultar alertas.");
              }}
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
              disabled={!dependenciaAlertas || cargandoAlertas}
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
                  <li key={claveEstado(radicado)}>
                    {radicado.numero_radicado} · {radicado.remitente_nombre} ·{" "}
                    {radicado.semaforo?.texto}
                  </li>
                ))}
                {consultaAlertasValida && resumenAlertas.porVencer.length === 0 && (
                  <li>Sin alertas de este grupo en esta página.</li>
                )}
              </ul>
            </div>
            <div>
              <h3>Vencidos</h3>
              <ul>
                {resumenAlertas.vencidos.map((radicado) => (
                  <li key={claveEstado(radicado)}>
                    {radicado.numero_radicado} · {radicado.remitente_nombre} ·{" "}
                    {radicado.semaforo?.texto}
                  </li>
                ))}
                {consultaAlertasValida && resumenAlertas.vencidos.length === 0 && (
                  <li>Sin alertas de este grupo en esta página.</li>
                )}
              </ul>
            </div>
          </div>
          <nav className="alerts-controls" aria-label="Paginación de alertas">
            <button
              type="button"
              disabled={!consultaAlertasValida || cargandoAlertas || paginaAlertas <= 1}
              onClick={() => setPaginaAlertas((valor) => valor - 1)}
            >
              Anteriores
            </button>
            <span>Página {paginaAlertas} de {Math.max(1, paginacionAlertas.paginas)}</span>
            <button
              type="button"
              disabled={!consultaAlertasValida || cargandoAlertas || paginaAlertas >= paginacionAlertas.paginas}
              onClick={() => setPaginaAlertas((valor) => valor + 1)}
            >
              Siguientes
            </button>
          </nav>
        </section>
      </main>
      <PiePagina />

      {generandoComprobante && <p role="status">Generando comprobante…</p>}
      <dialog
        ref={dialogoDetalle}
        id="modal-detalle"
        aria-labelledby="detalle-radicado-titulo"
        onClose={() => {
          if (!dialogoDetalle.current?.open) cerrarDetalle();
        }}
        onCancel={(evento) => {
          evento.preventDefault();
          cerrarDetalle();
        }}
      >
        {radicadoSeleccionado && (
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 id="detalle-radicado-titulo" ref={tituloDetalle} tabIndex={-1}>
                Detalle del radicado: {radicadoSeleccionado.numero_radicado}
              </h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar detalle del radicado"
                onClick={cerrarDetalle}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <section
                className="detalle-resumen"
                aria-label="Resumen del radicado"
              >
                <CampoDetalle etiqueta="Estado">
                  <span
                    className={`detalle-badge detalle-badge--estado-${claseEstadoDetalle(radicadoSeleccionado.estado)}`}
                  >
                    {radicadoSeleccionado.estado || "Recibido"}
                  </span>
                </CampoDetalle>
                <CampoDetalle
                  etiqueta={radicadoSeleccionado.destino_todas_dependencias
                    ? "Destino compartido" : "Dependencia responsable actual"}
                  valor={radicadoSeleccionado.destino_todas_dependencias
                    ? "Todas las dependencias asignadas"
                    : radicadoSeleccionado.dependencia_destino}
                />
                {radicadoSeleccionado.destino_todas_dependencias && (
                  <CampoDetalle etiqueta="Seguimiento mostrado"
                    valor={radicadoSeleccionado.seguimiento_dependencia_nombre ||
                      "Cada dependencia tiene su propio estado y respuesta"} />
                )}
                <CampoDetalle etiqueta="Requisito de respuesta">
                  <span
                    className={`detalle-badge ${requiereRespuesta(radicadoSeleccionado) ? "detalle-badge--requiere" : "detalle-badge--no-requiere"}`}
                  >
                    {requiereRespuesta(radicadoSeleccionado)
                      ? "Requiere respuesta"
                      : "No requiere respuesta"}
                  </span>
                </CampoDetalle>
                <CampoDetalle
                  etiqueta="Fecha de radicación"
                  valor={formatearFechaRadicacion(radicadoSeleccionado)}
                />
                <CampoDetalle
                  etiqueta="Fecha límite"
                  valor={
                    requiereRespuesta(radicadoSeleccionado)
                      ? radicadoSeleccionado.fecha_limite_actual
                      : "No aplica"
                  }
                />
                <CampoDetalle
                  etiqueta="Tiempo de respuesta"
                  valor={radicadoSeleccionado.tiempo_de_respuesta}
                />
                {radicadoSeleccionado.fecha_enterado && (
                  <CampoDetalle
                    etiqueta="Fecha de enterado"
                    valor={convertirFechaLocal(
                      radicadoSeleccionado.fecha_enterado,
                    )?.toLocaleString("es-CO")}
                  />
                )}
              </section>
              <section
                className="detalle-seccion detalle-asunto-seccion"
                aria-labelledby="detalle-asunto-titulo"
              >
                <h3 id="detalle-asunto-titulo">Asunto</h3>
                <p className="detalle-asunto">
                  {radicadoSeleccionado.asunto_documento || "Asunto no registrado."}
                </p>
              </section>
              <section
                className="detalle-seccion"
                aria-labelledby="detalle-remitente-titulo"
              >
                <h3 id="detalle-remitente-titulo">Remitente</h3>
                <div className="detalle-grid">
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
                  {radicadoSeleccionado.tipo_comunicacion === "Externa" && (
                    <>
                      <CampoDetalle
                        etiqueta="Tipo de persona"
                        valor={
                          radicadoSeleccionado.remitente_tipo_persona ===
                          "juridica"
                            ? "Jurídica"
                            : radicadoSeleccionado.remitente_tipo_persona ===
                                "natural"
                              ? "Natural"
                              : "No registrado"
                        }
                      />
                      <CampoDetalle
                        etiqueta="Entidad / razón social"
                        valor={radicadoSeleccionado.remitente_entidad}
                      />
                      <CampoDetalle
                        etiqueta="NIT"
                        valor={radicadoSeleccionado.remitente_nit}
                      />
                    </>
                  )}
                  <CampoDetalle
                    etiqueta="Teléfono"
                    valor={radicadoSeleccionado.remitente_telefono}
                  />
                  <CampoDetalle
                    etiqueta="Correo"
                    valor={radicadoSeleccionado.remitente_email}
                  />
                </div>
              </section>
              <section
                className="detalle-seccion"
                aria-labelledby="detalle-tramite-titulo"
              >
                <h3 id="detalle-tramite-titulo">Trámite</h3>
                <div className="detalle-grid">
                  <CampoDetalle etiqueta="Clase de comunicación"
                    valor={radicadoSeleccionado.tipo_comunicacion} />
                  {radicadoSeleccionado.tipo_comunicacion === "Interna" && (
                    <CampoDetalle
                      etiqueta="Dependencia remitente"
                      valor={
                        radicadoSeleccionado.dependencia_remitente ||
                        "No registrada"
                      }
                    />
                  )}
                  <CampoDetalle
                    etiqueta="Tipo de trámite"
                    valor={radicadoSeleccionado.tipo_tramite}
                  />
                  <CampoDetalle
                    etiqueta="Fundamento legal"
                    valor={radicadoSeleccionado.fundamento_legal_aplicado}
                    ancho
                  />
                </div>
              </section>
              <section className="detalle-seccion detalle-documentos" aria-labelledby="detalle-documentos-titulo">
                <h3 id="detalle-documentos-titulo">Documentos adjuntos</h3>
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
              <section className="detalle-seccion detalle-historial" aria-labelledby="historial-radicado-titulo">
                <h3 id="historial-radicado-titulo">
                  Historial de actuaciones
                </h3>
                <p className="timeline-ayuda">
                  Registros cargados en orden de registro, del más antiguo al más reciente.
                  Las fechas nuevas se muestran en hora de Bogotá. Puedes cargar eventos
                  anteriores si hay más historial.
                </p>
                {historial.error && <p role="alert">{historial.error}</p>}
                {historial.cargando && historial.eventos.length === 0 && (
                  <p role="status">Cargando historial…</p>
                )}
                {!historial.cargando &&
                  !historial.error &&
                  historial.eventos.length === 0 && (
                    <p>No hay eventos de trazabilidad registrados.</p>
                  )}
                {historial.eventos.length > 0 && (
                  <ol
                    className="radicado-timeline"
                    aria-label="Línea de tiempo del radicado"
                  >
                    {agruparEventos([...historial.eventos].reverse()).map(
                      (grupo) => {
                        return (
                          <li
                            key={grupo[0].id}
                            className={
                              grupo.length > 1 ? "timeline-grupo" : undefined
                            }
                          >
                            <div className="timeline-cabecera">
                              <time className="timeline-fecha">
                                {presentarMinutoEvento(grupo[0])}
                              </time>
                              <p className="timeline-dato">
                                <strong>Registrado por: </strong>
                                {nombreActor(grupo[0])}
                              </p>
                              {grupo.length > 1 && (
                                <p className="timeline-resumen-grupo">
                                  {grupo.length} registros del mismo usuario en este minuto.
                                  Cada evento conserva su hora; no son necesariamente acciones
                                  manuales separadas.
                                </p>
                              )}
                            </div>
                            <ul className="timeline-subeventos">
                              {grupo.map((evento) => (
                                <li key={evento.id}>
                                  <article className="timeline-evento">
                                    <h4>
                                      {ETIQUETAS_EVENTO[evento.event_type] ||
                                        (evento.campo_modificado === "estado"
                                          ? "Cambio de estado histórico"
                                          : "Evento histórico")}
                                    </h4>
                                    <time className="timeline-fecha">
                                      {presentarFechaEvento(evento)}
                                    </time>
                                    <p className="timeline-dato">
                                      <strong>{CONTEXTO_DEPENDENCIA[evento.event_type] ||
                                        "Dependencia asociada al evento"}: </strong>
                                      {evento.dependencia_nombre || "No registrada en este evento"}
                                    </p>
                                    {evento.event_type === "regla_respuesta_aplicada" && (
                                      <p className="timeline-automatico">
                                        Registro automático: el sistema aplicó la regla del
                                        trámite al guardar el radicado; no es una respuesta enviada.
                                      </p>
                                    )}
                                    <p className="timeline-descripcion">
                                      {evento.motivo ||
                                        DESCRIPCIONES_EVENTO[
                                          evento.event_type
                                        ] ||
                                        "Registro conservado del historial del expediente."}
                                    </p>
                                    {(evento.event_type === "estado_cambiado" ||
                                      evento.event_type ===
                                        "respuesta_enviada" ||
                                      evento.campo_modificado === "estado") &&
                                      evento.valor_anterior &&
                                      evento.valor_nuevo && (
                                        <p className="timeline-cambio">
                                          <strong>Estado: </strong>
                                          {evento.valor_anterior} →{" "}
                                          {evento.valor_nuevo}
                                        </p>
                                      )}
                                    {evento.event_type === "respuesta_enviada" &&
                                      radicadoSeleccionado.tipo_comunicacion === "Externa" && (
                                      <p className="timeline-aclaracion-evento">
                                        Se guardó la respuesta institucional. Este evento no
                                        acredita su envío ni su entrega al destinatario.
                                      </p>
                                    )}
                                    {evento.event_type ===
                                      "termino_ampliado" && (
                                      <p className="timeline-cambio">
                                        <strong>Fecha límite: </strong>
                                        {evento.valor_anterior ||
                                          "No registrada"}{" "}
                                        →{" "}
                                        {evento.valor_nuevo || "No registrada"}
                                      </p>
                                    )}
                                    {["traslado_solicitado", "traslado_aprobado"].includes(evento.event_type) && (
                                      <p className="timeline-cambio">
                                        <strong>{evento.event_type === "traslado_solicitado" ? "Destino propuesto: " : "Reasignación: "}</strong>
                                        {evento.valor_anterior} → {evento.valor_nuevo}
                                      </p>
                                    )}
                                  </article>
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      },
                    )}
                  </ol>
                )}
                {historial.hayMas && (
                  <button
                    type="button"
                    onClick={cargarMasHistorial}
                    disabled={historial.cargando}
                  >
                    {historial.cargando
                      ? "Cargando…"
                      : "Cargar eventos anteriores"}
                  </button>
                )}
              </section>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={cerrarDetalle}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={dialogoRespuesta}
        className="respuesta-dialog"
        aria-labelledby="respuesta-dialogo-titulo"
        onClose={() => {
          if (!dialogoRespuesta.current?.open) cerrarRespuesta();
        }}
        onCancel={(evento) => {
          evento.preventDefault();
          cerrarRespuesta();
        }}
      >
        {respuestaConsultada && (
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 id="respuesta-dialogo-titulo" ref={tituloRespuesta} tabIndex={-1}>
                Respuesta institucional{" "}
                <span className="respuesta-numero">
                  {respuestaConsultada.radicado.numero_radicado}
                </span>
              </h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={cerrarRespuesta}
                disabled={guardandoEntrega}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              {respuestaConsultada.guardada && (
                <p role="status">
                  Respuesta guardada correctamente.
                  {String(respuestaConsultada.radicado.tipo_comunicacion).trim().toLowerCase() === "externa" &&
                    " Esto no acredita su envío ni su entrega al destinatario."}
                </p>
              )}
              {respuestaConsultada.cargando ? (
                <p role="status">Cargando respuesta y documentos…</p>
              ) : respuestaConsultada.error ? (
                <div>
                  <p role="alert">{respuestaConsultada.error}</p>
                  <button type="button" onClick={() => consultarRespuesta(
                    respuestaConsultada.radicado, { guardada: respuestaConsultada.guardada },
                  )}>
                    Reintentar consulta de respuesta
                  </button>
                </div>
              ) : (
                <>
                  <section
                    className="detalle-resumen"
                    aria-label="Resumen de la respuesta"
                  >
                    <CampoDetalle
                      etiqueta="Respondida por"
                      valor={respuestaConsultada.funcionario_nombre}
                    />
                    <CampoDetalle
                      etiqueta="Dependencia responsable"
                      valor={
                        respuestaConsultada.dependencia_responsable ||
                        "No registrada"
                      }
                    />
                    <CampoDetalle
                      etiqueta="Fecha de registro de respuesta"
                      valor={convertirFechaLocal(
                        respuestaConsultada.fecha_envio,
                      )?.toLocaleString("es-CO")}
                    />
                    <CampoDetalle etiqueta="Plantilla">
                      <span className="detalle-badge detalle-badge--plantilla">
                        {NOMBRES_PLANTILLA[respuestaConsultada.plantilla] ||
                          respuestaConsultada.plantilla ||
                          "Sin plantilla"}
                      </span>
                    </CampoDetalle>
                  </section>
                  <section
                    className="detalle-seccion respuesta-grupo"
                    aria-labelledby="respuesta-contenido-titulo"
                  >
                    <h3 id="respuesta-contenido-titulo">
                      Contenido de la respuesta
                    </h3>
                    <p className="detalle-asunto">
                      {respuestaConsultada.contenido}
                    </p>
                  </section>
                  <section
                    className="detalle-seccion respuesta-grupo"
                    aria-labelledby="respuesta-documentos-titulo"
                  >
                    <h3 id="respuesta-documentos-titulo">
                      Documentos adjuntos
                    </h3>
                    {respuestaConsultada.documentos.length ? (
                      <ul className="detalle-archivos">
                        {respuestaConsultada.documentos.map((documento) => (
                          <li key={documento.id}>
                            <span
                              className="detalle-archivo-icono"
                              aria-hidden="true"
                            >
                              PDF
                            </span>
                            <a
                              href={documento.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {documento.nombre_archivo}
                            </a>
                            <span className="detalle-archivo-tamano">
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
                  {String(respuestaConsultada.radicado.tipo_comunicacion).trim().toLowerCase() === "externa" &&
                    !respuestaConsultada.radicado.destino_todas_dependencias &&
                    <SeguimientoEntrega key={`${respuestaConsultada.id}:${usuario.id}`}
                      radicado={respuestaConsultada.radicado} usuario={usuario}
                      alProceso={(valor) => { respuestaEnProceso.current = valor; setGuardandoEntrega(valor); }}
                      alPerderAcceso={retirarVistasSinAcceso} />}
                  {String(respuestaConsultada.radicado.tipo_comunicacion).trim().toLowerCase() === "interna" &&
                    !respuestaConsultada.radicado.destino_todas_dependencias &&
                    <TrazabilidadInterna key={`${respuestaConsultada.id}:${usuario.id}`}
                      radicado={respuestaConsultada.radicado} usuario={usuario} />}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" onClick={cerrarRespuesta} disabled={guardandoEntrega}>
                Cerrar
              </button>
            </div>
          </div>
        )}
        {respuestaSeleccionada && (
          <form className="modal-dialog" onSubmit={enviarRespuesta}>
            <div className="modal-header">
              <h2 id="respuesta-dialogo-titulo">
                Respuesta institucional{" "}
                <span className="respuesta-numero">
                  {respuestaSeleccionada.numero_radicado}
                </span>
              </h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={cerrarRespuesta}
                disabled={enviandoRespuesta}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <section
                className="detalle-resumen"
                aria-label="Radicado a responder"
              >
                <CampoDetalle
                  etiqueta="Asunto"
                  valor={respuestaSeleccionada.asunto_documento || "Sin asunto"}
                  ancho
                />
                <CampoDetalle
                  etiqueta="Remitente"
                  valor={respuestaSeleccionada.remitente_nombre}
                />
              </section>
              <section
                className="detalle-seccion respuesta-grupo"
                aria-labelledby="respuesta-redaccion-titulo"
              >
                <h3 id="respuesta-redaccion-titulo">Redacción</h3>
                <label htmlFor="plantilla-respuesta">
                  Plantilla institucional
                </label>
                <select
                  id="plantilla-respuesta"
                  disabled={enviandoRespuesta}
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
                  disabled={enviandoRespuesta}
                  required
                  minLength={10}
                  maxLength={10000}
                  rows={8}
                  value={textoRespuesta}
                  onChange={(e) => setTextoRespuesta(e.target.value)}
                  placeholder="Redacta la respuesta para el remitente…"
                  aria-describedby="contador-respuesta"
                />
                <p
                  id="contador-respuesta"
                  className={`respuesta-contador${textoRespuesta.trim().length < 10 ? " respuesta-contador--corto" : ""}`}
                >
                  {textoRespuesta.length.toLocaleString("es-CO")} / 10.000
                  caracteres
                  {textoRespuesta.trim().length < 10 && " · mínimo 10"}
                </p>
              </section>
              <section
                className="detalle-seccion respuesta-grupo"
                aria-labelledby="respuesta-adjuntos-titulo"
              >
                <h3 id="respuesta-adjuntos-titulo">Adjuntos de la respuesta</h3>
                <label htmlFor="adjunto-respuesta">
                  Documentos de respuesta (hasta 5 PDF, máximo 10 MB cada uno)
                </label>
                <input
                  ref={entradaArchivosRespuesta}
                  id="adjunto-respuesta"
                  disabled={enviandoRespuesta}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  aria-invalid={Boolean(errorArchivosRespuesta)}
                  aria-describedby={
                    errorArchivosRespuesta
                      ? "error-archivos-respuesta"
                      : undefined
                  }
                  onChange={aceptarArchivosRespuesta}
                />
                {archivosRespuesta.length > 0 && (
                  <ul
                    className="detalle-archivos"
                    aria-label="Archivos seleccionados"
                  >
                    {archivosRespuesta.map((archivo) => (
                      <li key={`${archivo.name}-${archivo.lastModified}`}>
                        <span
                          className="detalle-archivo-icono"
                          aria-hidden="true"
                        >
                          PDF
                        </span>
                        <span className="detalle-archivo-nombre">
                          {archivo.name}
                        </span>
                        <span className="detalle-archivo-tamano">
                          {(archivo.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            {(errorArchivosRespuesta || mensajeRespuesta) && (
              <div className="respuesta-mensajes">
                {errorArchivosRespuesta && (
                  <p
                    id="error-archivos-respuesta"
                    className="auth-message"
                    data-state="error"
                    role="alert"
                  >
                    {errorArchivosRespuesta}{" "}
                    {archivosRespuesta.length > 0
                      ? `Se conservan los adjuntos válidos anteriores (${archivosRespuesta.length} PDF).`
                      : "No se ha adjuntado ningún archivo."}
                  </p>
                )}
                <p role="status" aria-live="polite">
                  {mensajeRespuesta}
                </p>
              </div>
            )}
            <div className="modal-footer">
              <button
                type="button"
                onClick={cerrarRespuesta}
                disabled={enviandoRespuesta}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="respuesta-enviar"
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
          if (!dialogoComprobante.current?.open) cerrarComprobante();
        }}
        onCancel={(evento) => {
          evento.preventDefault();
          cerrarComprobante();
        }}
      >
        <div className="comprobante-cabecera">
          <h2>Comprobante de recepción</h2>
          <button type="button" onClick={cerrarComprobante}>
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

function CampoDetalle({ etiqueta, valor, ancho = false, children }) {
  return (
    <div className={`modal-field${ancho ? " modal-field--ancho" : ""}`}>
      <strong>{etiqueta}</strong>
      <p>{children || valor || "No registrado"}</p>
    </div>
  );
}
