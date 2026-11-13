import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { solicitarApi } from "../servicios/api";
import { convertirFechaBogota } from "../servicios/fechas";

const RESULTADOS = { pendiente_de_envio: "Pendiente de envío", enviado: "Envío registrado",
  entrega_acreditada: "Entrega acreditada", intento_fallido: "Intento fallido" };
const CANALES = { correo_electronico: "Correo electrónico (manual)", presencial: "Entrega presencial", mensajeria: "Correo físico o mensajería" };
const incierto = (error) => !error.status || error.status >= 500 || error.resultadoIncierto;
const idValido = valor => Number.isSafeInteger(valor) && valor > 0;
const ahoraBogota = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 19);
const fechaValida = valor => typeof valor === "string" &&
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(valor) &&
  Number.isFinite(new Date(`${valor.replace(" ", "T")}Z`).getTime());
function registroValido(r) {
  return r && idValido(r.id) && CANALES[r.canal] && RESULTADOS[r.resultado] && r.resultado !== "pendiente_de_envio" &&
    (r.fecha_real_declarada === undefined || typeof r.fecha_real_declarada === "boolean") &&
    (r.justificacion_fecha_anterior == null || typeof r.justificacion_fecha_anterior === "string") &&
    ["destinatario", "destino", "actor_nombre", "observaciones"].every(c => typeof r[c] === "string") &&
    fechaValida(r.fecha_actuacion_utc) && fechaValida(r.creado_en_utc) &&
    (r.anulado_en_utc === null || (fechaValida(r.anulado_en_utc) &&
      typeof r.anulador_nombre === "string" && typeof r.motivo_anulacion === "string")) &&
    Array.isArray(r.evidencias) && r.evidencias.length <= 10 &&
    r.evidencias.every(e => e && idValido(e.id) && typeof e.nombre_archivo === "string" &&
      Number.isSafeInteger(e.tamano_bytes) && e.tamano_bytes > 0 && /^[a-f0-9]{64}$/.test(e.sha256) &&
      (e.origen === undefined || ["legado", "documento_respuesta", "evidencia_adicional"].includes(e.origen)));
}
function fecha(valor) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })
    .format(new Date(`${valor.replace(" ", "T")}Z`));
}
async function confirmar(ruta, opciones) {
  const respuesta = await solicitarApi(ruta, opciones);
  const datos = await respuesta.json();
  if (datos.success !== true || !registroValido(datos.registro)) throw new Error("Confirmación incompleta. Consulta el historial o reintenta sin cambiar los datos.");
  return datos.registro;
}

