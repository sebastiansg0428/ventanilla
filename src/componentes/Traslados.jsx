import { useEffect, useRef, useState } from "react";
import { solicitarApi } from "../servicios/api";
import { MensajeEstado } from "./Compartidos";

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

function DecisionTraslado({ traslado, catalogo, alGuardar, alProceso, ocupadoExterno }) {
  const destinos = catalogo.dependencias.filter((d) => d.id !== Number(traslado.origen_id));
  const [decision, setDecision] = useState("aprobada");
  const [destino, setDestino] = useState(String(traslado.destino_sugerido_id));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [enProceso, setEnProceso] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const intento = useRef(null);
  const ocupado = useRef(false);
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
      if (!incierto(fallo)) intento.current = null;
    } finally {
      ocupado.current = false;
      alProceso(false);
      setEnProceso(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={enviar} aria-label={`Resolver traslado ${traslado.numero_radicado}`}>
      <div className="auth-field">
        <label htmlFor={`decision-${traslado.id}`}>Decisión de Ventanilla</label>
        <select id={`decision-${traslado.id}`} value={decision} onChange={(e) => setDecision(e.target.value)} disabled={ocupadoExterno || enProceso || bloqueado}>
          <option value="aprobada">Aprobar</option><option value="rechazada">Rechazar</option>
        </select>
      </div>
      {decision === "aprobada" && <div className="auth-field">
        <label htmlFor={`destino-${traslado.id}`}>Destino aprobado</label>
        <select id={`destino-${traslado.id}`} value={destinos.some((d) => String(d.id) === destino) ? destino : ""} required onChange={(e) => setDestino(e.target.value)} disabled={ocupadoExterno || enProceso || bloqueado || catalogo.cargando || Boolean(catalogo.error) || !destinos.length}>
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
      <button className="auth-submit" disabled={enProceso || ocupadoExterno || (!bloqueado && decision === "aprobada" && !destinos.some((d) => String(d.id) === destino))}>{enProceso ? "Confirmando…" : bloqueado ? "Reintentar decisión" : "Confirmar decisión"}</button>
    </form>
  );
}

export function BandejaTraslados({ usuario, revision, alGuardar }) {
  const [abierta, setAbierta] = useState(false);
  const [estado, setEstado] = useState("pendiente");
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [decidiendo, setDecidiendo] = useState(false);
  const [confirmacion, setConfirmacion] = useState("");
  const catalogo = useDestinosTraslado(abierta && usuario.rol !== "funcionario",
    `${usuario.id}:${usuario.rol}:${usuario.dependencia_id}`);
  useEffect(() => {
    if (!abierta) return;
    let vigente = true;
    setCargando(true);
    setDatos(null);
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
      <button type="button" aria-expanded={abierta} aria-controls="bandeja-traslados" onClick={() => setAbierta(!abierta)} disabled={decidiendo}>
        {abierta ? "Ocultar traslados" : usuario.rol === "funcionario" ? "Mis solicitudes de traslado" : "Gestionar traslados"}
      </button>
      {abierta && <div id="bandeja-traslados">
        <h2>{usuario.rol === "funcionario" ? "Solicitudes de mi dependencia de origen" : "Revisión de Ventanilla"}</h2>
        {confirmacion && <MensajeEstado tono="success">{confirmacion}</MensajeEstado>}
        <p>El traslado no genera otro radicado ni reinicia plazos. Este comprobante no da acceso al contenido posterior del expediente.</p>
        <div className="alerts-controls">
          <label htmlFor="filtro-traslados">Estado del traslado</label>
          <select id="filtro-traslados" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }} disabled={decidiendo}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([valor, nombre]) => <option key={valor} value={valor}>{nombre}</option>)}
          </select>
          <button type="button" onClick={() => setRecarga((n) => n + 1)} disabled={decidiendo}>Actualizar traslados</button>
        </div>
        {cargando && <MensajeEstado>Cargando traslados…</MensajeEstado>}
        {error && <p role="alert">{error}</p>}
        {datos && <>
          <p role="status">Pendientes: {datos.pendientes}. {datos.total} solicitudes en este filtro.</p>
          {!datos.traslados.length && <p>No hay solicitudes para mostrar.</p>}
          <div className="traslados-listado">
            {datos.traslados.map((traslado) => (
              <article className="detalle-seccion" key={traslado.id} aria-label={`Traslado ${traslado.numero_radicado}`}>
                <h3>{traslado.numero_radicado} · {ESTADOS[traslado.estado]}</h3>
                <dl className="traslados-datos">
                  {[
                    ["Origen", traslado.origen_nombre], ["Destino sugerido", traslado.destino_sugerido_nombre],
                    ["Destino aprobado", traslado.destino_aprobado_nombre || "Sin aprobación"],
                    ["Solicitado por", traslado.solicitante_nombre], ["Solicitud", fecha(traslado.creado_en_utc)],
                    ["Motivo", traslado.motivo_solicitud], ["Decisión por", traslado.decisor_nombre || "Pendiente"],
                    ["Decisión", fecha(traslado.resuelto_en_utc)], ["Justificación", traslado.motivo_decision || "Pendiente"],
                    ["Vencimiento conservado", traslado.fecha_limite_conservada || "Sin plazo de respuesta registrado"],
                  ].map(([etiqueta, valor]) => <div key={etiqueta}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}
                </dl>
                {usuario.rol !== "funcionario" && traslado.estado === "pendiente" &&
                  <DecisionTraslado traslado={traslado} catalogo={catalogo} alGuardar={guardado}
                    alProceso={setDecidiendo} ocupadoExterno={decidiendo} />}
              </article>
            ))}
          </div>
          <nav className="alerts-controls" aria-label="Paginación de traslados">
            <button type="button" disabled={decidiendo || pagina <= 1} onClick={() => setPagina((n) => n - 1)}>Anterior</button>
            <span>Página {pagina} de {Math.max(1, datos.paginas)}</span>
            <button type="button" disabled={decidiendo || pagina >= datos.paginas} onClick={() => setPagina((n) => n + 1)}>Siguiente</button>
          </nav>
        </>}
      </div>}
    </section>
  );
}
