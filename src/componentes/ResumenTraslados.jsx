import { useEffect, useState } from "react";
import { solicitarApi } from "../servicios/api";

export function ResumenTraslados({ numero, destino, prospectivo = false }) {
  const [revision, setRevision] = useState(0);
  const [estado, setEstado] = useState({ numero: null, resumen: null, error: "" });
  useEffect(() => {
    let vigente = true;
    setEstado({ numero, resumen: null, error: "" });
    (async () => {
      try {
        const respuesta = await solicitarApi(`/api/radicados/${encodeURIComponent(numero)}/traslados/resumen`);
        const resultado = await respuesta.json();
        const resumen = resultado.resumen;
        if (resultado.success !== true || !resumen ||
            !Number.isSafeInteger(resumen.total_aprobados) || resumen.total_aprobados < 0 ||
            resumen.umbral_reiteracion !== 3 || !Array.isArray(resumen.dependencias_visitadas_ids) ||
            resumen.dependencias_visitadas_ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
          throw new Error("Respuesta de antecedentes de traslado inválida.");
        }
        if (vigente) setEstado({ numero, resumen, error: "" });
      } catch (error) {
        if (vigente) setEstado({ numero, resumen: null, error: error.message });
      }
    })();
    return () => { vigente = false; };
  }, [numero, revision]);

  const actual = estado.numero === numero ? estado : { resumen: null, error: "" };
  const { resumen } = actual;
  const reiteracion = prospectivo && resumen &&
    resumen.total_aprobados + 1 >= resumen.umbral_reiteracion;
  const devolucion = prospectivo && resumen && resumen.dependencias_visitadas_ids.includes(Number(destino));
  return (
    <section className="traslados-seguimiento" aria-label="Antecedentes de traslados">
      {!resumen && !actual.error && <p role="status">Consultando antecedentes de traslados…</p>}
      {actual.error && <>
        <p role="alert">No se pudieron comprobar los antecedentes de traslado. {actual.error}</p>
        {prospectivo && <p>Puedes continuar con la solicitud o decisión; los avisos son informativos.</p>}
        <button type="button" className="traslados-boton-secundario"
          onClick={() => setRevision((n) => n + 1)}>Reintentar antecedentes de traslados</button>
      </>}
      {resumen && <>
        <p>Traslados aprobados registrados: <strong>{resumen.total_aprobados}</strong>.</p>
        {(reiteracion || devolucion) && <div className="traslados-aviso" role="status" aria-live="polite">
          {reiteracion && <p><strong>Reiteración de traslados.</strong> Esta aprobación sería el traslado número {resumen.total_aprobados + 1}. Revisa la competencia de la dependencia de destino para evitar nuevas reasignaciones.</p>}
          {devolucion && <p><strong>Regreso a una dependencia anterior.</strong> El destino seleccionado ya tuvo este radicado según los antecedentes registrados.</p>}
          <p>Estos avisos no impiden continuar ni suspenden o reinician el plazo de respuesta.</p>
        </div>}
      </>}
    </section>
  );
}
