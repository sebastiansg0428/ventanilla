import { useEffect, useState } from "react";
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
        <div>
          <h1>Alcaldía Municipal</h1>
          <p>Sistema de Gestión Documental y Ventanilla Única</p>
        </div>
        <span>
          Sesión: <strong>{usuario.nombre}</strong>
        </span>
      </header>
      <nav className="app-nav" aria-label="Navegación principal">
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
          <a href="registro_usuario.html">Registrar usuario</a>
        )}
        <button type="button" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </nav>
    </>
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
