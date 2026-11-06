import { useEffect, useRef, useState } from "react";
import { solicitarApi } from "../servicios/api";

const fecha = valor => valor ? new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short",
}).format(new Date(`${valor.replace(" ", "T")}Z`)) : "No registrada";
const idValido = valor => Number.isSafeInteger(valor) && valor > 0;
const fechaValida = valor => typeof valor === "string" &&
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/.test(valor) &&
  Number.isFinite(new Date(`${valor.replace(" ", "T")}Z`).getTime());
function recepcionValida(r) {
  return r && idValido(r.id) && idValido(r.respuesta_id) && idValido(r.dependencia_origen_id) &&
    typeof r.numero_radicado === "string" && typeof r.contenido === "string" &&
    (r.disponible_en_utc === null || fechaValida(r.disponible_en_utc)) &&
    (r.primera_apertura_utc === null || (fechaValida(r.primera_apertura_utc) && typeof r.actor_nombre === "string"));
}
async function datosApi(ruta, opciones) {
  const datos = await (await solicitarApi(ruta, opciones)).json();
  if (datos.success !== true) throw new Error(datos.message || "Respuesta interna inválida.");
  return datos;
}
function EstadoRecepcion({ recepcion }) {
  return <dl className="traslados-datos">
    <div><dt>Disponibilidad digital (Bogotá)</dt><dd>{recepcion.historica
      ? "Respuesta histórica; fecha de disponibilidad anterior desconocida" : fecha(recepcion.disponible_en_utc)}</dd></div>
    <div><dt>Primera apertura en el sistema (Bogotá)</dt><dd>{recepcion.primera_apertura_utc
      ? `${fecha(recepcion.primera_apertura_utc)} · ${recepcion.actor_nombre}` : "Sin primera apertura registrada"}</dd></div>
  </dl>;
}
function useApertura(recepcion, usuario, alConfirmar) {
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const confirmarRef = useRef(alConfirmar);
  confirmarRef.current = alConfirmar;
  useEffect(() => {
    if (!recepcion || recepcion.primera_apertura_utc || usuario.rol !== "funcionario" ||
      usuario.dependencia_id !== recepcion.dependencia_origen_id) return;
    let vigente = true;
    setError("");
    datosApi(`/api/respuestas-internas/${recepcion.id}/apertura`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(datos => {
        if (!recepcionValida(datos.recepcion) || datos.recepcion.id !== recepcion.id ||
          !datos.recepcion.primera_apertura_utc) throw new Error("Apertura no confirmada; reintenta.");
        if (vigente) confirmarRef.current(datos.recepcion);
      }).catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [recepcion?.id, recepcion?.primera_apertura_utc, recepcion?.dependencia_origen_id, usuario.rol, usuario.dependencia_id, revision]);
  return error ? <div role="alert">{error} <button type="button" className="entregas-boton"
    onClick={() => setRevision(n => n + 1)}>Reintentar registro de apertura</button></div>
    : recepcion && !recepcion.primera_apertura_utc && usuario.rol === "funcionario" &&
      usuario.dependencia_id === recepcion.dependencia_origen_id
      ? <p role="status">Confirmando primera apertura en el servidor…</p> : null;
}
export function TrazabilidadInterna({ radicado, usuario }) {
  const auto = usuario.rol === "funcionario" && usuario.dependencia_id === radicado.dependencia_remitente_id;
  const [abierto, setAbierto] = useState(auto);
  const [recepcion, setRecepcion] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setError("");
    datosApi(`/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/recepcion-interna`)
      .then(datos => {
        if (!recepcionValida(datos.recepcion)) throw new Error("Recepción interna inválida.");
        if (vigente) setRecepcion(datos.recepcion);
      }).catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [abierto, radicado.numero_radicado, revision]);
  const falloApertura = useApertura(abierto && auto ? recepcion : null, usuario, setRecepcion);
  return <section className="detalle-seccion respuesta-grupo entregas-panel">
    <h3>Recepción digital interna</h3>
    <p>Disponible dentro del sistema, sin evidencia física de envío. Una apertura no certifica comprensión ni notificación legal.</p>
    <button className="entregas-boton" type="button" aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>
      {abierto ? "Ocultar recepción digital" : "Ver recepción digital"}
    </button>
    {abierto && <><button className="entregas-boton" type="button" onClick={() => setRevision(n => n + 1)}>Actualizar recepción digital</button>
      {error && <p role="alert">{error}</p>}
      {!recepcion && !error && <p role="status">Cargando recepción digital…</p>}
      {recepcion && <EstadoRecepcion recepcion={recepcion} />}{falloApertura}</>}
  </section>;
}
export function RespuestasInternas({ usuario }) {
  const [abierto, setAbierto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState("todas");
  const [revision, setRevision] = useState(0);
  const [lista, setLista] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const solicitud = useRef(0);
  const urls = useRef(new Set());
  const cabecera = useRef(null);
  const botonAbrir = useRef(null);
  function liberar() { urls.current.forEach(u => URL.revokeObjectURL(u)); urls.current.clear(); }
  useEffect(() => () => { solicitud.current++; liberar(); }, []);
  function cerrarDetalle() {
    solicitud.current++; setDetalle(null); setCargandoDetalle(false); liberar();
    if (botonAbrir.current?.isConnected) botonAbrir.current.focus();
  }
  useEffect(() => { if (detalle) cabecera.current?.focus(); }, [detalle?.recepcion.id]);
  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setCargando(true); setError(""); setLista(null);
    datosApi(`/api/respuestas-internas?pagina=${pagina}&estado=${estado}`).then(datos => {
      if (!Array.isArray(datos.registros) || datos.registros.length > 25 ||
        !datos.registros.every(recepcionValida) || datos.pagina !== pagina ||
        !Number.isSafeInteger(datos.total) || datos.total < 0 ||
        datos.paginas !== Math.ceil(datos.total / 25) ||
        !datos.resumen || !["total", "pendientes", "leidas"].every(k => Number.isSafeInteger(datos.resumen[k]) && datos.resumen[k] >= 0) ||
        datos.resumen.total !== datos.resumen.pendientes + datos.resumen.leidas) throw new Error("Bandeja interna inválida.");
      if (vigente) {
        setLista(datos);
        if (pagina > Math.max(1, datos.paginas)) setPagina(Math.max(1, datos.paginas));
      }
    }).catch(e => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [abierto, pagina, estado, revision]);
  async function abrirRespuesta(id) {
    cerrarDetalle();
    const actual = ++solicitud.current;
    const creadas = [];
    setCargandoDetalle(true); setError("");
    try {
      const datos = await datosApi(`/api/respuestas-internas/${id}`);
      if (!recepcionValida(datos.recepcion) || datos.recepcion.id !== id ||
        !Array.isArray(datos.documentos) || datos.documentos.length > 5 ||
        datos.documentos.some(d => !idValido(d.id) || typeof d.nombre_archivo !== "string" ||
          !Number.isSafeInteger(d.tamano_bytes) || d.tamano_bytes < 1)) throw new Error("Detalle interno inválido.");
      const documentos = [];
      for (const d of datos.documentos) {
        const respuesta = await solicitarApi(`/api/respuestas-internas/${id}/documentos/${d.id}`);
        const blob = await respuesta.blob();
        if (actual !== solicitud.current) return;
        const url = URL.createObjectURL(blob); creadas.push(url);
        documentos.push({ ...d, url });
      }
      if (actual !== solicitud.current) return;
      creadas.forEach(u => urls.current.add(u));
      setDetalle({ recepcion: datos.recepcion, documentos });
    } catch (e) { if (actual === solicitud.current) setError(e.message); }
    finally {
      creadas.forEach(u => { if (!urls.current.has(u)) URL.revokeObjectURL(u); });
      if (actual === solicitud.current) setCargandoDetalle(false);
    }
  }
  const errorApertura = useApertura(detalle?.recepcion, usuario, recepcion => {
    setDetalle(prev => prev ? { ...prev, recepcion } : prev);
    setRevision(n => n + 1);
  });
  return <section className="detalle-seccion entregas-panel internas-bandeja" aria-label="Respuestas internas recibidas">
    <h2>Respuestas internas recibidas</h2>
    <p>Respuesta digital dirigida a tu dependencia de origen. Se registra la primera apertura al mostrar correctamente la respuesta y sus adjuntos.</p>
    <button type="button" className="entregas-boton" aria-expanded={abierto}
      onClick={() => { cerrarDetalle(); setAbierto(v => !v); }}> {abierto ? "Ocultar bandeja interna" : "Ver bandeja interna"}</button>
    {abierto && <>
      <label>Filtrar respuestas internas <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }}>
        <option value="todas">Todas</option><option value="pendientes">Sin apertura</option><option value="leidas">Con apertura</option>
      </select></label>
      <button className="entregas-boton" type="button" disabled={cargando} onClick={() => setRevision(n => n + 1)}>Actualizar bandeja interna</button>
      {cargando && <p role="status">Cargando bandeja interna…</p>}
      {error && <p role="alert">{error}</p>}
      {lista && <><p role="status">Total: {lista.resumen.total} · Sin apertura: {lista.resumen.pendientes} · Con apertura: {lista.resumen.leidas}</p>
        {!lista.registros.length && <p>No hay respuestas internas para este filtro.</p>}
        <ul className="detalle-archivos">{lista.registros.map(r => <li key={r.id}>
          <strong>{r.numero_radicado}</strong> · {r.dependencia_destino} · {r.primera_apertura_utc ? "Con apertura" : "Sin apertura"}
          <button type="button" className="entregas-boton" onClick={e => {
            botonAbrir.current = e.currentTarget; abrirRespuesta(r.id);
          }}>Abrir respuesta interna {r.numero_radicado}</button>
        </li>)}</ul>
        {lista.paginas > 1 && <nav aria-label="Páginas de respuestas internas">
          <button className="entregas-boton" type="button" disabled={cargando || pagina === 1} onClick={() => setPagina(n => n - 1)}>Anterior</button>
          <span>Página {pagina} de {lista.paginas}</span>
          <button className="entregas-boton" type="button" disabled={cargando || pagina >= lista.paginas} onClick={() => setPagina(n => n + 1)}>Siguiente</button>
        </nav>}</>}
      {cargandoDetalle && <p role="status">Cargando respuesta interna y PDF…</p>}
      {(detalle || cargandoDetalle) && <button className="entregas-boton" type="button" onClick={cerrarDetalle}>Cerrar respuesta interna</button>}
      {detalle && <article className="entregas-tarjeta" aria-label="Respuesta interna abierta">
        <h3 ref={cabecera} tabIndex={-1}>{detalle.recepcion.numero_radicado}</h3>
        <p>Dependencia responsable: {detalle.recepcion.dependencia_destino}</p>
        <p className="detalle-asunto">{detalle.recepcion.contenido}</p>
        <ul className="detalle-archivos">{detalle.documentos.map(d => <li key={d.id}>
          <a href={d.url} target="_blank" rel="noreferrer">{d.nombre_archivo}</a>
        </li>)}</ul>
        <EstadoRecepcion recepcion={detalle.recepcion} />{errorApertura}
      </article>}
    </>}
  </section>;
}
