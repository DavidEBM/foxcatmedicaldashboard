"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  completeGoogleRegistration,
  register,
  registerWithGoogle,
} from "@/services/firebase/auth";

type StatusState =
  | "info"
  | "error"
  | "success";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const inviteCode =
    searchParams.get("invite");

  const [darkMode, setDarkMode] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [acceptedTerms, setAcceptedTerms] =
    useState(false);

  const [status, setStatus] =
    useState(
      inviteCode
        ? "Tienes una invitación para vincular una ficha clínica."
        : "Crea tu cuenta de paciente para continuar."
    );

  const [statusState, setStatusState] =
    useState<StatusState>("info");

  const [loading, setLoading] =
    useState(false);

  const [registrationAllowed, setRegistrationAllowed] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    void fetch("/api/auth/registration-status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ allowRegistration?: boolean }> : null)
      .then((payload) => {
        if (!mounted || !payload || payload.allowRegistration !== false) return;
        setRegistrationAllowed(false);
        setStatus("El registro de nuevos usuarios estÃ¡ temporalmente desactivado por un administrador.");
        setStatusState("error");
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * ==========================================================
   * ESTADO
   * ==========================================================
   */

  const resetStatus = () => {
    setStatus(
      inviteCode
        ? "Tienes una invitación para vincular una ficha clínica."
        : "Crea tu cuenta de paciente para continuar."
    );

    setStatusState("info");
  };

  /*
   * ==========================================================
   * CAMPOS
   * ==========================================================
   */

  const handleEmailChange = (
    value: string
  ) => {
    setEmail(value);

    if (statusState === "error") {
      resetStatus();
    }
  };

  const handlePasswordChange = (
    value: string
  ) => {
    setPassword(value);

    if (statusState === "error") {
      resetStatus();
    }
  };

  const handleConfirmPasswordChange = (
    value: string
  ) => {
    setConfirmPassword(value);

    if (statusState === "error") {
      resetStatus();
    }
  };

  const handleTermsChange = (
    checked: boolean
  ) => {
    setAcceptedTerms(checked);

    if (statusState === "error") {
      resetStatus();
    }
  };

  /*
   * ==========================================================
   * REGISTRO CON CORREO
   * ==========================================================
   */

  const handleRegister = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (!registrationAllowed) {
      setStatus("El registro de nuevos usuarios estÃ¡ temporalmente desactivado por un administrador.");
      setStatusState("error");
      return;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    /*
     * VALIDACIÓN DE CAMPOS
     */

    if (
      !normalizedEmail &&
      !password &&
      !confirmPassword
    ) {
      setStatus(
        "Completa todos los campos para crear tu cuenta."
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
        "Ingresa una contraseña."
      );

      setStatusState("error");
      return;
    }

    if (!confirmPassword) {
      setStatus(
        "Confirma tu contraseña."
      );

      setStatusState("error");
      return;
    }

    /*
     * VALIDACIÓN DEL CORREO
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

    /*
     * TÉRMINOS
     */

    if (!acceptedTerms) {
      setStatus(
        "Debes aceptar los términos y condiciones para continuar."
      );

      setStatusState("error");
      return;
    }

    /*
     * CONTRASEÑA
     */

    if (password.length < 8) {
      setStatus(
        "La contraseña debe tener al menos 8 caracteres."
      );

      setStatusState("error");
      return;
    }

    if (password !== confirmPassword) {
      setStatus(
        "Las contraseñas no coinciden."
      );

      setStatusState("error");
      return;
    }

    /*
     * FIREBASE
     */

    try {
      setLoading(true);

      setStatus(
        "Creando cuenta..."
      );

      setStatusState("info");

      await register(
        normalizedEmail,
        password,
        "temporary"
      );

      /*
       * INVITACIÓN
       *
       * Se mantiene preparado para
       * el flujo posterior de vinculación.
       */

      if (inviteCode) {
        // TODO:
        // await validateInvitation(inviteCode);
        // await claimPatientRecord(...);
      }

      setStatus(
        inviteCode
          ? "Cuenta creada. La ficha clínica será vinculada."
          : "Cuenta creada correctamente."
      );

      setStatusState("success");

      router.push("/patient");

    } catch (error) {
      console.error(
        "Error durante el registro:",
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

  /*
   * ==========================================================
   * REGISTRO CON GOOGLE
   * ==========================================================
   */

  const handleGoogleRegister =
    async () => {

      if (loading) {
        return;
      }

      if (!registrationAllowed) {
        setStatus("El registro de nuevos usuarios estÃ¡ temporalmente desactivado por un administrador.");
        setStatusState("error");
        return;
      }

      if (!acceptedTerms) {
        setStatus(
          "Debes aceptar los términos y condiciones para continuar."
        );

        setStatusState("error");
        return;
      }

      try {
        setLoading(true);

        setStatus(
          "Conectando con Google..."
        );

        setStatusState("info");

        const user =
          await registerWithGoogle(
            "temporary"
          );

        await completeGoogleRegistration(user);

        /*
         * INVITACIÓN
         */

        if (inviteCode) {
          // TODO:
          // await validateInvitation(inviteCode);
          // await claimPatientRecord(...);
        }

        setStatus(
          inviteCode
            ? "Cuenta conectada. La ficha clínica será vinculada."
            : "Cuenta de Google conectada correctamente."
        );

        setStatusState("success");

        router.push("/patient");

      } catch (error) {
        console.error(
          "Error durante el registro con Google:",
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

  /*
   * ==========================================================
   * RENDER
   * ==========================================================
   */

  return (
    <main
      className={`login-page ${
        darkMode ? "dark" : ""
      }`}
    >

      {/* =====================================================
          PANEL VISUAL
          ===================================================== */}

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
                  (current) => !current
                )
              }
              disabled={loading}
            >
              {darkMode
                ? "Modo claro"
                : "Modo oscuro"}
            </button>

          </div>

          <div className="hero-text">

            <h1>
              Crea tu cuenta para acceder
              a Foxcat Medical.
            </h1>

            <p>
              Regístrate para consultar tu
              información clínica, seguimiento
              de pacientes y herramientas de
              análisis asistido por inteligencia
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

      {/* =====================================================
          PANEL DE REGISTRO
          ===================================================== */}

      <section
        className="login-container"
        aria-label="Crear cuenta"
      >
        <div className="login-card register-card">

          {/* BRAND */}

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
              Crear usuario
            </h2>

            <p>
              Crea tu cuenta de paciente
              para continuar.
            </p>

          </div>

          {/* INVITACIÓN */}

          {inviteCode && (
            <div className="invite-notice">
              <strong>
                Invitación clínica
              </strong>

              <span>
                Tu cuenta podrá vincularse
                posteriormente con la ficha
                clínica asociada.
              </span>
            </div>
          )}

          {/* FORMULARIO */}

          <form
            onSubmit={handleRegister}
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
                disabled={loading || !registrationAllowed}
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
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  handlePasswordChange(
                    event.target.value
                  )
                }
                disabled={loading || !registrationAllowed}
                required
              />

            </div>

            {/* CONFIRMAR */}

            <div className="input-group">

              <label htmlFor="confirmPassword">
                Confirmar contraseña
              </label>

              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  handleConfirmPasswordChange(
                    event.target.value
                  )
                }
                disabled={loading || !registrationAllowed}
                required
              />

            </div>

            {/* TÉRMINOS */}

            <div className="terms-group">

              <label
                htmlFor="acceptedTerms"
                className="terms-label"
              >

                <input
                  type="checkbox"
                  id="acceptedTerms"
                  name="acceptedTerms"
                  checked={acceptedTerms}
                  onChange={(event) =>
                    handleTermsChange(
                      event.target.checked
                    )
                  }
                  disabled={loading || !registrationAllowed}
                  required
                />

                <span>
                  Acepto los{" "}

                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    términos y condiciones
                  </a>{" "}

                  <strong>*</strong>
                </span>

              </label>

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

            {/* ACCIONES */}

            <div className="register-actions">

              <button
                type="submit"
                className="login-btn"
                disabled={loading || !registrationAllowed}
              >
                {loading
                  ? "Creando..."
                  : "Crear usuario"}
              </button>

              <button
                type="button"
                className="google-btn"
                onClick={
                  handleGoogleRegister
                }
                disabled={loading || !registrationAllowed}
              >
                <span
                  className="google-icon"
                  aria-hidden="true"
                >
                  G
                </span>

                {loading
                  ? "Conectando..."
                  : "Continuar con Google"}
              </button>

              <button
                type="button"
                className="register-back-btn"
                onClick={() =>
                  router.push("/")
                }
                disabled={loading}
              >
                Volver al inicio
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

    case "auth/email-already-in-use":
      return "Ese correo ya está registrado.";

    case "auth/invalid-email":
      return "El correo electrónico no es válido.";

    case "auth/weak-password":
      return "La contraseña debe tener al menos 8 caracteres.";

    case "auth/popup-closed-by-user":
      return "Se cerró la ventana de Google antes de completar el registro.";

    case "auth/popup-blocked":
      return "El navegador bloqueó la ventana de Google.";

    case "auth/account-exists-with-different-credential":
      return "Ya existe una cuenta con ese correo usando otro método de acceso.";

    case "auth/network-request-failed":
      return "No fue posible conectarse con Firebase.";

    case "auth/too-many-requests":
      return "Demasiados intentos. Intenta nuevamente más tarde.";

    case "auth/operation-not-allowed":
      return "El registro con este método no está habilitado en Firebase.";

    case "auth/registration-disabled":
      return "El registro de nuevos usuarios estÃ¡ temporalmente desactivado por un administrador.";

    case "auth/user-disabled":
      return "Esta cuenta está deshabilitada.";

    case "auth/invalid-credential":
      return "No fue posible validar las credenciales.";

    default:
      return "No fue posible crear la cuenta. Intenta nuevamente.";
  }
}