export function SeguimientoEntrega({ radicado, usuario, alProceso, alPerderAcceso, alVistaRegistro, contenedorAcciones }) {
  const ruta = `/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/entregas`;
  const [abierto, setAbierto] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [revision, setRevision] = useState(0);
  const [historial, setHistorial] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [canal, setCanal] = useState("correo_electronico");
  const [resultado, setResultado] = useState("enviado");
  const [destinatario, setDestinatario] = useState(radicado.remitente_nombre || "");
  const [destino, setDestino] = useState(radicado.remitente_email || "");
  const [documentos, setDocumentos] = useState(null);
  const [seleccionados, setSeleccionados] = useState([]);
  const [errorDocumentos, setErrorDocumentos] = useState("");
  const [revisionDocumentos, setRevisionDocumentos] = useState(0);
  const [fechaActuacion, setFechaActuacion] = useState("");
  const [fechaRespuesta, setFechaRespuesta] = useState(null);
  const [justificacionFecha, setJustificacionFecha] = useState("");
  const [avisoDocumentos, setAvisoDocumentos] = useState("");
  const [errorArchivos, setErrorArchivos] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [archivos, setArchivos] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [anularId, setAnularId] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [urls, setUrls] = useState({});
  const urlsRef = useRef(new Set());
  const version = useRef(0);
  const enviando = useRef(false);
  const intento = useRef(null);
  const catalogoAnterior = useRef(null);
  const archivosInput = useRef(null);
  const canalInput = useRef(null);
  const registrarBoton = useRef(null);
  const motivoInput = useRef(null);
  const cabeceraRef = useRef(null);
  const anularBoton = useRef(null);
  const errorRef = useRef(null);
  const errorArchivosRef = useRef(null);
  const accesoRef = useRef(alPerderAcceso);
  const procesoRef = useRef(alProceso);
  const vistaAnterior = useRef(false);
  accesoRef.current = alPerderAcceso;
  procesoRef.current = alProceso;
  const central = ["ventanilla", "administrador"].includes(usuario.rol);
  const fechaElegida = convertirFechaBogota(fechaActuacion);
  const fechaAnterior = fechaElegida && fechaRespuesta !== null && fechaElegida.getTime() < fechaRespuesta * 1000;
  useEffect(() => { alVistaRegistro?.(registrando); }, [registrando, alVistaRegistro]);
  useEffect(() => { procesoRef.current(ocupado || bloqueado); }, [ocupado, bloqueado]);
  useEffect(() => {
    if (anularId) motivoInput.current?.focus();
    else if (registrando && abierto) canalInput.current?.focus();
    else if (vistaAnterior.current && abierto) registrarBoton.current?.focus();
    vistaAnterior.current = registrando;
  }, [registrando, anularId, abierto]);
  useEffect(() => {
    if (mensaje && !ocupado) cabeceraRef.current?.focus();
  }, [mensaje, ocupado]);
  useEffect(() => {
    if (errorArchivos) errorArchivosRef.current?.focus();
    else if (error) errorRef.current?.focus();
  }, [error, errorArchivos]);
  function volverAlHistorial() {
    if (enviando.current || bloqueado) return;
    setRegistrando(false); setAnularId(null);
    if (anularId && anularBoton.current?.isConnected) anularBoton.current.focus();
    else registrarBoton.current?.focus();
  }
  useEffect(() => () => {
    version.current++;
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setCargando(true); setErrorCarga("");
    (async () => {
      try {
        const respuesta = await solicitarApi(`${ruta}?pagina=${pagina}`);
        const datos = await respuesta.json();
        if (datos.success !== true || !Array.isArray(datos.registros) || datos.registros.length > 25 ||
          !datos.registros.every(registroValido) || !RESULTADOS[datos.resumen] ||
          !Number.isSafeInteger(datos.total) || datos.total < 0 || datos.pagina !== pagina ||
          datos.paginas !== Math.ceil(datos.total / 25)) throw new Error("Historial de entrega inválido.");
        if (vigente) {
          setHistorial(datos);
          if (pagina > Math.max(1, datos.paginas)) setPagina(Math.max(1, datos.paginas));
        }
      } catch (fallo) {
        if (vigente) {
          if (![503, 409].includes(fallo.status) && accesoRef.current(fallo)) return;
          setErrorCarga(fallo.message);
        }
      } finally { if (vigente) setCargando(false); }
    })();
    return () => { vigente = false; };
  }, [abierto, pagina, revision, ruta]);
  useEffect(() => {
    if (!registrando || documentos) return;
    let vigente = true;
    setErrorDocumentos("");
    (async () => {
      try {
        const respuesta = await solicitarApi(`${ruta}/documentos-respuesta`);
        const datos = await respuesta.json();
        if (datos.success !== true || !Array.isArray(datos.documentos) || datos.documentos.length > 5 ||
          datos.documentos.some(d => !idValido(d.id) || typeof d.nombre_archivo !== "string" ||
            !Number.isSafeInteger(d.tamano_bytes) || d.tamano_bytes < 5 || d.tamano_bytes > 10 * 1024 * 1024 ||
            !/^[a-f0-9]{64}$/.test(d.sha256)) ||
          new Set(datos.documentos.map(d => d.id)).size !== datos.documentos.length ||
          !Number.isFinite(datos.fecha_respuesta_epoch) || datos.fecha_respuesta_epoch <= 0) throw new Error("Catálogo de PDF de respuesta inválido.");
        if (vigente) {
          const anterior = catalogoAnterior.current;
          setDocumentos(datos.documentos);
          setFechaRespuesta(datos.fecha_respuesta_epoch);
          setSeleccionados(anterior ? datos.documentos.filter(d =>
            anterior.seleccionados.includes(d.id) && anterior.documentos.some(p => p.id === d.id && p.sha256 === d.sha256)
          ).map(d => d.id) : datos.documentos.map(d => d.id));
          if (anterior) {
            const cambios = datos.documentos.filter(d => !anterior.documentos.some(p => p.id === d.id && p.sha256 === d.sha256)).length;
            const retirados = anterior.documentos.filter(p => !datos.documentos.some(d => d.id === p.id)).length;
            setAvisoDocumentos(cambios || retirados
              ? `Lista actualizada: ${cambios} PDF nuevos o modificados sin seleccionar; ${retirados} retirados. Revisa cuáles incluir.`
              : "Lista actualizada sin cambios. Se conservaron tus selecciones.");
          }
          catalogoAnterior.current = null;
        }
      } catch (fallo) {
        if (vigente && !accesoRef.current(fallo)) setErrorDocumentos(fallo.message);
      }
    })();
    return () => { vigente = false; };
  }, [registrando, documentos, revisionDocumentos, ruta]);

  async function ejecutar(evento, anulacion = false) {
    evento.preventDefault();
    if (enviando.current) return;
    if (!intento.current && !anulacion && errorArchivos) return;
    if (!intento.current && !anulacion && (!documentos || errorDocumentos || historial?.fecha_real_disponible !== true)) {
      setError("No se puede confirmar hasta cargar los documentos y activar la migración 029."); return;
    }
    if (!intento.current && !anulacion && (!fechaElegida || fechaElegida.getTime() > Date.now() ||
        (fechaAnterior && justificacionFecha.trim().length < 10))) {
      setError("Indica una fecha real válida, no futura. Si es anterior a la respuesta, justifica con al menos 10 caracteres."); return;
    }
    if (!intento.current && !anulacion && (
      archivos.length > 5 || archivos.some(a => a.size > 10 * 1024 * 1024 || !/\.pdf$/i.test(a.name)) ||
      (resultado === "entrega_acreditada" && !archivos.length))) {
      setError("Acreditar requiere evidencia adicional de recepción. Adjunta hasta 5 PDF de 10 MB cada uno."); return;
    }
    if (!intento.current) {
      if (anulacion) intento.current = { ruta: `${ruta}/${anularId}/anulacion`,
        opciones: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: motivo.trim() }) } };
      else {
        const form = new FormData();
        Object.entries({ version: "3", clave: crypto.randomUUID(), canal, resultado, destinatario: destinatario.trim(), destino: destino.trim(),
          fecha_actuacion: fechaActuacion, justificacion_fecha_anterior: fechaAnterior ? justificacionFecha.trim() : "",
          documentos_respuesta: JSON.stringify(documentos.filter(d => seleccionados.includes(d.id))
            .map(d => ({ id: d.id, sha256: d.sha256 })).sort((a, b) => a.id - b.id)),
          observaciones: observaciones.trim() }).forEach(([k, v]) => form.append(k, v));
        archivos.forEach(a => form.append("archivos", a));
        intento.current = { ruta, opciones: { method: "POST", body: form } };
      }
    }
    enviando.current = true; setOcupado(true); setError(""); setMensaje("");
    try {
      await confirmar(intento.current.ruta, intento.current.opciones);
      setMensaje(anulacion ? "Anulación confirmada. La evidencia se conserva." : "Registro de envío/entrega confirmado.");
      intento.current = null; setBloqueado(false); setAnularId(null); setMotivo("");
      setRegistrando(false);
      setFechaActuacion(""); setJustificacionFecha(""); setObservaciones(""); setErrorArchivos("");
      setArchivos([]); if (archivosInput.current) archivosInput.current.value = "";
      setRevision(n => n + 1);
    } catch (fallo) {
      if (alPerderAcceso(fallo)) return;
      setError(fallo.message); setBloqueado(Boolean(incierto(fallo)));
      if (!incierto(fallo)) intento.current = null;
    } finally { enviando.current = false; setOcupado(false); }
  }
  async function descargar(registro, evidencia) {
    const actual = version.current;
    setError("");
    try {
      const respuesta = await solicitarApi(`${ruta}/${registro}/evidencias/${evidencia}`);
      const blob = await respuesta.blob();
      if (actual !== version.current) return;
      const url = URL.createObjectURL(blob);
      urlsRef.current.add(url);
      setUrls(prev => ({ ...prev, [evidencia]: url }));
    } catch (fallo) { if (actual === version.current && !alPerderAcceso(fallo)) setError(fallo.message); }
  }
  const cerrado = ocupado || bloqueado;
  function seleccionarArchivos(evento) {
    const nuevos = Array.from(evento.target.files || []);
    if (nuevos.length > 5 || nuevos.some(a => a.size < 5 || a.size > 10 * 1024 * 1024 || !/\.pdf$/i.test(a.name))) {
      setErrorArchivos("Selecciona hasta 5 PDF no vacíos de 10 MB cada uno. Se conserva la selección válida anterior.");
      evento.target.value = "";
      return;
    }
    setArchivos(nuevos); setErrorArchivos("");
  }
  const accionesRegistro = <div className="entregas-acciones entregas-campo--ancho">
    <button className="entregas-boton" type="button" disabled={cerrado} onClick={volverAlHistorial}>Volver al historial</button>
    <button className="entregas-boton entregas-boton--primario" type="submit" form="entrega-formulario"
      disabled={ocupado || cargando || Boolean(errorCarga) || (!bloqueado && (!documentos || Boolean(errorDocumentos) || historial?.fecha_real_disponible !== true))}>
      {ocupado ? "Confirmando…" : bloqueado ? "Reintentar registro" : "Confirmar envío/entrega"}
    </button>
  </div>;
  return <section className="detalle-seccion respuesta-grupo entregas-panel" aria-label="Seguimiento de envío y entrega">
    <div hidden={registrando}>
    <div className="entregas-cabecera">
      <div><span className="entregas-eyebrow">Seguimiento de la respuesta</span>
        <h3 ref={cabeceraRef} tabIndex={-1}>Envío y entrega de la respuesta</h3></div>
      {abierto && historial && <span className={`entregas-estado entregas-estado--${historial.resumen}`} role="status">
        Seguimiento: {RESULTADOS[historial.resumen]}</span>}
    </div>
    <p className="entregas-aviso entregas-aviso--legal"><strong>Respondido no significa entregado.</strong> Existe una respuesta institucional; no acredita su entrega. Este registro es manual y no envía correos ni constituye por sí solo una notificación legal.</p>
    <div className="entregas-acciones">
      <button className="entregas-boton" type="button" onClick={() => setAbierto(v => !v)} disabled={cerrado}
        aria-expanded={abierto} aria-controls="entregas-contenido">
        {abierto ? "Ocultar seguimiento de entrega" : "Ver seguimiento de entrega"}
      </button>
      {abierto && <button className="entregas-boton entregas-boton--secundario" type="button"
        onClick={() => setRevision(n => n + 1)} disabled={cerrado || cargando}>Actualizar entregas</button>}
      {abierto && central && historial && <button ref={registrarBoton}
        className="entregas-boton entregas-boton--primario" type="button"
        disabled={cerrado || cargando || Boolean(errorCarga) || historial.resumen === "entrega_acreditada" || historial.fecha_real_disponible !== true}
        aria-expanded={registrando} aria-controls="entrega-formulario"
        onClick={() => { if (!fechaActuacion) setFechaActuacion(ahoraBogota()); setRegistrando(true); setAnularId(null); setError(""); }}>
        Registrar envío/entrega
      </button>}
    </div>
    </div>
    {abierto && <>
      <div id="entregas-contenido" className="entregas-contenido">
      {cargando && <p role="status" className="entregas-mensaje entregas-mensaje--carga">Cargando seguimiento de entrega…</p>}
      {errorCarga && <p role="alert" className="entregas-mensaje entregas-mensaje--error">{errorCarga}</p>}
      {central && historial?.automatico_disponible === false && <p role="status" className="entregas-aviso entregas-aviso--sistema">
        El registro automático requiere activar la migración 026. El historial y sus archivos siguen disponibles.
      </p>}
      {central && historial && historial.automatico_disponible !== false && historial.fecha_real_disponible !== true && <p role="status" className="entregas-aviso entregas-aviso--sistema">
        El registro con fecha real requiere aplicar y verificar la migración 029. El historial y sus archivos siguen disponibles.
      </p>}
      {mensaje && <p role="status" className="entregas-mensaje entregas-mensaje--exito">{mensaje}</p>}
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="entregas-mensaje entregas-mensaje--error">{error}</p>}
      {bloqueado && <p role="status" className="entregas-aviso entregas-aviso--pendiente">Confirmación pendiente: reintenta sin modificar datos ni PDF. Si cierras la respuesta o recargas, consulta el historial antes de iniciar otro intento.</p>}
      {historial && <>
        <div hidden={registrando}>
        {!historial.registros.length && <div className="entregas-vacio">
          <strong>Aún no hay actuaciones registradas</strong>
          <p>No hay registros de envío o entrega.</p>
          <p>{central ? "Cuando realices el envío o la entrega, regístralo aquí y adjunta la evidencia correspondiente."
            : "Ventanilla registrará aquí las actuaciones y sus evidencias."}</p>
        </div>}
        {historial.registros.length > 0 && <div className="entregas-historial"><h4>Historial de actuaciones</h4>
        {historial.registros.map(registro => <article key={registro.id}
          className={`entregas-tarjeta${registro.anulado_en_utc ? " entregas-tarjeta--anulada" : ""}`}
          aria-label={`Registro de entrega ${registro.id}`}>
          <div className="entregas-tarjeta-cabecera">
            <h4>{RESULTADOS[registro.resultado]}{registro.anulado_en_utc ? " · Anulado" : ""}</h4>
            <span className="entregas-referencia">Registro #{registro.id}</span>
          </div>
          <dl className="traslados-datos">
            {[["Canal", CANALES[registro.canal]], ["Destinatario", registro.destinatario], ["Destino", registro.destino],
              [registro.fecha_real_declarada ? "Fecha real de la actuación" : "Fecha de actuación histórica", fecha(registro.fecha_actuacion_utc)], ["Registrado en el sistema", fecha(registro.creado_en_utc)],
              ["Responsable", registro.actor_nombre], ["Observaciones", registro.observaciones || "Sin observaciones"]]
              .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {!registro.fecha_real_declarada && <p className="entregas-aviso">Registro histórico: la fecha conserva el significado de su formulario original; no se reconstruyó una fecha real.</p>}
          {registro.justificacion_fecha_anterior && <p className="entregas-aviso"><strong>Justificación de fecha anterior: </strong>{registro.justificacion_fecha_anterior}</p>}
          {registro.anulado_en_utc && <p className="entregas-anulacion">Anulado por {registro.anulador_nombre}: {registro.motivo_anulacion} · {fecha(registro.anulado_en_utc)}</p>}
          <ul className="detalle-archivos">{registro.evidencias.map(e => <li key={e.id}>
            <span>{e.origen === "documento_respuesta" ? "Documento de respuesta" :
              e.origen === "evidencia_adicional" ? "Evidencia adicional" : "Adjunto histórico"}</span>
            {urls[e.id] ? <a href={urls[e.id]} target="_blank" rel="noreferrer">{e.nombre_archivo}</a>
              : <button className="entregas-boton entregas-boton--secundario" type="button" disabled={ocupado} onClick={() => descargar(registro.id, e.id)}>Abrir evidencia: {e.nombre_archivo}</button>}
          </li>)}</ul>
          {central && !registro.anulado_en_utc && <button className="entregas-boton entregas-boton--peligro"
            type="button" disabled={cerrado}
            onClick={e => { anularBoton.current = e.currentTarget; setAnularId(registro.id); setRegistrando(false); setMotivo(""); setError(""); }}>Anular registro {registro.id}</button>}
        </article>)}</div>}
        {historial.paginas > 1 && <nav aria-label="Páginas de entregas">
          <button className="entregas-boton" type="button" disabled={cerrado || cargando || pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <span> Página {pagina} de {Math.max(1, historial.paginas)} </span>
          <button className="entregas-boton" type="button" disabled={cerrado || cargando || pagina >= historial.paginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
        </nav>}
        </div>
        {central && (anularId ? <form className="auth-form entregas-formulario" aria-labelledby="entrega-anulacion-titulo" onSubmit={e => ejecutar(e, true)}>
          <h4 id="entrega-anulacion-titulo">Anular registro {anularId}</h4>
          <label htmlFor="entrega-anulacion">Motivo de anulación</label>
          <textarea ref={motivoInput} id="entrega-anulacion" required minLength={10} maxLength={2000} disabled={cerrado}
            value={motivo} onChange={e => setMotivo(e.target.value)} />
          <div className="entregas-acciones">
            <button className="entregas-boton" type="button" disabled={cerrado} onClick={volverAlHistorial}>Cancelar anulación</button>
            <button className="entregas-boton entregas-boton--peligro" disabled={ocupado}>{bloqueado ? "Reintentar anulación" : "Confirmar anulación"}</button>
          </div>
        </form> : (historial.resumen !== "entrega_acreditada" || bloqueado) && registrando ? <form id="entrega-formulario"
          className="auth-form entregas-formulario entregas-formulario--grid" aria-labelledby="entrega-formulario-titulo" aria-describedby="entrega-formulario-ayuda" onSubmit={e => ejecutar(e)}>
          <h4 id="entrega-formulario-titulo">Registrar envío/entrega</h4>
          <p id="entrega-formulario-ayuda" className="entregas-aviso entregas-aviso--legal entregas-campo--ancho">
            Registro manual: no envía correos ni determina la validez legal de una notificación.
            {" "}{resultado === "entrega_acreditada" ? "Adjunta una constancia de recepción distinta del oficio."
              : resultado === "intento_fallido" ? "Describe por qué no fue posible la entrega. No acredita recepción."
              : "Deja constancia del envío realizado. Enviado no significa recibido."}
          </p>
          <h5 className="entregas-campo--ancho">1. Datos de la actuación</h5>
          <div className="auth-field"><label htmlFor="entrega-canal">Canal</label>
            <select ref={canalInput} id="entrega-canal" value={canal} disabled={cerrado} onChange={e => { setCanal(e.target.value); setDestino(""); }}>
              {Object.entries(CANALES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="auth-field"><label htmlFor="entrega-resultado">Resultado</label>
            <select id="entrega-resultado" value={resultado} disabled={cerrado} onChange={e => setResultado(e.target.value)}>
              {Object.entries(RESULTADOS).filter(([k]) => k !== "pendiente_de_envio").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="auth-field"><label htmlFor="entrega-destinatario">Destinatario</label>
            <input id="entrega-destinatario" required maxLength={150} value={destinatario} disabled={cerrado} onChange={e => setDestinatario(e.target.value)} /></div>
          <div className="auth-field"><label htmlFor="entrega-destino">{canal === "correo_electronico" ? "Correo de destino" : "Lugar o dirección de entrega"}</label>
            <input id="entrega-destino" type={canal === "correo_electronico" ? "email" : "text"} required maxLength={500} value={destino} disabled={cerrado} onChange={e => setDestino(e.target.value)} /></div>
          <h5 className="entregas-campo--ancho">2. Fecha real de la actuación</h5>
          <div className="auth-field entregas-campo--ancho">
            <label htmlFor="entrega-fecha">Fecha y hora de actuación (Bogotá)</label>
            <input id="entrega-fecha" type="datetime-local" step="1" required value={fechaActuacion}
              max={ahoraBogota()} disabled={cerrado} onChange={e => setFechaActuacion(e.target.value)} />
            <small>Indica cuándo ocurrió el envío, entrega o intento. No se permiten fechas futuras.</small>
          </div>
          {fechaAnterior && <div className="auth-field entregas-campo--ancho">
            <label htmlFor="entrega-justificacion-fecha">Justificación de actuación anterior a la respuesta</label>
            <textarea id="entrega-justificacion-fecha" required minLength={10} maxLength={2000}
              value={justificacionFecha} disabled={cerrado} onChange={e => setJustificacionFecha(e.target.value)} />
            <small>La actuación precede al registro de la respuesta. Explica la diferencia (mínimo 10 caracteres).</small>
          </div>}
          <p className="entregas-aviso entregas-campo--ancho">Indica la fecha real de la actuación. La fecha de registro se asignará automáticamente (hora Bogotá). Reintentar una operación confirmada no la duplica ni modifica sus fechas.</p>
          <fieldset className="entregas-campo--ancho entregas-documentos" disabled={cerrado}>
            <legend>3. Documentos de la respuesta institucional</legend>
            <p>Se incluyen por defecto. Puedes desmarcarlos; no sustituyen la constancia de recepción.</p>
            {!documentos && !errorDocumentos && <p role="status">Cargando PDF de respuesta…</p>}
            {errorDocumentos && <><p role="alert">{errorDocumentos}</p>
              <button type="button" className="entregas-boton" onClick={() => setRevisionDocumentos(n => n + 1)}>Reintentar documentos de respuesta</button></>}
            {documentos?.length === 0 && <p>La respuesta institucional no tiene PDF adjuntos.</p>}
            {documentos?.map(d => <label key={d.id} className="entregas-documento">
              <input type="checkbox" checked={seleccionados.includes(d.id)} onChange={e => setSeleccionados(prev =>
                e.target.checked ? [...prev, d.id] : prev.filter(id => id !== d.id))} />
              <span>{d.nombre_archivo} · {(d.tamano_bytes / (1024 * 1024)).toFixed(1)} MB</span>
            </label>)}
            {documentos && <><small>{seleccionados.length} de {documentos.length} PDF incluidos. Hasta 5 documentos de respuesta.</small>
              <button type="button" className="entregas-boton entregas-boton--secundario"
                onClick={() => { catalogoAnterior.current = { documentos, seleccionados }; setDocumentos(null); setErrorDocumentos(""); setAvisoDocumentos(""); }}>
                Recargar lista de PDF
              </button><small>Solo consulta la lista; no modifica los originales. Conserva selecciones de PDF sin cambios.</small></>}
            {avisoDocumentos && <p role="status">{avisoDocumentos}</p>}
          </fieldset>
          <h5 className="entregas-campo--ancho">4. Constancia de recepción y observaciones</h5>
          <div className="auth-field entregas-campo--ancho"><label htmlFor="entrega-observaciones">Observaciones {resultado === "intento_fallido" ? "(obligatorias)" : "(opcionales)"}</label>
            <textarea id="entrega-observaciones" required={resultado === "intento_fallido"} minLength={resultado === "intento_fallido" ? 10 : undefined} maxLength={2000}
              value={observaciones} disabled={cerrado} onChange={e => setObservaciones(e.target.value)} /></div>
          <div className="auth-field entregas-campo--ancho"><label htmlFor="entrega-pdf">Evidencias PDF {resultado === "entrega_acreditada" ? "(obligatorias)" : "(opcionales)"}</label>
            <input ref={archivosInput} id="entrega-pdf" type="file" accept=".pdf,application/pdf" multiple disabled={cerrado}
              required={resultado === "entrega_acreditada" && !archivos.length} onChange={seleccionarArchivos} />
            <small>Hasta 5 PDF adicionales de 10 MB cada uno, sin contraseña. Para acreditar, adjunta constancia de recepción diferente al oficio de respuesta.</small></div>
          {errorArchivos && <p ref={errorArchivosRef} tabIndex={-1} role="alert" className="entregas-campo--ancho">{errorArchivos}</p>}
          {archivos.length > 0 && <div className="entregas-campo--ancho entregas-seleccion">
            <strong>PDF seleccionados para este registro</strong>
            <ul>{archivos.map((a, i) => <li key={`${i}:${a.name}`}>{a.name} · {(a.size / (1024 * 1024)).toFixed(1)} MB</li>)}</ul>
            <button className="entregas-boton entregas-boton--secundario" type="button" disabled={cerrado}
              onClick={() => { setArchivos([]); setErrorArchivos(""); if (archivosInput.current) archivosInput.current.value = ""; }}>Quitar PDF seleccionados</button>
          </div>}
          {contenedorAcciones ? createPortal(accionesRegistro, contenedorAcciones) : accionesRegistro}
        </form> : historial.resumen === "entrega_acreditada" ? <p className="entregas-aviso">Existe entrega acreditada vigente. Para corregirla, primero anula el registro con motivo.</p> : null)}
      </>}
      </div>
    </>}
  </section>;
}
