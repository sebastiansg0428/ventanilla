import { useEffect, useRef, useState } from "react";
import { solicitarApi } from "../servicios/api";
import { MensajeEstado } from "./Compartidos";
import { ResumenTraslados } from "./ResumenTraslados";

const ESTADOS = {
  pendiente: "Pendiente de Ventanilla",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  cancelada_por_finalizacion: "Cancelada por finalización",
};
const incierto = (error) => error.resultadoIncierto || !error.status || error.status >= 500;
const fecha = (valor) => valor
  ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" })
    .format(new Date(`${valor.replace(" ", "T")}Z`))
  : "Sin decisión";
async function guardar(ruta, datos) {
  const respuesta = await solicitarApi(ruta, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos),
  });
  const resultado = await respuesta.json();
  if (!resultado.success || !resultado.traslado?.id || !ESTADOS[resultado.traslado.estado]) {
    throw new Error("El servidor no devolvió una confirmación válida. Reintenta con los mismos datos.");
  }
  return resultado.traslado;
}

function useDestinosTraslado(activo, sesion) {
  const [catalogo, setCatalogo] = useState({ dependencias: [], cargando: true, error: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    setCatalogo({ dependencias: [], cargando: true, error: "" });
    (async () => {
      try {
        const respuesta = await solicitarApi("/api/traslados/dependencias");
        const resultado = await respuesta.json();
        if (resultado.success !== true || !Array.isArray(resultado.dependencias) ||
            resultado.dependencias.some((d) => !d || !Number.isSafeInteger(d.id) || d.id < 1 ||
              typeof d.nombre !== "string" || ![0, 1].includes(d.activo))) {
          throw new Error("No se pudieron cargar las dependencias de destino: respuesta inválida.");
        }
        if (vigente) setCatalogo({ dependencias: resultado.dependencias.filter((d) => d.activo === 1), cargando: false, error: "" });
      } catch (error) {
        if (vigente) setCatalogo({ dependencias: [], cargando: false, error: error.message });
      }
    })();
    return () => { vigente = false; };
  }, [activo, sesion, revision]);
  return { ...catalogo, reintentar: () => setRevision((n) => n + 1) };
}

function EstadoDestinos({ catalogo, destinos, bloqueado }) {
  if (catalogo.cargando) return <p role="status">Cargando dependencias de destino…</p>;
  if (catalogo.error) return <>
    <p role="alert">{catalogo.error}</p>
    <button type="button" onClick={catalogo.reintentar} disabled={bloqueado}>Reintentar dependencias de destino</button>
  </>;
  if (!destinos.length) return <p role="status">No hay otras dependencias activas disponibles para el traslado.</p>;
  return null;
}

