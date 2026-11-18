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
function canalRecepcion(valor) {
  return String(valor || "").trim().toLowerCase() === "fisica" ? "física" : "digital";
}
function EstadoRecepcion({ recepcion }) {
  const abierta = Boolean(recepcion.primera_apertura_utc);
  const entregada = recepcion.radicado_estado === "Entregado";
  const canal = canalRecepcion(recepcion.tipo_recepcion);
  const disponibilidadConFecha = !recepcion.historica && Boolean(recepcion.disponible_en_utc);
  return <div className="recepcion-interna">
    <div className="recepcion-interna-destinatario">
      <strong>Respuesta dirigida a</strong>
      <p>{nombreOrigen(recepcion)}</p>
      <small>Es la dependencia que inició el radicado, no la oficina que respondió.</small>
    </div>
    <ol className="recepcion-interna-hitos" aria-label={`Hitos de recepción ${canal} interna`}>
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
            {entregada && <><dt>Estado del radicado</dt><dd>Respondido → Entregado</dd></>}
          </dl> : <p>Sin primera apertura registrada por la dependencia de origen.</p>}
        </div>
      </li>
    </ol>
    <p className="recepcion-interna-nota">{entregada
      ? "Respuesta interna entregada: la dependencia de origen abrió correctamente la respuesta y el radicado finalizó."
      : "La apertura no acredita comprensión ni notificación legal."}</p>
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
  const canal = canalRecepcion(radicado.tipo_recepcion);
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
    <h3>Recepción {canal} interna</h3>
    <p>{canal === "física" ? "Entrega registrada por Ventanilla para la dependencia de origen." : "Disponible dentro del sistema, sin evidencia física de envío."}</p>
    <button className="entregas-boton" type="button" aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>
      {abierto ? `Ocultar recepción ${canal}` : `Ver recepción ${canal}`}
    </button>
    {abierto && <><button className="entregas-boton" type="button" onClick={() => setRevision(n => n + 1)}>Actualizar recepción {canal}</button>
      {error && <p role="alert">{error}</p>}
      {!recepcion && !error && <p role="status">Cargando recepción digital…</p>}
      {recepcion && <EstadoRecepcion recepcion={recepcion} />}{falloApertura}</>}
  </section>;
}
export function RespuestasInternas({ usuario, directa = false, activa = true, alResumen, revisionExterna = 0, alVerTrazabilidad }) {
  const [desplegada, setAbierto] = useState(false);
  const abierto = directa || desplegada;
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState("todas");
  const [revision, setRevision] = useState(0);
  const [lista, setLista] = useState(null);
  const [subvista, setSubvista] = useState("recibidas");
  const [enviados, setEnviados] = useState(null);
  const [cargandoEnviados, setCargandoEnviados] = useState(false);
  const [errorEnviados, setErrorEnviados] = useState("");
  const [paginaEnviados, setPaginaEnviados] = useState(1);
  const [revisionEnviados, setRevisionEnviados] = useState(0);
  const [respuestaEnviadaCargando, setRespuestaEnviadaCargando] = useState("");
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
  useEffect(() => {
    const elemento = cabecera.current;
    if (!detalle || !elemento) return;
    if (typeof elemento.scrollIntoView === "function") {
      elemento.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    try { elemento.focus({ preventScroll: true }); }
    catch { elemento.focus(); }
  }, [detalle?.recepcion.id]);
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
    if (subvista !== "enviados" || !activa) return undefined;
    let vigente = true;
    setCargandoEnviados(true); setErrorEnviados("");
    datosApi(`/api/radicados?pagina=${paginaEnviados}&limite=25&vista=generados&tipo_comunicacion=interna`)
      .then(datos => {
        if (!Array.isArray(datos.radicados) || datos.radicados.length > 25 ||
          !Number.isSafeInteger(datos.total) || datos.total < 0 ||
          !Number.isSafeInteger(datos.paginas) || datos.paginas !== Math.ceil(datos.total / 25)) {
          throw new Error("Bandeja de radicados enviados inválida.");
        }
        if (vigente) {
          setEnviados(datos);
          if (paginaEnviados > Math.max(1, datos.paginas)) setPaginaEnviados(Math.max(1, datos.paginas));
        }
      })
      .catch(e => { if (vigente) setErrorEnviados(e.message); })
      .finally(() => { if (vigente) setCargandoEnviados(false); });
    return () => { vigente = false; };
  }, [subvista, activa, paginaEnviados, revisionEnviados]);
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
  async function abrirRespuestaEnviada(radicado) {
    const numero = radicado.numero_radicado;
    setRespuestaEnviadaCargando(numero);
    setSubvista("enviados");
    try {
      const datos = await datosApi(`/api/radicados/${encodeURIComponent(numero)}/recepcion-interna`);
      if (!recepcionValida(datos.recepcion)) throw new Error("Recepción interna inválida.");
      await abrirRespuesta(datos.recepcion.id, numero);
    } catch (e) {
      setErrorEnviados(e.message);
    } finally {
      setRespuestaEnviadaCargando("");
    }
  }
  const errorApertura = useApertura(activa ? detalle?.recepcion : null, usuario, recepcion => {
    setDetalle(prev => prev ? { ...prev, recepcion } : prev);
    setRevision(n => n + 1);
  });
  return <section className="detalle-seccion entregas-panel internas-bandeja" aria-label="Respuestas y radicados internos">
    <div className="internas-cabecera">
      <div><p className="internas-antetitulo">Seguimiento de comunicaciones internas</p><h2>Respuestas y radicados internos</h2></div>
      {!directa && <button type="button" className="entregas-boton" aria-expanded={abierto} aria-controls="internas-contenido"
        onClick={() => { aperturaInicialResuelta.current = true; cerrarDetalle(); setAbierto(v => !v); }}>{abierto ? "Ocultar bandeja interna" : "Ver bandeja interna"}</button>}
    </div>
    <p className="internas-nota">Aquí encuentras las respuestas recibidas y los radicados internos que inició tu dependencia. {directa ? "Son distintas de los documentos recibidos de la pestaña Radicados." : "No aparecen en el listado de documentos recibidos de abajo."}</p>
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
      <div className="internas-subpestanas" role="tablist" aria-label="Bandejas internas">
        <button type="button" role="tab"  aria-selected={subvista === "recibidas"}
          className={subvista === "recibidas" ? "internas-subpestana internas-subpestana--activa" : "internas-subpestana"}
          onClick={() => setSubvista("recibidas")}>Respuestas recibidas</button>
        <button type="button" role="tab" aria-selected={subvista === "enviados"}
          className={subvista === "enviados" ? "internas-subpestana internas-subpestana--activa" : "internas-subpestana"}
          onClick={() => setSubvista("enviados")}>Radicados enviados</button>
      </div>
      {subvista === "enviados" ? <section className="internas-enviados" role="tabpanel" aria-label="Radicados internos enviados">
        <div className="internas-controles">
          <p className="internas-nota">Consulta los radicados que Ventanilla registró a nombre de tu dependencia. Aquí podrás seguir la respuesta de la dependencia destinataria.</p>
          <button className="entregas-boton" type="button" disabled={cargandoEnviados} onClick={() => setRevisionEnviados(n => n + 1)}>Actualizar radicados enviados</button>
        </div>
        {cargandoEnviados && <p className="internas-mensaje" role="status">Cargando radicados enviados…</p>}
        {errorEnviados && <div className="internas-error" role="alert"><p>{errorEnviados}</p><button className="entregas-boton" type="button" onClick={() => setRevisionEnviados(n => n + 1)}>Reintentar carga</button></div>}
        {enviados && (!enviados.radicados.length ? <div className="internas-vacio"><h3>Aún no hay radicados internos enviados</h3><p>Los radicados registrados por Ventanilla para tu dependencia aparecerán aquí.</p></div> : <ul className="internas-enviados-listado" aria-label="Radicados internos enviados">
          {enviados.radicados.map(r => {
            const respondido = ["Respondido", "Entregado"].includes(r.estado);
            const entregado = r.estado === "Entregado";
            return <li className="internas-enviado-tarjeta" key={r.numero_radicado}>
              <div className="internas-tarjeta-cabecera"><h3>{r.numero_radicado}</h3><span className={`internas-enviado-estado ${entregado ? "internas-enviado-estado--entregado" : respondido ? "internas-enviado-estado--respondido" : "internas-enviado-estado--pendiente"}`}>
                {entregado ? "Entregado · respuesta abierta" : respondido ? "Respondido · respuesta disponible" : "Enviado · pendiente de respuesta"}
              </span></div>
              <dl className="internas-datos"><div><dt>Dependencia destinataria</dt><dd>{r.dependencia_destino?.trim() || "No registrada"}</dd></div><div><dt>Tipo de recepción</dt><dd>{canalRecepcion(r.tipo_recepcion)}</dd></div><div><dt>Radicación</dt><dd>{r.fecha_hora_recepcion ? fecha(r.fecha_hora_recepcion) : "No registrada"}</dd></div>{r.fecha_respuesta && <div><dt>Respuesta disponible</dt><dd>{fecha(r.fecha_respuesta)}</dd></div>}</dl>
              <div className="internas-enviado-acciones">
                {respondido && <button type="button" className="entregas-boton internas-boton-primario" aria-busy={respuestaEnviadaCargando === r.numero_radicado}
                  disabled={Boolean(respuestaEnviadaCargando)} onClick={() => abrirRespuestaEnviada(r)}>
                  {respuestaEnviadaCargando === r.numero_radicado ? "Cargando respuesta…" : `Ver respuesta de ${r.dependencia_destino?.trim() || "la dependencia destinataria"}`}
                </button>}
                {alVerTrazabilidad && <button type="button" className="entregas-boton" onClick={() => alVerTrazabilidad(r)}>Ver trazabilidad</button>}
              </div>
              {seleccion?.numero === r.numero_radicado && <div className="internas-vista" id={`respuesta-interna-${seleccion.id}`}>
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
                  <section className="internas-seccion" aria-label="Entrega interna de la respuesta">
                    <h4>{detalle.recepcion.radicado_estado === "Entregado" ? "Entrega interna confirmada" : "Entrega interna"}</h4>
                    <EstadoRecepcion recepcion={detalle.recepcion} />{errorApertura}
                  </section>
                </article>}
              </div>}
            </li>;
          })}
        </ul>)}
        {enviados && enviados.paginas > 1 && <nav className="internas-paginacion" aria-label="Páginas de radicados enviados"><button className="entregas-boton" type="button" disabled={cargandoEnviados || paginaEnviados === 1} onClick={() => setPaginaEnviados(n => n - 1)}>Anterior</button><span>Página {paginaEnviados} de {enviados.paginas}</span><button className="entregas-boton" type="button" disabled={cargandoEnviados || paginaEnviados >= enviados.paginas} onClick={() => setPaginaEnviados(n => n + 1)}>Siguiente</button></nav>}
      </section> : <>
      <p className="internas-nota">Respuesta digital dirigida a tu dependencia de origen. Se registra la primera apertura al mostrar correctamente la respuesta y sus adjuntos.</p>
      <div className="internas-controles">
        <label htmlFor="filtro-respuestas-internas" className="internas-filtro">Filtrar respuestas internas <select id="filtro-respuestas-internas" name="filtro_respuestas_internas" value={estado} onChange={e => cambiarFiltro(e.target.value)}>
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
            <span className={`recepcion-interna-estado ${r.radicado_estado === "Entregado" ? "recepcion-interna-estado--entregada" : r.primera_apertura_utc ? "recepcion-interna-estado--registrada" : "recepcion-interna-estado--pendiente"}`}>
              {r.radicado_estado === "Entregado" ? "Entregado" : r.primera_apertura_utc ? "Primera apertura registrada" : "Respondido · pendiente de apertura"}
            </span>
          </div>
          <dl className="internas-datos">
            <div><dt>Respuesta dirigida a</dt><dd>{nombreOrigen(r)}</dd></div>
            <div><dt>Dependencia que respondió</dt><dd>{r.dependencia_destino?.trim() || "No registrada"}</dd></div>
            <div><dt>Tipo de recepción</dt><dd>{r.tipo_recepcion?.trim() || "No registrado"}</dd></div>
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
          <section className="internas-seccion" aria-label="Entrega interna de la respuesta">
            <h4>{detalle.recepcion.radicado_estado === "Entregado" ? "Entrega interna confirmada" : "Entrega interna"}</h4>
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
      </>}
    </div>}
  </section>;
}
