import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  EncabezadoAplicacion,
  PiePagina,
  ProteccionSesion,
  MensajeEstado,
} from "../componentes/Compartidos";
import { solicitarApi } from "../servicios/api";
import { crearPdfComprobante } from "../servicios/comprobante";

export function PaginaRadicacion() {
  return (
    <ProteccionSesion soloRadicacion>
      {(usuario) => <FormularioRadicacion usuario={usuario} />}
    </ProteccionSesion>
  );
}

function FormularioRadicacion({ usuario }) {
  const [tiposTramite, setTiposTramite] = useState([]);
  const [tipoTramiteIdSeleccionado, setTipoTramiteIdSeleccionado] =
    useState("");
  const [dependencias, setDependencias] = useState([]);
  const [tipoComunicacion, setTipoComunicacion] = useState("");
  const [dependenciaRemitente, setDependenciaRemitente] = useState("");
  const [tipoPersona, setTipoPersona] = useState("");
  const esJuridica = tipoComunicacion === "Externa" && tipoPersona === "juridica";
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcionarioSeleccionado, setFuncionarioSeleccionado] = useState("");
  const [estadoCatalogos, setEstadoCatalogos] = useState({
    tiposTramite: "Cargando tipos de trámite…",
    dependencias: "Cargando dependencias…",
    funcionarios: "",
  });
  const [archivosSeleccionados, setArchivosSeleccionados] = useState([]);
  const [errorArchivos, setErrorArchivos] = useState("");
  const [enProceso, setEnProceso] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tono: "" });
  const [datosComprobante, setDatosComprobante] = useState(null);
  const [errorComprobante, setErrorComprobante] = useState("");
  const [longitudAsunto, setLongitudAsunto] = useState(0);
  const selectorArchivo = useRef(null);
  async function cargarTiposTramite() {
    setEstadoCatalogos((estadoActual) => ({
      ...estadoActual,
      tiposTramite: "Cargando tipos de trámite…",
    }));
    try {
      const respuesta = await solicitarApi("/api/tipos-tramite");
      const resultado = await respuesta.json();
      const tiposDisponibles = (resultado.tipos_tramite || []).filter(
        (registro) => registro.termino_legal_id != null,
      );
      setTiposTramite(tiposDisponibles);
      setEstadoCatalogos((estadoActual) => ({
        ...estadoActual,
        tiposTramite: tiposDisponibles.length
          ? "El servidor calcula el término legal."
          : "No hay trámites con término legal disponible.",
      }));
    } catch (error) {
      setTiposTramite([]);
      setEstadoCatalogos((estadoActual) => ({
        ...estadoActual,
        tiposTramite: `No se pudieron cargar los trámites. ${error.message}`,
      }));
    }
  }

  async function cargarDependencias() {
    setEstadoCatalogos((estadoActual) => ({
      ...estadoActual,
      dependencias: "Cargando dependencias…",
    }));
    try {
      const respuesta = await solicitarApi("/api/dependencias");
      const resultado = await respuesta.json();
      setDependencias(resultado.dependencias || []);
      setEstadoCatalogos((estadoActual) => ({
        ...estadoActual,
        dependencias: resultado.dependencias?.length
          ? "Selecciona la dependencia de destino."
          : "No hay dependencias en el catálogo.",
      }));
    } catch (error) {
      setDependencias([]);
      setEstadoCatalogos((estadoActual) => ({
        ...estadoActual,
        dependencias: `No se pudieron cargar dependencias. ${error.message}`,
      }));
    }
  }

  async function cargarFuncionariosVentanilla() {
    // Ventanilla no puede atribuir un registro a otra cuenta: mostramos su identidad confirmada.
    if (usuario.rol === "ventanilla") {
      setFuncionarios([{ id: usuario.id, nombre: usuario.nombre }]);
      setFuncionarioSeleccionado(String(usuario.id));
      setEstadoCatalogos((estadoActual) => ({
        ...estadoActual,
        funcionarios: `Sesión iniciada como ${usuario.nombre}.`,
      }));
      return;
    }
    try {
      const respuesta = await solicitarApi("/api/usuarios/ventanilla");
      const resultado = await respuesta.json();
      const personas = resultado.usuarios || [];
      setFuncionarios(personas);
      setFuncionarioSeleccionado("");
      setEstadoCatalogos((estadoActual) => ({
        ...estadoActual,
        funcionarios: personas.length
          ? `${personas.length} funcionario(s) disponible(s).`
          : "No hay usuarios con rol de ventanilla.",
      }));
    } catch (error) {
      setFuncionarios([]);
      setEstadoCatalogos((estadoActual) => ({
        ...estadoActual,
        funcionarios: `No se pudo cargar el directorio. ${error.message}`,
      }));
    }
  }

  useEffect(() => {
    cargarTiposTramite();
    cargarDependencias();
    cargarFuncionariosVentanilla();
  }, [usuario.id, usuario.rol]);

  function aceptarArchivos(archivosCandidatos) {
    const seleccion = Array.from(archivosCandidatos || []);
    if (!seleccion.length) return;
    let error = seleccion.length > 5
      ? "Puedes adjuntar máximo 5 archivos PDF."
      : "";
    if (!error) {
      for (const archivo of seleccion) {
        if (!archivo.name.toLowerCase().endsWith(".pdf")) {
          error = `El archivo "${archivo.name}" no tiene extensión PDF. Selecciona un documento .pdf.`;
        } else if (archivo.size === 0) {
          error = `El archivo "${archivo.name}" está vacío. Selecciona un PDF con contenido.`;
        } else if (archivo.size > 10 * 1024 * 1024) {
          error = `El archivo "${archivo.name}" pesa ${(archivo.size / 1024 / 1024).toFixed(2)} MB (${archivo.size} bytes) y supera el máximo de 10 MB (10485760 bytes) por archivo.`;
        }
        if (error) break;
      }
    }
    setMensaje({ texto: "", tono: "" });
    setErrorArchivos(error);
    if (error) {
      setArchivosSeleccionados([]);
      if (selectorArchivo.current) selectorArchivo.current.value = "";
      return;
    }
    setArchivosSeleccionados(seleccion);
  }

  function descargarComprobante(datos) {
    try {
      const pdf = crearPdfComprobante(datos);
      pdf.save(`Comprobante_${datos.numero_radicado}.pdf`);
      setErrorComprobante("");
    } catch (error) {
      setErrorComprobante(error.message);
    }
  }

  async function enviarFormulario(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!tiposTramite.length || !dependencias.length) {
      setMensaje({
        texto: "Espera a que los catálogos estén disponibles antes de radicar.",
        tono: "error",
      });
      return;
    }
    if (!archivosSeleccionados.length) {
      setErrorArchivos(errorArchivos || "Adjunta al menos un archivo PDF.");
      return;
    }

    const datosFormulario = new FormData(formulario);
    const tramite = tiposTramite.find(
      (tipo) =>
        String(tipo.id) === String(datosFormulario.get("tipo_tramite_id")),
    );
    if (!tramite) {
      setMensaje({
        texto: "Selecciona un tipo de trámite válido.",
        tono: "error",
      });
      setEnProceso(false);
      return;
    }
    datosFormulario.delete("archivos");
    archivosSeleccionados.forEach((archivo) =>
      datosFormulario.append("archivos", archivo),
    );
    setEnProceso(true);
    setMensaje({ texto: "Enviando y guardando el radicado…", tono: "" });
    try {
      const respuesta = await solicitarApi("/api/radicados", {
        method: "POST",
        body: datosFormulario,
      });
      const resultado = await respuesta.json();
      if (!resultado.success)
        throw new Error(resultado.message || "No se pudo guardar el radicado.");

      const dependenciaDestino = dependencias.find(
        (dep) =>
          String(dep.id) ===
          String(datosFormulario.get("dependencia_destino_id")),
      );
      const comprobante = {
        numero_radicado: String(resultado.radicado || ""),
        tipo_comunicacion: resultado.tipo_comunicacion,
        dependencia_remitente: resultado.dependencia_remitente,
        remitente_tipo_persona: resultado.remitente_tipo_persona,
        remitente_entidad: datosFormulario.get("remitente_entidad"),
        remitente_nit: datosFormulario.get("remitente_nit"),
        remitente_email: datosFormulario.get("remitente_email"),
        numero_folios: datosFormulario.get("numero_folios"),
        tipo_tramite: tramite.nombre,
        dependencia_destino:
          resultado.dependencia_destino || dependenciaDestino?.nombre,
        // Este nombre viene de la sesión del servidor y coincide con el responsable guardado.
        usuario_recibe: resultado.usuario_recibe || usuario.nombre,
        remitente_nombre: datosFormulario.get("remitente_nombre"),
        remitente_documento: datosFormulario.get("remitente_documento"),
        asunto_documento: datosFormulario.get("asunto_documento"),
        fecha_hora: resultado.fecha_hora_recepcion_legible,
      };
      setDatosComprobante(comprobante);
      setErrorComprobante("");
      formulario.reset();
      setTipoTramiteIdSeleccionado("");
      setTipoComunicacion("");
      setDependenciaRemitente("");
      setTipoPersona("");
      setLongitudAsunto(0);
      setArchivosSeleccionados([]);
      setErrorArchivos("");
      if (selectorArchivo.current) selectorArchivo.current.value = "";
      setFuncionarioSeleccionado(
        usuario.rol === "ventanilla" ? String(usuario.id) : "",
      );
      setMensaje({
        texto: `Radicado ${resultado.radicado} guardado. El comprobante incluye a ${resultado.usuario_recibe || usuario.nombre}.`,
        tono: "success",
      });
      descargarComprobante(comprobante);
    } catch (error) {
      setMensaje({ texto: error.message, tono: "error" });
    } finally {
      setEnProceso(false);
    }
  }

  return (
    <div className="page-register app-page">
      <EncabezadoAplicacion usuario={usuario} pantallaActual="radicar" />
      <main className="radicar-main">
        <section className="radicar-card">
          <div className="radicar-titulo">
            <div>
              <h2>Registro de nuevo trámite o documento</h2>
              <p>Diligencia los campos requeridos para crear un radicado.</p>
            </div>
            <span>Radicación en línea</span>
          </div>
          <form
            id="radicadoForm"
            className="radicar-form"
            onSubmit={enviarFormulario}
          >
            <h2>Formulario de radicación</h2>
            <SeccionFormulario
              numero="1"
              titulo="Clasificación y tipo de recepción"
              descripcion="Canal de entrada y trámite institucional."
            >
              <div className="form-grid-3">
                <CampoFormulario etiqueta="Tipo de recepción">
                  <select name="tipo_recepcion" required defaultValue="">
                    <option value="" disabled>
                      Selecciona el canal…
                    </option>
                    <option value="Digital">Digital</option>
                    <option value="Fisico">Físico</option>
                  </select>
                </CampoFormulario>
                <CampoFormulario etiqueta="Tipo de trámite">
                  <select
                    name="tipo_tramite_id"
                    required
                    value={tipoTramiteIdSeleccionado}
                    onChange={(evento) =>
                      setTipoTramiteIdSeleccionado(evento.target.value)
                    }
                    disabled={!tiposTramite.length}
                  >
                    <option value="" disabled>
                      Selecciona el trámite…
                    </option>
                    {tiposTramite.map((tipoTramite) => (
                      <option key={tipoTramite.id} value={tipoTramite.id}>
                        {tipoTramite.nombre}
                      </option>
                    ))}
                  </select>
                  <small role="status">{estadoCatalogos.tiposTramite}</small>
                  <button type="button" onClick={cargarTiposTramite}>
                    Reintentar trámites
                  </button>
                </CampoFormulario>
                <CampoFormulario etiqueta="Clase de comunicación">
                  <select
                    name="tipo_comunicacion"
                    required
                    value={tipoComunicacion}
                    onChange={(evento) => {
                      setTipoComunicacion(evento.target.value);
                      setDependenciaRemitente("");
                      setTipoPersona("");
                    }}
                  >
                    <option value="" disabled>
                      Selecciona la clase…
                    </option>
                    <option value="Interna">Interna</option>
                    <option value="Externa">Externa</option>
                  </select>
                </CampoFormulario>
                {tipoComunicacion === "Interna" && (
                  <CampoFormulario etiqueta="Dependencia remitente">
                    <select
                      name="dependencia_remitente_id"
                      required
                      value={dependenciaRemitente}
                      onChange={(evento) => setDependenciaRemitente(evento.target.value)}
                      disabled={!dependencias.length}
                    >
                      <option value="" disabled>Selecciona la dependencia remitente…</option>
                      {dependencias.map((dep) => (
                        <option key={dep.id} value={dep.id}>{dep.nombre}</option>
                      ))}
                    </select>
                    <small>{estadoCatalogos.dependencias}</small>
                    <button type="button" onClick={cargarDependencias}>Reintentar dependencias remitentes</button>
                  </CampoFormulario>
                )}
              </div>
            </SeccionFormulario>

            <SeccionFormulario
              numero="2"
              titulo="Datos del remitente / solicitante"
              descripcion="Identificación y contacto de quien presenta el documento."
            >
              <div className="form-grid-2">
                {tipoComunicacion === "Externa" && (
                  <CampoFormulario etiqueta="Tipo de persona">
                    <select name="remitente_tipo_persona" required value={tipoPersona}
                      onChange={(evento) => setTipoPersona(evento.target.value)}>
                      <option value="" disabled>Selecciona el tipo de persona…</option>
                      <option value="natural">Natural</option>
                      <option value="juridica">Jurídica</option>
                    </select>
                  </CampoFormulario>
                )}
                <CampoFormulario etiqueta="Nombre completo del remitente">
                  <input
                    name="remitente_nombre"
                    maxLength="150"
                    placeholder="Ej. Juan Pérez González"
                    required
                  />
                </CampoFormulario>
                <CampoFormulario etiqueta="Cédula / documento">
                  <input
                    name="remitente_documento"
                    maxLength="10"
                    placeholder="Número de documento"
                    inputMode="numeric"
                    onChange={(evento) => {
                      evento.target.value = evento.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                    }}
                    required
                  />
                </CampoFormulario>
                <CampoFormulario etiqueta="Teléfono / celular">
                  <input
                    name="remitente_telefono"
                    maxLength="10"
                    placeholder="Ej. 3101234567"
                    inputMode="numeric"
                    onChange={(evento) => {
                      evento.target.value = evento.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);
                    }}
                    required
                  />
                </CampoFormulario>
                <CampoFormulario etiqueta="Correo electrónico" required={tipoComunicacion === "Externa"}>
                  <input
                    name="remitente_email"
                    type="email"
                    maxLength="150"
                    required={tipoComunicacion === "Externa"}
                    placeholder="correo@ejemplo.com"
                  />
                </CampoFormulario>
                <CampoFormulario
                  etiqueta={esJuridica ? "Razón social" : "Entidad / empresa"}
                  required={tipoComunicacion !== "Interna"}
                >
                  <input
                    name="remitente_entidad"
                    maxLength="150"
                    placeholder="Nombre de la entidad o particular"
                    required={tipoComunicacion !== "Interna"}
                    disabled={tipoComunicacion === "Interna"}
                  />
                </CampoFormulario>
                <CampoFormulario etiqueta="NIT de la entidad" required={esJuridica}>
                  <input
                    name="remitente_nit"
                    maxLength="12"
                    placeholder={esJuridica ? "NIT de la persona jurídica" : "Opcional"}
                    required={esJuridica}
                    inputMode="numeric"
                    onChange={(evento) => {
                      evento.target.value = evento.target.value
                        .replace(/\D/g, "")
                        .slice(0, 12);
                    }}
                  />
                </CampoFormulario>
              </div>
            </SeccionFormulario>

            <SeccionFormulario
              numero="3"
              titulo="Destino y resumen del trámite"
              descripcion="Dependencia competente, folios, responsable y asunto."
            >
              <div className="form-grid-3">
                <CampoFormulario etiqueta="Dependencia de destino">
                  <select
                    name="dependencia_destino_id"
                    required
                    defaultValue=""
                    disabled={!dependencias.length}
                  >
                    <option value="" disabled>
                      Selecciona la dependencia…
                    </option>
                    <option value="todas">Todas las dependencias</option>
                    {dependencias.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.nombre}
                      </option>
                    ))}
                  </select>
                  <small role="status">{estadoCatalogos.dependencias}</small>
                  <button type="button" onClick={cargarDependencias}>
                    Reintentar dependencias
                  </button>
                </CampoFormulario>
                <CampoFormulario etiqueta="Número de folios">
                  <input
                    type="number"
                    name="numero_folios"
                    min="1"
                    defaultValue="1"
                    required
                  />
                </CampoFormulario>
                <CampoFormulario etiqueta="Funcionario / quién registra">
                  <select
                    name="usuario_recibe"
                    required
                    disabled={
                      usuario.rol === "ventanilla" || !funcionarios.length
                    }
                    value={funcionarioSeleccionado}
                    onChange={(evento) =>
                      setFuncionarioSeleccionado(evento.target.value)
                    }
                  >
                    <option value="" disabled>
                      Selecciona el funcionario…
                    </option>
                    {funcionarios.map((funcionario) => (
                      <option key={funcionario.id} value={funcionario.id}>
                        {funcionario.nombre}
                      </option>
                    ))}
                  </select>
                  <small role="status">
                    {usuario.rol === "ventanilla"
                      ? `Sesión iniciada como ${usuario.nombre}. Responsable automático.`
                      : estadoCatalogos.funcionarios}
                  </small>
                </CampoFormulario>
                <CampoFormulario
                  className="col-span-full"
                  etiqueta="Asunto / resumen del documento"
                >
                  <textarea
                    name="asunto_documento"
                    rows="4"
                    maxLength="5000"
                    onChange={(evento) =>
                      setLongitudAsunto(evento.target.value.length)
                    }
                    placeholder="Describe el asunto o motivo de la radicación…"
                    required
                  />
                  <small>{longitudAsunto} caracteres</small>
                </CampoFormulario>
              </div>
            </SeccionFormulario>

            <SeccionFormulario
              numero="4"
              titulo="Soporte documental"
              descripcion="Adjunta hasta 5 documentos PDF (máx. 10 MB cada uno)."
            >
              <div
                className="upload-field"
                onDragOver={(evento) => evento.preventDefault()}
                onDrop={(evento) => {
                  evento.preventDefault();
                  aceptarArchivos(evento.dataTransfer.files);
                }}
              >
                <input
                  id="archivo-soporte"
                  name="archivos"
                  ref={selectorArchivo}
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Documentos PDF de soporte"
                  aria-invalid={Boolean(errorArchivos)}
                  aria-describedby={errorArchivos ? "error-archivos" : undefined}
                  multiple
                  onChange={(evento) => aceptarArchivos(evento.target.files)}
                />
                <p>Selecciona o arrastra hasta 5 archivos PDF</p>
                {errorArchivos && (
                  <div id="error-archivos">
                    <MensajeEstado tono="error">{errorArchivos}</MensajeEstado>
                  </div>
                )}
                {archivosSeleccionados.length > 0 && (
                  <ul aria-label="Archivos de radicación seleccionados">
                    {archivosSeleccionados.map((archivo, indice) => (
                      <li key={`${archivo.name}-${archivo.lastModified}`}>
                        <span>
                          {archivo.name} (
                          {(archivo.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setArchivosSeleccionados((actuales) =>
                              actuales.filter(
                                (_, posicion) => posicion !== indice,
                              ),
                            );
                            if (selectorArchivo.current)
                              selectorArchivo.current.value = "";
                          }}
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SeccionFormulario>
            <button
              className="radicar-submit"
              type="submit"
              disabled={enProceso}
            >
              {enProceso
                ? "Guardando radicado…"
                : "Generar radicado y registrar"}
            </button>
            <MensajeEstado tono={mensaje.tono}>{mensaje.texto}</MensajeEstado>
            {errorComprobante && datosComprobante && (
              <div>
                <p className="auth-message" data-state="error" role="alert">
                  El radicado {datosComprobante.numero_radicado} ya está guardado,
                  pero no se pudo generar o iniciar la descarga del comprobante.{" "}
                  {errorComprobante} No vuelvas a registrar este documento.
                  Puedes reintentar el comprobante o recuperarlo desde Consultar radicados.
                </p>
                <button
                  type="button"
                  disabled={enProceso}
                  onClick={() => descargarComprobante(datosComprobante)}
                >
                  Reintentar comprobante
                </button>
              </div>
            )}
          </form>
        </section>
      </main>
      <PiePagina />
    </div>
  );
}

function SeccionFormulario({ numero, titulo, descripcion, children }) {
  return (
    <section className="form-section">
      <header className="form-section-header">
        <span className="section-badge">{numero}</span>
        <div>
          <h3>{titulo}</h3>
          <p>{descripcion}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function CampoFormulario({
  etiqueta,
  children,
  className = "",
  required = true,
}) {
  // Un campo puede contener el control y, además, ayudas o botones para recargar catálogos.
  // Por eso buscamos el input/select/textarea entre todos los hijos, en vez de asumir un hijo único.
  const contenido = Children.toArray(children);
  const indiceControl = contenido.findIndex(
    (elemento) =>
      isValidElement(elemento) &&
      ["input", "select", "textarea"].includes(elemento.type),
  );
  const control = indiceControl >= 0 ? contenido[indiceControl] : null;
  const nombreControl = control?.props.name || etiqueta;
  const idControl =
    control?.props.id ||
    `campo-${nombreControl.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  if (control)
    contenido[indiceControl] = cloneElement(control, { id: idControl });

  return (
    <div className={className}>
      <label htmlFor={control ? idControl : undefined}>
        {etiqueta}{" "}
        {required ? (
          <span className="campo-obligatorio">*</span>
        ) : (
          <span className="campo-opcional">(opcional)</span>
        )}
      </label>
      {contenido}
    </div>
  );
}
