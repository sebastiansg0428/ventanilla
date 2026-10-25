import { useEffect, useMemo, useRef, useState } from "react";
import {
  EncabezadoAplicacion,
  PiePagina,
  ProteccionSesion,
  MensajeEstado,
} from "../componentes/Compartidos";
import { solicitarApi } from "../servicios/api";
import { crearPdfComprobante } from "../servicios/comprobante";
import { obtenerFechaBogota, obtenerDiaRadicacion, formatearFechaRadicacion } from "../servicios/fechas";

const ESTADOS_POSIBLES = ["Recibido", "En trámite", "Pendiente"];
const requiereRespuesta = (radicado) =>
  radicado.requiere_respuesta !== false && radicado.requiere_respuesta !== 0;
const esFinal = (radicado) => ["Respondido", "Enterado"].includes(radicado.estado);
const claveEstado = (radicado) => `${radicado.numero_radicado}-${radicado.radicado_dependencia_id || "single"}`;
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
const ETIQUETAS_EVENTO = {
  radicado_creado: "Radicado recibido",
  radicado_asignado: "Asignado a dependencia",
  documentos_radicado_adjuntados: "Documentos originales adjuntados",
  estado_cambiado: "Cambio de estado",
  respuesta_enviada: "Respuesta institucional enviada",
  documentos_respuesta_adjuntados: "Documentos de respuesta adjuntados",
  termino_ampliado: "Término ampliado",
  regla_respuesta_aplicada: "Regla de respuesta aplicada",
};
function presentarFechaEvento(evento) {
  if (evento.ocurrido_en_utc) {
    const fechaUtc = new Date(`${String(evento.ocurrido_en_utc).replace(" ", "T")}Z`);
    return Number.isNaN(fechaUtc.getTime())
      ? "Fecha UTC inválida"
      : new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "medium",
        }).format(fechaUtc);
  }
  return evento.creado_en
    ? `${evento.creado_en} · zona horaria histórica no confirmada`
    : "Fecha histórica no disponible";
}

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
  const [radicadoSeleccionado, setRadicadoSeleccionado] = useState(null);
  const [archivoAdjunto, setArchivoAdjunto] = useState({
    url: "",
    estado: "",
    documentos: [],
  });
  const [historial, setHistorial] = useState({
    eventos: [], cargando: false, error: "", cursor: null, hayMas: false,
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
  const [mensajeRespuesta, setMensajeRespuesta] = useState("");
  const [respuestaConsultada, setRespuestaConsultada] = useState(null);
  const dialogoDetalle = useRef(null);
  const dialogoComprobante = useRef(null);
  const dialogoRespuesta = useRef(null);
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

  useEffect(() => () => {
    solicitudDetalle.current += 1;
    solicitudHistorial.current += 1;
    solicitudDocumento.current += 1;
    solicitudRespuesta.current += 1;
    liberarUrlsRespuestaEnCarga();
  }, []);

  function cerrarDetalle() {
    solicitudDetalle.current += 1;
    solicitudHistorial.current += 1;
    solicitudDocumento.current += 1;
    setRadicadoSeleccionado(null);
    setArchivoAdjunto({ url: "", documentos: [], estado: "" });
    setHistorial({ eventos: [], cargando: false, error: "", cursor: null, hayMas: false });
    if (dialogoDetalle.current?.open) dialogoDetalle.current.close();
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
      const fecha = obtenerDiaRadicacion(radicado);
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
    let error = seleccion.length > 5
      ? "Puedes adjuntar máximo 5 archivos PDF."
      : "";
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
    if (respuestaEnProceso.current || !respuestaSeleccionada || !textoRespuesta.trim()) return;
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
      setMensajeRespuesta("Respuesta enviada y registrada.");
      setEnviandoRespuesta(false);
      respuestaEnProceso.current = false;
      cerrarRespuesta();
    } catch (error) {
      if (solicitud === solicitudRespuesta.current) setMensajeRespuesta(error.message);
    } finally {
      respuestaEnProceso.current = false;
      if (solicitud === solicitudRespuesta.current)
        setEnviandoRespuesta(false);
    }
  }

  async function consultarRespuesta(radicado) {
    if (respuestaEnProceso.current) return;
    const solicitud = ++solicitudRespuesta.current;
    liberarUrlsRespuestaEnCarga();
    setRespuestaSeleccionada(null);
    setRespuestaConsultada({ radicado, cargando: true, documentos: [] });
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
        documentos,
        cargando: false,
      });
      publicados = true;
      documentosCargados.forEach((url) => urlsRespuestaEnCarga.current.delete(url));
    } catch (error) {
      if (solicitud !== solicitudRespuesta.current) return;
      setRespuestaConsultada(null);
      window.alert(`No se pudo consultar la respuesta. ${error.message}`);
    } finally {
      if (!publicados) documentosCargados.forEach((url) => {
        if (urlsRespuestaEnCarga.current.delete(url)) URL.revokeObjectURL(url);
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
    setHistorial({ eventos: [], cargando: true, error: "", cursor: null, hayMas: false });
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
      setHistorial((actual) => ({ ...actual, cargando: false, error: error.message }));
    }
  }

  function cargarMasHistorial() {
    if (!radicadoSeleccionado || historial.cargando || !historial.hayMas || !historial.cursor) return;
    setHistorial((actual) => ({ ...actual, cargando: true, error: "" }));
    cargarHistorial(radicadoSeleccionado, solicitudHistorial.current, historial.cursor, true);
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
      if (resultado.success === false || !resultado.estado) throw new Error(resultado.message || "No se pudo guardar el estado.");
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
    } catch (error) {
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

  useEffect(() => () => { solicitudComprobante.current += 1; }, []);

  async function mostrarComprobante(radicado) {
    if (comprobanteEnProceso.current) return;
    comprobanteEnProceso.current = true;
    setGenerandoComprobante(true);
    const solicitud = ++solicitudComprobante.current;
    try {
      if (!obtenerDiaRadicacion(radicado)) throw new Error("El radicado no tiene fecha válida.");
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

  const radicadosHoy = radicados.filter(
    (radicado) =>
      obtenerDiaRadicacion(radicado) === claveFechaHoy,
  ).length;
  const radicadosCriticos = radicados.filter(estaEnEstadoCritico).length;
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
    setSoloCriticos(false);
    setSoloHoy(false);
    setFiltroComunicacion("");
  }

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
            className={`dashboard-card ${!hayFiltrosActivos ? "filtro-activo" : ""}`}
            type="button"
            aria-pressed={!hayFiltrosActivos}
            onClick={limpiarFiltros}
          >
            <span>Total</span>
            <strong>{radicados.length}</strong>
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
              onClick={limpiarFiltros}
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
                    <tr
                      key={`${radicado.numero_radicado}-${radicado.radicado_dependencia_id || "single"}`}
                    >
                      <td>
                        <small className="regla-respuesta">
                          {requiereRespuesta(radicado) ? "Requiere respuesta" : "No requiere respuesta"}
                        </small>
                        <button
                          className="ver-detalle"
                          type="button"
                          onClick={() => abrirDetalle(radicado)}
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
                      </td>
                      <td>
                        <span
                          className={`badge-comunicacion badge-comunicacion--${obtenerTipoComunicacion(radicado)}`}
                        >
                          {obtenerTipoComunicacion(radicado)}
                        </span>
                        <small>
                          {formatearFechaRadicacion(radicado)}
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
                        {esFinal(radicado) && !guardandoEstados[claveEstado(radicado)] ? (
                          <span className="estado-final" aria-label={`Estado de ${radicado.numero_radicado}: ${radicado.estado}`}>
                            {radicado.estado}
                          </span>
                        ) : <select
                          id={`estado-radicado-${String(radicado.numero_radicado).replace(/[^A-Za-z0-9_-]/g, "-")}-${String(radicado.radicado_dependencia_id || "single").replace(/[^A-Za-z0-9_-]/g, "-")}`}
                          name={`estado_radicado_${String(radicado.numero_radicado).replace(/[^A-Za-z0-9_-]/g, "_")}_${String(radicado.radicado_dependencia_id || "single").replace(/[^A-Za-z0-9_-]/g, "_")}`}
                          aria-label={`Estado de ${radicado.numero_radicado}`}
                          disabled={usuario.rol === "ventanilla" || guardandoEstados[claveEstado(radicado)]}
                          value={radicado.estado || "Recibido"}
                          onChange={(evento) =>
                            cambiarEstado(radicado, evento.target.value)
                          }
                        >
                          {[...ESTADOS_POSIBLES, ...(!requiereRespuesta(radicado) ? ["Enterado"] : []),
                            ...(![...ESTADOS_POSIBLES, "Enterado"].includes(radicado.estado || "Recibido") ? [radicado.estado] : [])].map((estadoPosible) => (
                            <option key={estadoPosible} disabled={!ESTADOS_POSIBLES.includes(estadoPosible) && estadoPosible !== "Enterado"}>{estadoPosible}</option>
                          ))}
                        </select>}
                        {guardandoEstados[claveEstado(radicado)] && <small role="status">Guardando estado…</small>}
                        {erroresEstado[claveEstado(radicado)] && <small role="alert">{erroresEstado[claveEstado(radicado)]}</small>}
                      </td>
                      <td>
                        <button
                          className="generar-comprobante"
                          disabled={generandoComprobante}
                          type="button"
                          onClick={() => mostrarComprobante(radicado)}
                        >
                          Ver comprobante
                        </button>
                        {usuario.rol !== "ventanilla" &&
                          requiereRespuesta(radicado) && !esFinal(radicado) && (
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

      {generandoComprobante && <p role="status">Generando comprobante…</p>}
      <dialog
        ref={dialogoDetalle}
        id="modal-detalle"
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
              <h2>
                Detalle del radicado: {radicadoSeleccionado.numero_radicado}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={cerrarDetalle}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <CampoDetalle
                etiqueta="Fecha de radicación"
                valor={formatearFechaRadicacion(radicadoSeleccionado)}
              />
              <CampoDetalle
                etiqueta="Estado"
                valor={radicadoSeleccionado.estado || "Recibido"}
              />
              <CampoDetalle etiqueta="Requisito de respuesta"
                valor={requiereRespuesta(radicadoSeleccionado) ? "Requiere respuesta" : "No requiere respuesta"} />
              {radicadoSeleccionado.fecha_enterado && (
                <CampoDetalle etiqueta="Fecha de enterado"
                  valor={convertirFechaLocal(radicadoSeleccionado.fecha_enterado)?.toLocaleString("es-CO")} />
              )}
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
              {radicadoSeleccionado.tipo_comunicacion === "Interna" && (
                <CampoDetalle etiqueta="Dependencia remitente"
                  valor={radicadoSeleccionado.dependencia_remitente || "No registrada"} />
              )}
              {radicadoSeleccionado.tipo_comunicacion === "Externa" && (
                <>
                  <CampoDetalle etiqueta="Tipo de persona"
                    valor={radicadoSeleccionado.remitente_tipo_persona === "juridica"
                      ? "Jurídica" : radicadoSeleccionado.remitente_tipo_persona === "natural"
                        ? "Natural" : "No registrado"} />
                  <CampoDetalle etiqueta="Entidad / razón social" valor={radicadoSeleccionado.remitente_entidad} />
                  <CampoDetalle etiqueta="NIT" valor={radicadoSeleccionado.remitente_nit} />
                </>
              )}
              <CampoDetalle
                etiqueta="Tipo de tramite"
                valor={radicadoSeleccionado.tipo_tramite}
              />
              <CampoDetalle
                etiqueta="Tiempo de respuesta"
                valor={radicadoSeleccionado.tiempo_de_respuesta}
              />
              <CampoDetalle
                etiqueta="Fecha límite"
                valor={requiereRespuesta(radicadoSeleccionado) ? radicadoSeleccionado.fecha_limite_actual : "No aplica"}
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
              <section aria-labelledby="historial-radicado-titulo">
                <h3 id="historial-radicado-titulo">Trazabilidad del expediente</h3>
                {historial.error && <p role="alert">{historial.error}</p>}
                {historial.cargando && historial.eventos.length === 0 && (
                  <p role="status">Cargando historial…</p>
                )}
                {!historial.cargando && !historial.error && historial.eventos.length === 0 && (
                  <p>No hay eventos de trazabilidad registrados.</p>
                )}
                {historial.eventos.length > 0 && (
                  <ol className="radicado-timeline" aria-label="Línea de tiempo del radicado">
                    {[...historial.eventos].reverse().map((evento) => (
                      <li key={evento.id}>
                        <time>{presentarFechaEvento(evento)}</time>
                        <strong>
                          {ETIQUETAS_EVENTO[evento.event_type] ||
                            (evento.campo_modificado === "estado"
                              ? "Cambio de estado histórico"
                              : "Evento histórico")}
                        </strong>
                        {evento.valor_anterior && evento.valor_nuevo && evento.event_type === "estado_cambiado" && (
                          <span>{evento.valor_anterior} → {evento.valor_nuevo}</span>
                        )}
                        <span>Actor: {evento.actor_name || evento.usuario || "No identificado en el registro histórico"}</span>
                        {evento.dependencia_nombre && (
                          <span>Dependencia: {evento.dependencia_nombre}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {historial.hayMas && (
                  <button
                    type="button"
                    onClick={cargarMasHistorial}
                    disabled={historial.cargando}
                  >
                    {historial.cargando ? "Cargando…" : "Cargar eventos anteriores"}
                  </button>
                )}
              </section>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={cerrarDetalle}
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
              <h2>
                Respuesta institucional ·{" "}
                {respuestaConsultada.radicado.numero_radicado}
              </h2>
              <button
                type="button"
                className="modal-close"
                aria-label="Cerrar"
                onClick={cerrarRespuesta}
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
                    etiqueta="Dependencia responsable"
                    valor={respuestaConsultada.dependencia_responsable || "No registrada"}
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
                onClick={cerrarRespuesta}
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
                onClick={cerrarRespuesta}
                disabled={enviandoRespuesta}
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
              />
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
                aria-describedby={errorArchivosRespuesta ? "error-archivos-respuesta" : undefined}
                onChange={aceptarArchivosRespuesta}
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
                <p role="status" aria-live="polite">{mensajeRespuesta}</p>
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
          <button
            type="button"
            onClick={cerrarComprobante}
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
