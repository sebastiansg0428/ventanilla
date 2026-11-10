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
function nombreOrigen(recepcion) {
  return typeof recepcion.dependencia_remitente === "string" && recepcion.dependencia_remitente.trim()
    ? recepcion.dependencia_remitente.trim() : "Dependencia de origen no registrada";
}
function EstadoRecepcion({ recepcion }) {
  const abierta = Boolean(recepcion.primera_apertura_utc);
  const disponibilidadConFecha = !recepcion.historica && Boolean(recepcion.disponible_en_utc);
  return <div className="recepcion-interna">
    <div className="recepcion-interna-destinatario">
      <strong>Respuesta dirigida a</strong>
      <p>{nombreOrigen(recepcion)}</p>
      <small>Es la dependencia que inició el radicado, no la oficina que respondió.</small>
    </div>
    <ol className="recepcion-interna-hitos" aria-label="Hitos de recepción digital interna">
      <li className={`recepcion-interna-hito ${disponibilidadConFecha ? "recepcion-interna-hito--registrado" : "recepcion-interna-hito--sin-fecha"}`}>
        <span className="recepcion-interna-indicador" aria-hidden="true">1</span>
        <div>
          <h4>Respuesta disponible</h4>
          {recepcion.historica
            ? <p>Respuesta histórica; fecha de disponibilidad anterior desconocida</p>
            : <dl><dt>Disponibilidad digital (Bogotá)</dt><dd>{fecha(recepcion.disponible_en_utc)}</dd></dl>}
        </div>
      </li>
      <li className={`recepcion-interna-hito ${abierta ? "recepcion-interna-hito--registrado" : "recepcion-interna-hito--pendiente"}`}>
        <span className="recepcion-interna-indicador" aria-hidden="true">2</span>
        <div>
          <h4>{abierta ? "Primera apertura registrada" : "Primera apertura pendiente"}</h4>
          {abierta ? <dl>
            <dt>Primera apertura en el sistema (Bogotá)</dt><dd>{fecha(recepcion.primera_apertura_utc)}</dd>
            <dt>Registrada por</dt><dd>{recepcion.actor_nombre.trim() || "Nombre del funcionario no registrado"}</dd>
          </dl> : <p>Sin primera apertura registrada por la dependencia de origen.</p>}
        </div>
      </li>
    </ol>
    <p className="recepcion-interna-nota">La apertura no acredita comprensión ni notificación legal.</p>
  </div>;
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
    <p>Disponible dentro del sistema, sin evidencia física de envío.</p>
    <button className="entregas-boton" type="button" aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>
      {abierto ? "Ocultar recepción digital" : "Ver recepción digital"}
    </button>
    {abierto && <><button className="entregas-boton" type="button" onClick={() => setRevision(n => n + 1)}>Actualizar recepción digital</button>
      {error && <p role="alert">{error}</p>}
      {!recepcion && !error && <p role="status">Cargando recepción digital…</p>}
      {recepcion && <EstadoRecepcion recepcion={recepcion} />}{falloApertura}</>}
  </section>;
}
export function RespuestasInternas({ usuario, directa = false, activa = true, alResumen, revisionExterna = 0 }) {
  const [desplegada, setAbierto] = useState(false);
  const abierto = directa || desplegada;
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState("todas");
  const [revision, setRevision] = useState(0);
  const [lista, setLista] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");
  const [seleccion, setSeleccion] = useState(null);
  const solicitud = useRef(0);
  const urls = useRef(new Set());
  const cabecera = useRef(null);
  const botonAbrir = useRef(null);
  const botonActualizar = useRef(null);
  const aperturaInicialResuelta = useRef(false);
  function liberar() { urls.current.forEach(u => URL.revokeObjectURL(u)); urls.current.clear(); }
  useEffect(() => () => { solicitud.current++; liberar(); }, []);
  function cerrarDetalle(restaurarFoco = true) {
    solicitud.current++; setDetalle(null); setSeleccion(null); setErrorDetalle(""); setCargandoDetalle(false); liberar();
    if (!restaurarFoco) return;
    if (botonAbrir.current?.isConnected) botonAbrir.current.focus();
    else botonActualizar.current?.focus();
  }
  useEffect(() => { if (!activa) cerrarDetalle(false); }, [activa]);
  useEffect(() => {
    alResumen?.({ resumen: lista?.resumen || null, error, cargando });
  }, [lista, error, cargando, alResumen]);
  function cambiarFiltro(valor) {
    cerrarDetalle(false); setLista(null); setEstado(valor); setPagina(1);
  }
  function cambiarPagina(valor) {
    cerrarDetalle(false); setLista(null); setPagina(valor);
    botonActualizar.current?.focus();
  }
  useEffect(() => { if (detalle) cabecera.current?.focus({ preventScroll: true }); }, [detalle?.recepcion.id]);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError("");
    datosApi(`/api/respuestas-internas?pagina=${pagina}&estado=${estado}`).then(datos => {
      if (!Array.isArray(datos.registros) || datos.registros.length > 25 ||
        !datos.registros.every(recepcionValida) || datos.pagina !== pagina ||
        !Number.isSafeInteger(datos.total) || datos.total < 0 ||
        datos.paginas !== Math.ceil(datos.total / 25) ||
        !datos.resumen || !["total", "pendientes", "leidas"].every(k => Number.isSafeInteger(datos.resumen[k]) && datos.resumen[k] >= 0) ||
        datos.resumen.total !== datos.resumen.pendientes + datos.resumen.leidas) throw new Error("Bandeja interna inválida.");
      if (vigente) {
        setLista(datos);
        if (!aperturaInicialResuelta.current) {
          aperturaInicialResuelta.current = true;
          if (!directa && datos.resumen.pendientes > 0) setAbierto(true);
        }
        if (pagina > Math.max(1, datos.paginas)) setPagina(Math.max(1, datos.paginas));
      }
    }).catch(e => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [pagina, estado, revision, revisionExterna, directa]);
  useEffect(() => {
    if (!cargando && lista && seleccion && !lista.registros.some(r => r.id === seleccion.id)) {
      cerrarDetalle(false);
      botonActualizar.current?.focus();
    }
  }, [cargando, lista, seleccion]);
  async function abrirRespuesta(id, numero) {
    cerrarDetalle(false);
    const actual = ++solicitud.current;
    const creadas = [];
    setSeleccion({ id, numero }); setCargandoDetalle(true); setErrorDetalle("");
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
    } catch (e) { if (actual === solicitud.current) setErrorDetalle(e.message); }
    finally {
      creadas.forEach(u => { if (!urls.current.has(u)) URL.revokeObjectURL(u); });
      if (actual === solicitud.current) setCargandoDetalle(false);
    }
  }
  const errorApertura = useApertura(activa ? detalle?.recepcion : null, usuario, recepcion => {
    setDetalle(prev => prev ? { ...prev, recepcion } : prev);
    setRevision(n => n + 1);
  });
  return <section className="detalle-seccion entregas-panel internas-bandeja" aria-label="Respuestas internas recibidas">
    <div className="internas-cabecera">
      <div><p className="internas-antetitulo">Recepción digital de tu dependencia</p><h2>Respuestas internas recibidas</h2></div>
      {!directa && <button type="button" className="entregas-boton" aria-expanded={abierto} aria-controls="internas-contenido"
        onClick={() => { aperturaInicialResuelta.current = true; cerrarDetalle(); setAbierto(v => !v); }}>{abierto ? "Ocultar bandeja interna" : "Ver bandeja interna"}</button>}
    </div>
    <p className="internas-nota">Aquí encuentras las respuestas a los radicados que inició tu dependencia. {directa ? "Son distintas de los documentos recibidos de la pestaña Radicados." : "No aparecen en el listado de documentos recibidos de abajo."}</p>
    {cargando && <p className="internas-mensaje" role="status">Cargando bandeja interna…</p>}
    {error && <div className="internas-error" role="alert">
      <p>{error}</p>
      <button className="entregas-boton" type="button" disabled={cargando}
        onClick={() => setRevision(n => n + 1)}>Reintentar carga de bandeja interna</button>
    </div>}
    {lista && <>
      <div className="internas-indicadores" role="status" aria-label="Resumen de respuestas de tu dependencia">
        <p><strong>{lista.resumen.total}</strong><span>Total</span></p>
        <p><strong>{lista.resumen.pendientes}</strong><span>Sin apertura</span></p>
        <p><strong>{lista.resumen.leidas}</strong><span>Con apertura</span></p>
      </div>
      {lista.resumen.pendientes > 0 && <p className="internas-aviso" role="status">
        Tienes {lista.resumen.pendientes} {lista.resumen.pendientes === 1 ? "respuesta interna sin abrir" : "respuestas internas sin abrir"}.
        {" "}Usa «Abrir respuesta» para consultar el contenido y sus adjuntos.
      </p>}
    </>}
    {!abierto && <button className="entregas-boton" type="button" disabled={cargando}
      onClick={() => setRevision(n => n + 1)}>Actualizar bandeja interna</button>}
    {abierto && <div id="internas-contenido">
      <p className="internas-nota">Respuesta digital dirigida a tu dependencia de origen. Se registra la primera apertura al mostrar correctamente la respuesta y sus adjuntos.</p>
      <div className="internas-controles">
        <label className="internas-filtro">Filtrar respuestas internas <select value={estado} onChange={e => cambiarFiltro(e.target.value)}>
          <option value="todas">Todas</option><option value="pendientes">Sin apertura</option><option value="leidas">Con apertura</option>
        </select></label>
        <button ref={botonActualizar} className="entregas-boton" type="button" disabled={cargando} onClick={() => setRevision(n => n + 1)}>Actualizar bandeja interna</button>
      </div>
      {lista && <>
        {estado !== "todas" && <p className="internas-total-filtro">{lista.total} respuestas en este filtro</p>}
        {!lista.registros.length ? <div className="internas-vacio">
          <h3>{estado === "pendientes" ? "Sin respuestas pendientes de apertura" : estado === "leidas" ? "Sin respuestas con apertura registrada" : "Aún no hay respuestas internas"}</h3>
          <p>No hay respuestas internas para este filtro.</p>
          {estado !== "todas" && <button className="entregas-boton" type="button"
            onClick={() => cambiarFiltro("todas")}>Ver todas las respuestas internas</button>}
        </div> : <ul className="internas-listado" aria-label="Respuestas disponibles">{lista.registros.map(r => <li className="internas-tarjeta" key={r.id}>
          <div className="internas-tarjeta-cabecera">
            <h3>{r.numero_radicado}</h3>
            <span className={`recepcion-interna-estado ${r.primera_apertura_utc ? "recepcion-interna-estado--registrada" : "recepcion-interna-estado--pendiente"}`}>
              {r.primera_apertura_utc ? "Primera apertura registrada" : "Pendiente de primera apertura por la dependencia de origen"}
            </span>
          </div>
          <dl className="internas-datos">
            <div><dt>Respuesta dirigida a</dt><dd>{nombreOrigen(r)}</dd></div>
            <div><dt>Dependencia que respondió</dt><dd>{r.dependencia_destino?.trim() || "No registrada"}</dd></div>
          </dl>
          <dl className="internas-fechas">
            <div><dt>Disponibilidad (Bogotá)</dt><dd>{r.historica ? "Respuesta histórica; disponibilidad anterior desconocida" : r.disponible_en_utc ? fecha(r.disponible_en_utc) : "Fecha de disponibilidad no registrada"}</dd></div>
            <div><dt>Primera apertura (Bogotá)</dt><dd>{r.primera_apertura_utc ? fecha(r.primera_apertura_utc) : "Sin apertura registrada"}</dd></div>
          </dl>
          <button type="button" className="entregas-boton internas-boton-primario" aria-label={`Abrir respuesta interna ${r.numero_radicado}`}
            aria-expanded={seleccion?.id === r.id} aria-controls={`respuesta-interna-${r.id}`} onClick={e => {
            botonAbrir.current = e.currentTarget; abrirRespuesta(r.id, r.numero_radicado);
          }}>Abrir respuesta</button>
      {seleccion?.id === r.id && <div className="internas-vista" id={`respuesta-interna-${r.id}`}>
        {!detalle && <div className="internas-cabecera">
          <h3>Respuesta · {seleccion.numero}</h3>
          <button className="entregas-boton" type="button" onClick={cerrarDetalle}>Cerrar respuesta interna</button>
        </div>}
        {cargandoDetalle && <p className="internas-mensaje" role="status">Cargando respuesta interna y PDF…</p>}
        {errorDetalle && <div className="internas-error" role="alert">
          <p>{errorDetalle}</p>
          <button className="entregas-boton" type="button" onClick={() => abrirRespuesta(seleccion.id, seleccion.numero)}>Reintentar carga de respuesta</button>
        </div>}
        {detalle && <article aria-label="Respuesta interna abierta">
          <div className="internas-cabecera">
            <div><p className="internas-antetitulo">Respuesta institucional</p><h3 ref={cabecera} tabIndex={-1}>{detalle.recepcion.numero_radicado}</h3></div>
            <button className="entregas-boton" type="button" onClick={cerrarDetalle}>Cerrar respuesta interna</button>
          </div>
          <p className="internas-oficina">Dependencia que respondió: <strong>{detalle.recepcion.dependencia_destino?.trim() || "No registrada"}</strong></p>
          <section className="internas-seccion" aria-label="Contenido de la respuesta">
            <h4>Contenido de la respuesta</h4>
            <p className="internas-texto">{detalle.recepcion.contenido}</p>
          </section>
          <section className="internas-seccion" aria-label="Adjuntos de la respuesta">
            <h4>Adjuntos de la respuesta</h4>
            {detalle.documentos.length ? <ul className="internas-adjuntos">{detalle.documentos.map(d => <li key={d.id}>
              <a href={d.url} target="_blank" rel="noreferrer">{d.nombre_archivo}</a>
              <span>PDF · {new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(d.tamano_bytes / 1024)} KiB · Abre en otra pestaña</span>
            </li>)}</ul> : <p>Esta respuesta no tiene adjuntos.</p>}
          </section>
          <section className="internas-seccion" aria-label="Recepción de la respuesta">
            <h4>Recepción digital</h4>
            <EstadoRecepcion recepcion={detalle.recepcion} />{errorApertura}
          </section>
        </article>}
      </div>}
        </li>)}</ul>}
        {lista.registros.length > 0 && lista.paginas > 1 && <nav className="internas-paginacion" aria-label="Páginas de respuestas internas">
          <button className="entregas-boton" type="button" disabled={cargando || pagina === 1} onClick={() => cambiarPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina} de {lista.paginas}</span>
          <button className="entregas-boton" type="button" disabled={cargando || pagina >= lista.paginas} onClick={() => cambiarPagina(pagina + 1)}>Siguiente</button>
        </nav>}</>}
    </div>}
  </section>;
}