export function SolicitudTraslado({ radicado, alCerrar, alGuardar }) {
  const catalogo = useDestinosTraslado(true);
  const destinos = catalogo.dependencias.filter((d) => d.id !== Number(radicado.dependencia_destino_id));
  const dialogo = useRef(null);
  const intento = useRef(null);
  const ocupado = useRef(false);
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enProceso, setEnProceso] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [error, setError] = useState("");
  const destinoSeleccionado = destinos.some((d) => String(d.id) === destino) ? destino : "";
  useEffect(() => { dialogo.current.showModal(); }, []);
  function cerrar() {
    if (!ocupado.current) alCerrar();
  }
  async function enviar(evento) {
    evento.preventDefault();
    if (ocupado.current) return;
    if (!intento.current && !destinos.some((d) => String(d.id) === destino)) {
      setError("Selecciona una dependencia de destino activa antes de enviar.");
      return;
    }
    ocupado.current = true;
    setEnProceso(true);
    setError("");
    try {
      intento.current ||= { clave_solicitud: crypto.randomUUID(), destino_sugerido_id: Number(destino), motivo: motivo.trim() };
      const resultado = await guardar(`/api/radicados/${encodeURIComponent(radicado.numero_radicado)}/traslados`, intento.current);
      alGuardar(resultado);
    } catch (fallo) {
      setError(fallo.message);
      setBloqueado(Boolean(incierto(fallo)));
      if (!incierto(fallo)) intento.current = null;
    } finally {
      ocupado.current = false;
      setEnProceso(false);
    }
  }
  return (
    <dialog ref={dialogo} className="respuesta-dialog" aria-labelledby="solicitud-traslado-titulo"
      onCancel={(evento) => { evento.preventDefault(); cerrar(); }}>
      <form className="modal-dialog" onSubmit={enviar}>
        <div className="modal-header">
          <h2 id="solicitud-traslado-titulo">Solicitar traslado · {radicado.numero_radicado}</h2>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={cerrar} disabled={enProceso}>×</button>
        </div>
        <div className="modal-content auth-form">
          <p>Tu dependencia sigue responsable hasta que Ventanilla apruebe. El plazo no se suspende ni reinicia.</p>
          <ResumenTraslados numero={radicado.numero_radicado} destino={destinoSeleccionado} prospectivo />
          <div className="auth-field">
            <label htmlFor="traslado-destino">Dependencia sugerida</label>
            <select id="traslado-destino" required value={destino} onChange={(e) => setDestino(e.target.value)} disabled={enProceso || bloqueado || catalogo.cargando || Boolean(catalogo.error) || !destinos.length}>
              <option value="">Selecciona el destino</option>
              {destinos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <EstadoDestinos catalogo={catalogo} destinos={destinos} bloqueado={enProceso || bloqueado} />
          </div>
          <div className="auth-field">
            <label htmlFor="traslado-motivo">Motivo de la solicitud</label>
            <textarea id="traslado-motivo" required minLength={10} maxLength={2000} value={motivo}
              onChange={(e) => setMotivo(e.target.value)} disabled={enProceso || bloqueado} />
          </div>
          {error && <p role="alert">{error}</p>}
          {bloqueado && <p role="status">Confirmación pendiente. Reintenta sin cambiar los datos. Si cierras el formulario o recargas, consulta primero la bandeja de traslados antes de iniciar otra solicitud.</p>}
        </div>
        <div className="modal-footer">
          <button type="button" onClick={cerrar} disabled={enProceso}>Cerrar</button>
          <button type="submit" className="auth-submit" disabled={enProceso || (!bloqueado && !destinos.some((d) => String(d.id) === destino))}>{enProceso ? "Confirmando…" : bloqueado ? "Reintentar confirmación" : "Enviar solicitud a Ventanilla"}</button>
        </div>
      </form>
    </dialog>
  );
}

