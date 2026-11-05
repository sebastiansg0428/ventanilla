import { useEffect, useRef, useState } from "react";
import { solicitarApi } from "../servicios/api";

const RESULTADOS = { pendiente_de_envio: "Pendiente de envío", enviado: "Envío registrado",
  entrega_acreditada: "Entrega acreditada", intento_fallido: "Intento fallido" };
const CANALES = { correo_electronico: "Correo electrónico (manual)", presencial: "Entrega presencial", mensajeria: "Correo físico o mensajería" };
const incierto = (error) => !error.status || error.status >= 500 || error.resultadoIncierto;
const idValido = valor => Number.isSafeInteger(valor) && valor > 0;
const fechaValida = valor => typeof valor === "string" &&
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(valor) &&
  Number.isFinite(new Date(`${valor.replace(" ", "T")}Z`).getTime());
function registroValido(r) {
  return r && idValido(r.id) && CANALES[r.canal] && RESULTADOS[r.resultado] && r.resultado !== "pendiente_de_envio" &&
    ["destinatario", "destino", "actor_nombre", "observaciones"].every(c => typeof r[c] === "string") &&
    fechaValida(r.fecha_actuacion_utc) && fechaValida(r.creado_en_utc) &&
    (r.anulado_en_utc === null || (fechaValida(r.anulado_en_utc) &&
      typeof r.anulador_nombre === "string" && typeof r.motivo_anulacion === "string")) &&
    Array.isArray(r.evidencias) && r.evidencias.length <= 5 &&
    r.evidencias.every(e => e && idValido(e.id) && typeof e.nombre_archivo === "string" &&
      Number.isSafeInteger(e.tamano_bytes) && e.tamano_bytes > 0 && /^[a-f0-9]{64}$/.test(e.sha256));
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

export function SeguimientoEntrega({ radicado, usuario, alProceso, alPerderAcceso }) {
  const ruta = `/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/entregas`;
  const [abierto, setAbierto] = useState(false);
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
  const [momento, setMomento] = useState("");
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
  const archivosInput = useRef(null);
  const accesoRef = useRef(alPerderAcceso);
  accesoRef.current = alPerderAcceso;
  const central = ["ventanilla", "administrador"].includes(usuario.rol);
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

  async function ejecutar(evento, anulacion = false) {
    evento.preventDefault();
    if (enviando.current) return;
    if (!intento.current && !anulacion && (
      archivos.length > 5 || archivos.some(a => a.size > 10 * 1024 * 1024 || !/\.pdf$/i.test(a.name)) ||
      (resultado === "entrega_acreditada" && !archivos.length))) {
      setError("Acreditar requiere evidencia. Adjunta hasta 5 PDF de 10 MB cada uno."); return;
    }
    if (!intento.current) {
      if (anulacion) intento.current = { ruta: `${ruta}/${anularId}/anulacion`,
        opciones: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: motivo.trim() }) } };
      else {
        const form = new FormData();
        Object.entries({ clave: crypto.randomUUID(), canal, resultado, destinatario: destinatario.trim(), destino: destino.trim(),
          fecha_actuacion: momento, observaciones: observaciones.trim() }).forEach(([k, v]) => form.append(k, v));
        archivos.forEach(a => form.append("archivos", a));
        intento.current = { ruta, opciones: { method: "POST", body: form } };
      }
    }
    enviando.current = true; setOcupado(true); alProceso(true); setError(""); setMensaje("");
    try {
      await confirmar(intento.current.ruta, intento.current.opciones);
      setMensaje(anulacion ? "Anulación confirmada. La evidencia se conserva." : "Registro de envío/entrega confirmado.");
      intento.current = null; setBloqueado(false); setAnularId(null); setMotivo("");
      setArchivos([]); if (archivosInput.current) archivosInput.current.value = "";
      setRevision(n => n + 1);
    } catch (fallo) {
      if (alPerderAcceso(fallo)) return;
      setError(fallo.message); setBloqueado(Boolean(incierto(fallo)));
      if (!incierto(fallo)) intento.current = null;
    } finally { enviando.current = false; setOcupado(false); alProceso(false); }
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
  return <section className="detalle-seccion respuesta-grupo entregas-panel" aria-label="Seguimiento de envío y entrega">
    <h3>Envío y entrega de la respuesta</h3>
    <p>«Respondido» significa que existe una respuesta institucional; no acredita su entrega. Este registro es manual y no envía correos ni constituye por sí solo una notificación legal.</p>
    <button type="button" onClick={() => setAbierto(v => !v)} disabled={cerrado} aria-expanded={abierto}>
      {abierto ? "Ocultar seguimiento de entrega" : "Ver seguimiento de entrega"}
    </button>
    {abierto && <>
      <button type="button" onClick={() => setRevision(n => n + 1)} disabled={cerrado}>Actualizar entregas</button>
      {cargando && <p role="status">Cargando seguimiento de entrega…</p>}
      {errorCarga && <p role="alert">{errorCarga}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {error && <p role="alert">{error}</p>}
      {bloqueado && <p role="status">Confirmación pendiente: reintenta sin modificar datos ni PDF. Si cierras la respuesta o recargas, consulta el historial antes de iniciar otro intento.</p>}
      {historial && <>
        <p role="status">Seguimiento: {RESULTADOS[historial.resumen]}</p>
        {!historial.registros.length && <p>No hay registros de envío o entrega.</p>}
        {historial.registros.map(registro => <article key={registro.id} className="detalle-seccion" aria-label={`Registro de entrega ${registro.id}`}>
          <h4>{RESULTADOS[registro.resultado]}{registro.anulado_en_utc ? " · Anulado" : ""}</h4>
          <dl className="traslados-datos">
            {[["Canal", CANALES[registro.canal]], ["Destinatario", registro.destinatario], ["Destino", registro.destino],
              ["Actuación", fecha(registro.fecha_actuacion_utc)], ["Registrado", fecha(registro.creado_en_utc)],
              ["Responsable", registro.actor_nombre], ["Observaciones", registro.observaciones || "Sin observaciones"]]
              .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {registro.anulado_en_utc && <p>Anulado por {registro.anulador_nombre}: {registro.motivo_anulacion} · {fecha(registro.anulado_en_utc)}</p>}
          <ul className="detalle-archivos">{registro.evidencias.map(e => <li key={e.id}>
            {urls[e.id] ? <a href={urls[e.id]} target="_blank" rel="noreferrer">{e.nombre_archivo}</a>
              : <button type="button" disabled={ocupado} onClick={() => descargar(registro.id, e.id)}>Abrir evidencia: {e.nombre_archivo}</button>}
          </li>)}</ul>
          {central && !registro.anulado_en_utc && <button type="button" disabled={cerrado}
            onClick={() => { setAnularId(registro.id); setMotivo(""); setError(""); }}>Anular registro {registro.id}</button>}
        </article>)}
        <nav aria-label="Páginas de entregas">
          <button type="button" disabled={cerrado || cargando || pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <span> Página {pagina} de {Math.max(1, historial.paginas)} </span>
          <button type="button" disabled={cerrado || cargando || pagina >= historial.paginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
        </nav>
        {central && (anularId ? <form className="auth-form" onSubmit={e => ejecutar(e, true)}>
          <h4>Anular registro {anularId}</h4>
          <label htmlFor="entrega-anulacion">Motivo de anulación</label>
          <textarea id="entrega-anulacion" required minLength={10} maxLength={2000} disabled={cerrado}
            value={motivo} onChange={e => setMotivo(e.target.value)} />
          <button type="button" disabled={cerrado} onClick={() => setAnularId(null)}>Cancelar anulación</button>
          <button disabled={ocupado}>{bloqueado ? "Reintentar anulación" : "Confirmar anulación"}</button>
        </form> : historial.resumen !== "entrega_acreditada" || bloqueado ? <form className="auth-form" onSubmit={e => ejecutar(e)}>
          <h4>Registrar envío/entrega</h4>
          <div className="auth-field"><label htmlFor="entrega-canal">Canal</label>
            <select id="entrega-canal" value={canal} disabled={cerrado} onChange={e => { setCanal(e.target.value); setDestino(""); }}>
              {Object.entries(CANALES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="auth-field"><label htmlFor="entrega-resultado">Resultado</label>
            <select id="entrega-resultado" value={resultado} disabled={cerrado} onChange={e => setResultado(e.target.value)}>
              {Object.entries(RESULTADOS).filter(([k]) => k !== "pendiente_de_envio").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="auth-field"><label htmlFor="entrega-destinatario">Destinatario</label>
            <input id="entrega-destinatario" required maxLength={150} value={destinatario} disabled={cerrado} onChange={e => setDestinatario(e.target.value)} /></div>
          <div className="auth-field"><label htmlFor="entrega-destino">{canal === "correo_electronico" ? "Correo de destino" : "Lugar o dirección de entrega"}</label>
            <input id="entrega-destino" type={canal === "correo_electronico" ? "email" : "text"} required maxLength={500} value={destino} disabled={cerrado} onChange={e => setDestino(e.target.value)} /></div>
          <div className="auth-field"><label htmlFor="entrega-fecha">Fecha y hora de actuación (Bogotá)</label>
            <input id="entrega-fecha" type="datetime-local" required value={momento} disabled={cerrado} onChange={e => setMomento(e.target.value)} /></div>
          <div className="auth-field"><label htmlFor="entrega-observaciones">Observaciones {resultado === "intento_fallido" ? "(obligatorias)" : "(opcionales)"}</label>
            <textarea id="entrega-observaciones" required={resultado === "intento_fallido"} minLength={resultado === "intento_fallido" ? 10 : undefined} maxLength={2000}
              value={observaciones} disabled={cerrado} onChange={e => setObservaciones(e.target.value)} /></div>
          <div className="auth-field"><label htmlFor="entrega-pdf">Evidencias PDF {resultado === "entrega_acreditada" ? "(obligatorias)" : "(opcionales)"}</label>
            <input ref={archivosInput} id="entrega-pdf" type="file" accept=".pdf,application/pdf" multiple disabled={cerrado}
              required={resultado === "entrega_acreditada"} onChange={e => setArchivos(Array.from(e.target.files || []))} />
            <small>Hasta 5 PDF de 10 MB cada uno, sin contraseña.</small></div>
          <button className="auth-submit" disabled={ocupado || cargando || Boolean(errorCarga)}>{ocupado ? "Confirmando…" : bloqueado ? "Reintentar registro" : "Confirmar envío/entrega"}</button>
        </form> : <p>Existe entrega acreditada vigente. Para corregirla, primero anula el registro con motivo.</p>)}
      </>}
    </>}
  </section>;
}
