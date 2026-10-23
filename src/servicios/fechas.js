const ZONA = "America/Bogota";
const faltaFecha = (valor) => valor == null || (typeof valor === "string" && !valor.trim());
const valorRecepcion = (radicado) => faltaFecha(radicado.fecha_hora_recepcion)
  ? radicado.fecha_creacion : radicado.fecha_hora_recepcion;

export function convertirFechaBogota(valor) {
  if (valor instanceof Date)
    return Number.isNaN(valor.getTime()) ? null : new Date(valor.getTime());
  if (typeof valor !== "string") return null;
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(valor.trim());
  if (!partes) return null;
  const [, ano, mes, dia, hora = "00", minuto = "00", segundo = "00", fraccion = "", zona = "-05:00"] = partes;
  const civil = `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
  const validacion = new Date(`${civil}Z`);
  if (Number.isNaN(validacion.getTime()) || validacion.toISOString().slice(0, 19) !== civil)
    return null;
  const offset = zona.toUpperCase() === "Z" ? "Z" : zona.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  if (offset !== "Z" && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59))
    return null;
  const fecha = new Date(`${civil}${fraccion.slice(0, 4)}${offset}`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function obtenerFechaBogota(valor) {
  const fecha = convertirFechaBogota(valor);
  if (!fecha) return null;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(fecha);
  const campos = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${campos.year}-${campos.month}-${campos.day}`;
}

export function obtenerDiaRadicacion(radicado) {
  return obtenerFechaBogota(valorRecepcion(radicado));
}

export function formatearFechaRadicacion(radicado) {
  const valor = valorRecepcion(radicado);
  if (faltaFecha(valor)) return "Fecha no disponible";
  const fecha = convertirFechaBogota(valor);
  return fecha ? new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA, dateStyle: "medium", timeStyle: "medium",
  }).format(fecha) : "Fecha no válida";
}