function DecisionTraslado({ traslado, catalogo, alGuardar, alProceso, ocupadoExterno, alCerrar, alIncierto }) {
  const destinos = catalogo.dependencias.filter((d) => d.id !== Number(traslado.origen_id));
  const [decision, setDecision] = useState("aprobada");
  const [destino, setDestino] = useState(String(traslado.destino_sugerido_id));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [enProceso, setEnProceso] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const destinoSeleccionado = destinos.some((d) => String(d.id) === destino) ? destino : "";
  const intento = useRef(null);
  const ocupado = useRef(false);
  const formulario = useRef(null);
  useEffect(() => { formulario.current.querySelector("select").focus(); }, []);
  async function enviar(evento) {
    evento.preventDefault();
    if (ocupado.current || ocupadoExterno) return;
    if (!intento.current && decision === "aprobada" && !destinos.some((d) => String(d.id) === destino)) {
      setError("Selecciona una dependencia de destino activa antes de aprobar.");
      return;
    }
    ocupado.current = true;
    alProceso(true);
    setEnProceso(true);
    setError("");
    try {
      intento.current ||= {
        decision, motivo: motivo.trim(), ...(decision === "aprobada" ? { destino_id: Number(destino) } : {}),
      };
      const resultado = await guardar(`/api/traslados/${traslado.id}/decision`, intento.current);
      alGuardar(resultado);
    } catch (fallo) {
      setError(fallo.message);
      setBloqueado(Boolean(incierto(fallo)));
      alIncierto(Boolean(incierto(fallo)));
      if (!incierto(fallo)) intento.current = null;
    } finally {
      ocupado.current = false;
      alProceso(false);
      setEnProceso(false);
    }
  }
  return (
    <form ref={formulario} className="auth-form traslados-decision" onSubmit={enviar} aria-label={`Resolver traslado ${traslado.numero_radicado}`}>
      <h4>Resolver solicitud</h4>
      <ResumenTraslados numero={traslado.numero_radicado} destino={destinoSeleccionado} prospectivo={decision === "aprobada"} />
      <div className="auth-field">
        <label htmlFor={`decision-${traslado.id}`}>Decisión de Ventanilla</label>
        <select id={`decision-${traslado.id}`} value={decision} onChange={(e) => setDecision(e.target.value)} disabled={ocupadoExterno || enProceso || bloqueado}>
          <option value="aprobada">Aprobar</option><option value="rechazada">Rechazar</option>
        </select>
      </div>
      {decision === "aprobada" && <div className="auth-field">
        <label htmlFor={`destino-${traslado.id}`}>Destino aprobado</label>
        <select id={`destino-${traslado.id}`} value={destinoSeleccionado} required onChange={(e) => setDestino(e.target.value)} disabled={ocupadoExterno || enProceso || bloqueado || catalogo.cargando || Boolean(catalogo.error) || !destinos.length}>
          <option value="">Selecciona el destino activo</option>
          {destinos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <EstadoDestinos catalogo={catalogo} destinos={destinos} bloqueado={ocupadoExterno || enProceso || bloqueado} />
      </div>}
      <div className="auth-field">
        <label htmlFor={`motivo-${traslado.id}`}>Justificación de la decisión (incluye el motivo si cambias el destino)</label>
        <textarea id={`motivo-${traslado.id}`} required minLength={10} maxLength={2000} value={motivo}
          onChange={(e) => setMotivo(e.target.value)} disabled={ocupadoExterno || enProceso || bloqueado} />
      </div>
      {error && <p role="alert">{error}</p>}
      {bloqueado && <p role="status">Resultado incierto: reintenta la misma decisión o actualiza la bandeja para comprobarla.</p>}
      <div className="traslados-acciones">
        <button type="button" className="traslados-boton-secundario" onClick={alCerrar} disabled={enProceso || ocupadoExterno || bloqueado}>Cerrar decisión</button>
        <button className="auth-submit" disabled={enProceso || ocupadoExterno || (!bloqueado && decision === "aprobada" && !destinos.some((d) => String(d.id) === destino))}>{enProceso ? "Confirmando…" : bloqueado ? "Reintentar decisión" : "Confirmar decisión"}</button>
      </div>
    </form>
  );
}

function TarjetaTraslado({ traslado, usuario, catalogo, alGuardar, alProceso, decidiendo, incierta, alIncierto }) {
  const [resolviendo, setResolviendo] = useState(false);
  const resolver = useRef(null);
  const devolverFoco = useRef(false);
  useEffect(() => {
    if (!resolviendo && devolverFoco.current) {
      resolver.current?.focus();
      devolverFoco.current = false;
    }
  }, [resolviendo]);
  const aprobada = traslado.estado === "aprobada";
  const destino = aprobada ? traslado.destino_aprobado_nombre : traslado.destino_sugerido_nombre;
  return (
    <article className="traslados-tarjeta" aria-label={`Traslado ${traslado.numero_radicado}`}>
      <header className="traslados-tarjeta-cabecera">
        <h3>{traslado.numero_radicado}</h3>
        <span className={`traslados-estado traslados-estado--${traslado.estado}`}>{ESTADOS[traslado.estado]}</span>
      </header>
      <dl className="traslados-datos traslados-resumen-tarjeta">
        <div><dt>Dependencia de origen</dt><dd>{traslado.origen_nombre || "Sin origen registrado"}</dd></div>
        <div><dt>{aprobada ? "Destino aprobado" : "Destino sugerido"}</dt><dd>{destino || (aprobada ? "Sin destino aprobado registrado" : "Sin destino sugerido registrado")}</dd></div>
        <div><dt>Vencimiento conservado</dt><dd>{traslado.fecha_limite_conservada || "Sin plazo de respuesta registrado"}</dd></div>
      </dl>
      <details className="traslados-detalles">
        <summary>Ver motivos y trazabilidad</summary>
        <dl className="traslados-datos">
          {[
            ...(aprobada ? [["Destino sugerido", traslado.destino_sugerido_nombre || "Sin destino sugerido registrado"]] : [["Destino aprobado", traslado.destino_aprobado_nombre || "Sin aprobación"]]),
            ["Solicitado por", traslado.solicitante_nombre || "Sin solicitante registrado"], ["Solicitud (Bogotá)", traslado.creado_en_utc ? fecha(traslado.creado_en_utc) : "Sin fecha de solicitud registrada"],
            ["Motivo de la solicitud", traslado.motivo_solicitud || "Sin motivo registrado"], ["Decisión por", traslado.decisor_nombre || "Sin decisor registrado"],
            ["Decisión (Bogotá)", fecha(traslado.resuelto_en_utc)], ["Justificación de la decisión", traslado.motivo_decision || "Sin justificación registrada"],
          ].map(([etiqueta, valor]) => <div key={etiqueta}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}
        </dl>
      </details>
      {usuario.rol !== "funcionario" && traslado.estado === "pendiente" && (
        resolviendo
          ? <DecisionTraslado traslado={traslado} catalogo={catalogo} alGuardar={alGuardar}
            alProceso={alProceso} ocupadoExterno={decidiendo || Boolean(incierta && incierta !== traslado.id)}
            alCerrar={() => { devolverFoco.current = true; setResolviendo(false); }} alIncierto={alIncierto} />
          : <div className="traslados-acciones"><button ref={resolver} type="button" className="traslados-boton-primario"
            onClick={() => setResolviendo(true)} disabled={decidiendo || Boolean(incierta)}>Resolver traslado</button></div>
      )}
    </article>
  );
}

export function BandejaTraslados({ usuario, revision, alGuardar, directa = false, activa = true }) {
  const [desplegada, setAbierta] = useState(false);
  const abierta = directa ? activa : desplegada;
  const [estado, setEstado] = useState("pendiente");
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [decidiendo, setDecidiendo] = useState(false);
  const [incierta, setIncierta] = useState(null);
  const [confirmacion, setConfirmacion] = useState("");
  const catalogo = useDestinosTraslado(abierta && usuario.rol !== "funcionario",
    `${usuario.id}:${usuario.rol}:${usuario.dependencia_id}`);
  useEffect(() => {
    if (!abierta) return;
    let vigente = true;
    setCargando(true);
    setDatos(null);
    setIncierta(null);
    setError("");
    (async () => {
      try {
        const respuesta = await solicitarApi(`/api/traslados?${new URLSearchParams({ pagina: String(pagina), estado })}`);
        const resultado = await respuesta.json();
        if (!Array.isArray(resultado.traslados) || !Number.isSafeInteger(resultado.total) ||
            !Number.isSafeInteger(resultado.paginas) || !Number.isSafeInteger(resultado.pendientes)) {
          throw new Error("La bandeja no devolvió una respuesta válida.");
        }
        if (vigente) {
          setDatos(resultado);
          if (pagina > Math.max(1, resultado.paginas)) setPagina(Math.max(1, resultado.paginas));
        }
      } catch (fallo) {
        if (vigente) setError(fallo.message);
      } finally {
        if (vigente) setCargando(false);
      }
    })();
    return () => { vigente = false; };
  }, [abierta, estado, pagina, recarga, revision]);
  function guardado(resultado) {
    setConfirmacion(`Decisión confirmada para ${resultado.numero_radicado}: ${ESTADOS[resultado.estado]}.`);
    setRecarga((n) => n + 1);
    alGuardar();
  }
  return (
    <section className="traslados-panel" aria-label="Traslados mediados por Ventanilla">
      <div className="traslados-cabecera">
        <div>
          <p className="traslados-antetitulo">Traslados de radicados</p>
          <h2>{usuario.rol === "funcionario" ? "Solicitudes de mi dependencia de origen" : "Revisión de Ventanilla"}</h2>
        </div>
        {!directa && <button type="button" className="traslados-boton-secundario" aria-expanded={abierta} aria-controls="bandeja-traslados" onClick={() => setAbierta(!abierta)} disabled={decidiendo || Boolean(incierta)}>
          {abierta ? "Ocultar traslados" : usuario.rol === "funcionario" ? "Mis solicitudes de traslado" : "Gestionar traslados"}
        </button>}
      </div>
      {abierta && <div id="bandeja-traslados">
        {confirmacion && <MensajeEstado tono="success">{confirmacion}</MensajeEstado>}
        <p className="traslados-nota">Se conserva el radicado y el plazo. El comprobante no da acceso al contenido posterior del expediente.</p>
        <div className="traslados-controles">
          <div className="traslados-filtro">
            <label htmlFor="filtro-traslados">Estado del traslado</label>
            <select id="filtro-traslados" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }} disabled={decidiendo || Boolean(incierta)}>
              <option value="">Todos</option>
              {Object.entries(ESTADOS).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
            </select>
          </div>
          <button type="button" className="traslados-boton-secundario" onClick={() => setRecarga((n) => n + 1)} disabled={decidiendo}>Actualizar traslados</button>
        </div>
        {cargando && <MensajeEstado>Cargando traslados…</MensajeEstado>}
        {error && <p className="traslados-error" role="alert">{error}</p>}
        {datos && <>
          <div className="traslados-indicadores" role="status">
            <p><strong>{datos.pendientes}</strong><span>Pendientes de Ventanilla{usuario.rol === "funcionario" ? " · Mi origen" : ""}</span></p>
            <p><strong>{datos.total}</strong><span>Solicitudes en este filtro</span></p>
          </div>
          {!datos.traslados.length ? <div className="traslados-vacio">
            <h3>{estado === "pendiente" ? "Sin traslados pendientes" : "No hay solicitudes para mostrar."}</h3>
            <p>{estado === "pendiente" ? "No hay solicitudes pendientes de revisión en esta bandeja." : estado ? `No hay solicitudes con estado «${ESTADOS[estado]}».` : "Aún no hay solicitudes de traslado en esta bandeja."}</p>
            {estado && <button type="button" className="traslados-boton-secundario"
              onClick={() => { setEstado(""); setPagina(1); }} disabled={decidiendo}>Ver todos los estados</button>}
          </div> : <div className="traslados-listado">
            {datos.traslados.map((traslado) => <TarjetaTraslado key={traslado.id} traslado={traslado}
              usuario={usuario} catalogo={catalogo} alGuardar={guardado} alProceso={setDecidiendo} decidiendo={decidiendo}
              incierta={incierta} alIncierto={(valor) => setIncierta((actual) => valor ? traslado.id : actual === traslado.id ? null : actual)} />)}
          </div>}
          {datos.traslados.length > 0 && <nav className="traslados-paginacion" aria-label="Paginación de traslados">
            <button type="button" disabled={decidiendo || Boolean(incierta) || pagina <= 1} onClick={() => setPagina((n) => n - 1)}>Anterior</button>
            <span>Página {pagina} de {Math.max(1, datos.paginas)}</span>
            <button type="button" disabled={decidiendo || Boolean(incierta) || pagina >= datos.paginas} onClick={() => setPagina((n) => n + 1)}>Siguiente</button>
          </nav>}
        </>}
      </div>}
    </section>
  );
}
