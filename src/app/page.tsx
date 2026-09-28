"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { login } from "@/services/firebase/auth";
import {
  getRoleRoute,
  getUserDocument,
} from "@/services/firebase/users";

type StatusState =
  | "info"
  | "error"
  | "success";

export default function LoginPage() {
  const router = useRouter();

  const [darkMode, setDarkMode] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [status, setStatus] = useState(
    "Ingresa tus credenciales para continuar."
  );

  const [statusState, setStatusState] =
    useState<StatusState>("info");

  const [loading, setLoading] =
    useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const normalizedEmail =
      email.trim();

    /*
     * Validación de campos
     */

    if (
      !normalizedEmail &&
      !password
    ) {
      setStatus(
        "Ingresa tu correo electrónico y contraseña."
      );

      setStatusState("error");
      return;
    }

    if (!normalizedEmail) {
      setStatus(
        "Ingresa tu correo electrónico."
      );

      setStatusState("error");
      return;
    }

    if (!password) {
      setStatus(
        "Ingresa tu contraseña."
      );

      setStatusState("error");
      return;
    }

    /*
     * Validación básica del correo
     */

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(
        normalizedEmail
      )
    ) {
      setStatus(
        "Ingresa un correo electrónico válido."
      );

      setStatusState("error");
      return;
    }

    try {
      setLoading(true);

      setStatus(
        "Iniciando sesión..."
      );

      setStatusState("info");

      /*
       * Login mediante Firebase Authentication.
       */

      const user = await login(
        normalizedEmail,
        password,
        "temporary"
      );

      /*
       * Buscar el documento del usuario
       * en Firestore.
       */

      const userDocument =
        await getUserDocument(
          user.uid
        );

      if (!userDocument) {
        setStatus(
          "La cuenta existe, pero no tiene un perfil de usuario configurado."
        );

        setStatusState("error");
        return;
      }

      /*
       * Verificar estado de la cuenta.
       */

      if (
        userDocument.status !==
        "active"
      ) {
        setStatus(
          "Esta cuenta se encuentra deshabilitada."
        );

        setStatusState("error");
        return;
      }

      /*
       * Verificar rol y redirigir.
       */

      const route = getRoleRoute(
        userDocument.role
      );

      if (route === "/") {
        setStatus(
          "La cuenta tiene un rol no válido."
        );

        setStatusState("error");
        return;
      }

      setStatus(
        "Inicio de sesión correcto."
      );

      setStatusState("success");

      router.push(route);
    } catch (error) {
      console.error(
        "Error durante el login:",
        error
      );

      setStatus(
        getFirebaseErrorMessage(error)
      );

      setStatusState("error");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (
    value: string
  ) => {
    setEmail(value);

    if (statusState === "error") {
      setStatus(
        "Ingresa tus credenciales para continuar."
      );

      setStatusState("info");
    }
  };

  const handlePasswordChange = (
    value: string
  ) => {
    setPassword(value);

    if (statusState === "error") {
      setStatus(
        "Ingresa tus credenciales para continuar."
      );

      setStatusState("info");
    }
  };

  const handleRegister = () => {
    router.push("/register");
  };

  return (
    <main
      className={`login-page ${
        darkMode ? "dark" : ""
      }`}
    >
      {/* ==================================================
          PANEL VISUAL
          ================================================== */}

      <section
        className="hero-panel"
        aria-label="Información de Foxcat Medical"
      >
        <div className="hero-content">

          <div className="hero-top">
            <span className="eyebrow">
              Foxcat Medical
            </span>

            <button
              type="button"
              className="theme-toggle"
              aria-label={
                darkMode
                  ? "Cambiar a modo claro"
                  : "Cambiar a modo oscuro"
              }
              onClick={() =>
                setDarkMode(
                  (value) => !value
                )
              }
            >
              {darkMode
                ? "Modo claro"
                : "Modo oscuro"}
            </button>
          </div>

          <div className="hero-text">
            <h1>
              Plataforma clínica para el
              seguimiento y análisis de
              pacientes.
            </h1>

            <p>
              Accede a Foxcat Medical para
              consultar información clínica,
              seguimiento de pacientes y
              herramientas de análisis
              asistido por inteligencia
              artificial.
            </p>
          </div>

          <div
            className="hero-swatches"
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
            <span />
          </div>

        </div>
      </section>

      {/* ==================================================
          PANEL DE LOGIN
          ================================================== */}

      <section
        className="login-container"
        aria-label="Inicio de sesión"
      >
        <div className="login-card">

          {/* MARCA */}

          <div className="brand">
            <img
              src="/icons/logo.png"
              className="logo"
              alt="Logo Foxcat"
            />

            <div className="company">
              Foxcat World S.A.S
            </div>
          </div>

          {/* ENCABEZADO */}

          <div className="login-heading">
            <h2>
              Bienvenido
            </h2>

            <p>
              Ingresa con tus credenciales
              para continuar.
            </p>
          </div>

          {/* FORMULARIO */}

          <form
            onSubmit={handleSubmit}
            noValidate
          >

            {/* CORREO */}

            <div className="input-group">
              <label htmlFor="email">
                Correo electrónico
              </label>

              <input
                type="email"
                id="email"
                name="email"
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) =>
                  handleEmailChange(
                    event.target.value
                  )
                }
                disabled={loading}
                required
              />
            </div>

            {/* CONTRASEÑA */}

            <div className="input-group">
              <label htmlFor="password">
                Contraseña
              </label>

              <input
                type="password"
                id="password"
                name="password"
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  handlePasswordChange(
                    event.target.value
                  )
                }
                disabled={loading}
                required
              />
            </div>

            {/* ESTADO */}

            <div
              className="auth-status"
              data-state={statusState}
              role={
                statusState === "error"
                  ? "alert"
                  : "status"
              }
              aria-live="polite"
            >
              {status}
            </div>

            {/* AYUDA */}

            <a
              href="#"
              className="forgot"
              aria-label="Información de configuración"
              onClick={(event) =>
                event.preventDefault()
              }
            >
              ¿Problemas para ingresar?
            </a>

            {/* ACCIONES */}

            <div className="login-actions">

              <button
                type="submit"
                className="login-btn"
                disabled={loading}
              >
                {loading
                  ? "Iniciando sesión..."
                  : "Iniciar sesión"}
              </button>

              <button
                type="button"
                className="login-register-btn"
                onClick={handleRegister}
                disabled={loading}
              >
                Crear usuario
              </button>

            </div>

          </form>

          {/* FOOTER */}

          <footer className="footer">
            <span>
              2026 Foxcat World S.A.S
            </span>

            <span>
              Todos los derechos reservados
            </span>
          </footer>

        </div>
      </section>
    </main>
  );
}

/* ==========================================================
   FIREBASE ERROR MESSAGES
   ========================================================== */

function getFirebaseErrorMessage(
  error: unknown
): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error
      ? String(
          (
            error as {
              code: unknown;
            }
          ).code
        )
      : "";

  switch (code) {
    case "auth/invalid-credential":
      return "Correo o contraseña incorrectos.";

    case "auth/invalid-email":
      return "El correo electrónico no es válido.";

    case "auth/user-disabled":
      return "Esta cuenta está deshabilitada.";

    case "auth/too-many-requests":
      return "Demasiados intentos. Intenta nuevamente más tarde.";

    case "auth/network-request-failed":
      return "No fue posible conectarse con Firebase.";

    case "auth/user-not-found":
      return "No existe una cuenta con este correo.";

    case "auth/wrong-password":
      return "La contraseña es incorrecta.";

    case "auth/operation-not-allowed":
      return "El método de acceso no está habilitado en Firebase.";

    default:
      return "No fue posible iniciar sesión. Intenta nuevamente.";
  }
}
