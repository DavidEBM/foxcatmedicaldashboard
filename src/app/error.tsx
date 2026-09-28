"use client";

import { useState } from "react";

interface ErrorPageProps {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}

export default function ErrorPage({
  error,
  reset,
}: ErrorPageProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleRetry = () => {
    reset();
  };

  return (
    <main className="login-page">
      {/* PANEL IZQUIERDO */}

      <section className="login-hero">
        <div className="hero-top">
          <div className="hero-brand">
            <img
              src="/icons/logo.png"
              alt="Foxcat Medical"
              className="hero-logo"
            />

            <span>Foxcat Medical</span>
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={() => {
              document.documentElement.classList.toggle(
                "dark"
              );
            }}
            aria-label="Cambiar tema"
          >
            ◐
          </button>
        </div>

        <div className="hero-content">
          <span className="hero-label">
            PLATAFORMA CLÍNICA
          </span>

          <h1>
            Algo no salió
            <br />
            como esperábamos.
          </h1>

          <p>
            Ocurrió un error inesperado mientras
            cargábamos esta sección de Foxcat Medical.
            Puedes intentar nuevamente.
          </p>

          <div className="hero-swatches">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      {/* PANEL DERECHO */}

      <section className="login-panel">
        <div className="login-card error-card">
          <div className="login-logo">
            <img
              src="/icons/logo.png"
              alt="Foxcat Medical"
            />
          </div>

          <div className="login-heading">
            <span className="login-company">
              Foxcat World S.A.S
            </span>

            <h2>
              Se produjo un error
            </h2>

            <p>
              No pudimos completar esta operación.
              Intenta cargar nuevamente la página.
            </p>
          </div>

          <div
            className="auth-status error"
            role="alert"
          >
            No fue posible cargar correctamente
            esta sección.
          </div>

          <button
            type="button"
            className="login-btn"
            onClick={handleRetry}
          >
            Intentar nuevamente
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Volver al inicio
          </button>

          <button
            type="button"
            className="error-details-toggle"
            onClick={() =>
              setShowDetails((current) => !current)
            }
          >
            {showDetails
              ? "Ocultar detalles"
              : "Mostrar detalles"}
          </button>

          {showDetails && (
            <div className="error-details">
              <p>
                {error?.message ||
                  "Error desconocido."}
              </p>

              {error?.digest && (
                <small>
                  Código: {error.digest}
                </small>
              )}
            </div>
          )}

          <footer className="login-footer">
            <span>
              © {new Date().getFullYear()} Foxcat
              Medical
            </span>

            <span>
              Plataforma clínica
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}