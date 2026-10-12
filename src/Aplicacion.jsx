import {
  PaginaInicioSesion,
  PaginaRegistroUsuarios,
} from "./paginas/PaginasAutenticacion";
import { PaginaConsultaRadicados } from "./paginas/ConsultaRadicados";
import { PaginaRadicacion } from "./paginas/Radicacion";

// Se conservan las cuatro URL que ya usa la aplicación y sus enlaces internos.
export default function Aplicacion() {
  const nombreArchivoPagina = window.location.pathname.split("/").pop();
  if (nombreArchivoPagina === "login.html") return <PaginaInicioSesion />;
  if (nombreArchivoPagina === "registro_usuario.html")
    return <PaginaRegistroUsuarios />;
  if (nombreArchivoPagina === "consultar.html")
    return <PaginaConsultaRadicados />;
  return <PaginaRadicacion />;
}
