import { useEffect, useRef, useState } from "react";
import { solicitarApi, limpiarSesion, confirmarSesion } from "../servicios/api";

// Este hook concentra la comprobación de sesión para todas las pantallas protegidas.
export function usarSesion({ soloRadicacion = false } = {}) {
  const [estadoSesion, setEstadoSesion] = useState({
    verificando: true,
    usuario: null,
    mensajeError: "",
  });

  useEffect(() => {
    let vigente = true;
    confirmarSesion()
      .then((usuario) => {
        if (!vigente) return;
        if (soloRadicacion && usuario.rol === "funcionario") {
          window.location.replace("consultar.html");
          return;
        }
        setEstadoSesion({ verificando: false, usuario, mensajeError: "" });
      })
      .catch((error) => {
        if (!vigente) return;
        setEstadoSesion({
          verificando: false,
          usuario: null,
          mensajeError: error.message,
        });
      });
    return () => {
      vigente = false;
    };
  }, [soloRadicacion]);

  return estadoSesion;
}

export function ProteccionSesion({
  children,
  soloRadicacion = false,
  soloAdministrador = false,
}) {
  const { verificando, usuario, mensajeError } = usarSesion({ soloRadicacion });
  if (verificando)
    return (
      <main id="sesion-estado" role="status">
        Verificando sesión…
      </main>
    );
  if (!usuario)
    return (
      <main className="auth-shell">
        <p className="auth-message" data-state="error">
          {mensajeError || "Debes iniciar sesión."}
        </p>
      </main>
    );
  if (soloAdministrador && usuario.rol !== "administrador") {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Acceso restringido</h1>
          <p>Solo un administrador puede registrar usuarios.</p>
          <a href="index.html">Volver al sistema</a>
        </section>
      </main>
    );
  }
  return children(usuario);
}

export function EncabezadoAplicacion({ usuario, pantallaActual = "radicar" }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const botonMenu = useRef(null);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 767px)");
    if (!media) return;
    const cerrarAlCambiarAncho = () => setMenuAbierto(false);
    media.addEventListener("change", cerrarAlCambiarAncho);
    return () => media.removeEventListener("change", cerrarAlCambiarAncho);
  }, []);

  async function cerrarSesion() {
    try {
      await solicitarApi("/api/auth/logout", { method: "POST" });
    } catch (error) {
      // Aunque falle la notificación de cierre, borrar la sesión local impide seguir operando.
      console.error("No se pudo notificar el cierre de sesión:", error);
    } finally {
      limpiarSesion();
      window.location.replace("login.html");
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__identidad">
          <img
            className="app-header__escudo"
            src={`${import.meta.env.BASE_URL}img/escudo-miranda.png`}
            alt="Escudo del municipio de Miranda"
            width="350"
            height="355"
          />
          <div className="app-header__texto">
            <h1>Alcaldía Municipal</h1>
            <p>Sistema de Gestión Documental y Ventanilla Única</p>
          </div>
        </div>
        <span>
          Sesión: <strong>{usuario.nombre}</strong>
        </span>
      </header>
      <nav
        className="app-nav"
        aria-label="Navegación principal"
        onKeyDown={(evento) => {
          if (evento.key === "Escape" && menuAbierto) {
            evento.preventDefault();
            setMenuAbierto(false);
            botonMenu.current?.focus();
          }
        }}
      >
        <button
          ref={botonMenu}
          type="button"
          className="app-nav-toggle"
          aria-expanded={menuAbierto}
          aria-controls="navegacion-enlaces"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
        >
          {menuAbierto ? "Cerrar menú" : "Abrir menú"}
        </button>
        <div
          id="navegacion-enlaces"
          className="app-nav-links"
          data-abierto={menuAbierto}
        >
        {usuario.rol !== "funcionario" && (
          <a
            aria-current={pantallaActual === "radicar" ? "page" : undefined}
            href="index.html"
          >
            Radicar documento
          </a>
        )}
        <a
          aria-current={pantallaActual === "consultar" ? "page" : undefined}
          href="consultar.html"
        >
          Consultar radicados
        </a>
        {usuario.rol === "administrador" && (
          <>
            <a
              aria-current={pantallaActual === "usuarios" ? "page" : undefined}
              href="registro_usuario.html"
            >
              Gestión de usuarios
            </a>
            <a
              aria-current={pantallaActual === "catalogos" ? "page" : undefined}
              href="catalogos.html"
            >
              Gestión de catálogos
            </a>
          </>
        )}
        <button type="button" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
        </div>
      </nav>
    </>
  );
}

export function CeldaAdaptable({ etiqueta, children }) {
  return (
    <td role="cell">
      <span className="tarjeta-etiqueta" aria-hidden="true">{etiqueta}</span>
      <div className="tarjeta-valor">{children}</div>
    </td>
  );
}

export function PiePagina() {
  return (
    <footer className="app-footer">
      Sistema de Ventanilla Única | Alcaldía Municipal
    </footer>
  );
}

export function MensajeEstado({ children, tono = "" }) {
  return (
    <p
      className="auth-message"
      role="status"
      aria-live="polite"
      data-state={tono || undefined}
    >
      {children}
    </p>
  );
}

export function MarcaInstitucional() {
  return (
    <a className="auth-brand" href="login.html" aria-label="Ventanilla Única">
      <span className="auth-brand__mark" aria-hidden="true">
        VU
      </span>
      <span>
        Ventanilla <strong>Única</strong>
      </span>
    </a>
  );
}
