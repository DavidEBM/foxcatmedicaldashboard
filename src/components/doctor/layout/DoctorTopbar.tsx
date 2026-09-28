"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

interface DoctorTopbarProps {
  title?: string;
  onThemeToggle?: () => void;
  darkMode?: boolean;
  onNavigate?: (item: string) => void;

  workspaceMenuOpen?: boolean;
  workspaceMenuEnabled?: boolean;
  onWorkspaceMenuToggle?: () => void;
  userName?: string;
  userEmail?: string;
}

interface TopbarMenuItem {
  id: string;
  label: string;
  description: string;
  icon: string;
}

const TOPBAR_MENU_ITEMS: TopbarMenuItem[] = [
  {
    id: "home",
    label: "Inicio",
    description:
      "Volver al inicio del panel médico",
    icon: "⌂",
  },
  {
    id: "notifications",
    label: "Notificaciones",
    description:
      "Alertas y eventos recientes",
    icon: "◉",
  },
  {
    id: "help",
    label: "Ayuda",
    description:
      "Centro de ayuda y documentación",
    icon: "?",
  },
  {
    id: "settings",
    label: "Configuración",
    description:
      "Configuración general del sistema",
    icon: "⚙",
  },
];

export default function DoctorTopbar({
  title = "Panel médico",
  onThemeToggle,
  darkMode = false,
  onNavigate,
  workspaceMenuOpen = true,
  workspaceMenuEnabled = true,
  onWorkspaceMenuToggle,
  userName = "Médico",
  userEmail = "Cuenta médica",
}: DoctorTopbarProps) {
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("es"))
    .join("") || "DR";
  const [menuOpen, setMenuOpen] =
    useState(false);

  const [userMenuOpen, setUserMenuOpen] =
    useState(false);

  const menuRef =
    useRef<HTMLDivElement>(null);

  const userRef =
    useRef<HTMLDivElement>(null);

  /* ========================================================
     OUTSIDE CLICK
     ======================================================== */

  useEffect(() => {
    const handleOutsideClick = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node;

      if (
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }

      if (
        userRef.current &&
        !userRef.current.contains(target)
      ) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  /* ========================================================
     GLOBAL MENU
     ======================================================== */

  const handleMenuToggle = () => {
    setMenuOpen((current) => !current);
    setUserMenuOpen(false);
  };

  const handleMenuItem = (item: string) => {
    setMenuOpen(false);
    onNavigate?.(item);
  };

  /* ========================================================
     WORKSPACE MENU
     ======================================================== */

  const handleWorkspaceMenuToggle = () => {
    onWorkspaceMenuToggle?.();
  };

  /* ========================================================
     USER MENU
     ======================================================== */

  const handleUserToggle = () => {
    setUserMenuOpen(
      (current) => !current
    );

    setMenuOpen(false);
  };

  const handleProfile = () => {
    setUserMenuOpen(false);

    onNavigate?.("profile");
  };

  const handlePreferences = () => {
    setUserMenuOpen(false);

    onNavigate?.("preferences");
  };

  const handleSecurity = () => {
    setUserMenuOpen(false);

    onNavigate?.("security");
  };

  const handleLogout = () => {
    setUserMenuOpen(false);

    onNavigate?.("logout");
  };

  return (
    <header className="doctor-topbar">
      {/* ==================================================
          LEFT
          ================================================== */}

      <div className="doctor-topbar-left">
        <div
          ref={menuRef}
          className="doctor-topbar-menu-wrapper"
        >
          <button
            type="button"
            className={`doctor-topbar-menu ${
              menuOpen ? "is-open" : ""
            }`}
            onClick={handleMenuToggle}
            aria-label="Abrir menú global"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="Menú global"
          >
            <span />
            <span />
            <span />
          </button>

          {menuOpen && (
            <div
              className="doctor-topbar-menu-dropdown"
              role="menu"
              aria-label="Menú global"
            >
              <div className="doctor-topbar-menu-header">
                <strong>
                  Accesos globales
                </strong>

                <small>
                  Sistema médico
                </small>
              </div>

              <div className="doctor-topbar-menu-divider" />

              {TOPBAR_MENU_ITEMS.map(
                (item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="doctor-topbar-menu-item"
                    onClick={() =>
                      handleMenuItem(
                        item.id
                      )
                    }
                    role="menuitem"
                  >
                    <span
                      className="doctor-topbar-menu-item-icon"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>

                    <span className="doctor-topbar-menu-item-content">
                      <strong>
                        {item.label}
                      </strong>

                      <small>
                        {item.description}
                      </small>
                    </span>
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* =================================================
            BRAND
            ================================================= */}

        <div className="doctor-topbar-brand">
          <div
            className="doctor-topbar-brand-mark"
            aria-hidden="true"
          >
            +
          </div>

          <div className="doctor-topbar-heading">
            <span className="doctor-topbar-section">
              Atención clínica
            </span>

            <h1>{title}</h1>
          </div>
        </div>
      </div>

      {/* ==================================================
          RIGHT
          ================================================== */}

      <div className="doctor-topbar-right">
        {/* ------------------------------------------------
            NOTIFICATIONS
            ------------------------------------------------ */}

        <button
          type="button"
          className="doctor-topbar-icon-button"
          onClick={() =>
            onNavigate?.("notifications")
          }
          aria-label="Notificaciones"
          title="Notificaciones"
        >
          <span aria-hidden="true">
            ◉
          </span>
        </button>

        {/* ------------------------------------------------
            THEME
            ------------------------------------------------ */}

        <button
          type="button"
          className="doctor-topbar-icon-button"
          onClick={onThemeToggle}
          aria-label={
            darkMode
              ? "Cambiar a modo claro"
              : "Cambiar a modo oscuro"
          }
          title={
            darkMode
              ? "Modo claro"
              : "Modo oscuro"
          }
        >
          {darkMode ? "☀" : "☾"}
        </button>

        {/* ------------------------------------------------
            WORKSPACE WIDGET MENU
            ------------------------------------------------ */}

        {workspaceMenuEnabled && (
          <button
            type="button"
            className={`doctor-topbar-icon-button doctor-topbar-workspace-toggle ${workspaceMenuOpen ? "is-active" : ""}`}
            onClick={handleWorkspaceMenuToggle}
            aria-label={workspaceMenuOpen ? "Ocultar menú de widgets" : "Mostrar menú de widgets"}
            aria-expanded={workspaceMenuOpen}
            title={workspaceMenuOpen ? "Ocultar menú de widgets" : "Mostrar menú de widgets"}
          >
            <span className="doctor-topbar-workspace-toggle-icon" aria-hidden="true">
              {workspaceMenuOpen ? "⌃" : "⌄"}
            </span>
          </button>
        )}

        {/* ------------------------------------------------
            USER
            ------------------------------------------------ */}

        <div
          ref={userRef}
          className="doctor-topbar-user"
        >
          <button
            type="button"
            className={`doctor-user-button ${
              userMenuOpen
                ? "is-open"
                : ""
            }`}
            onClick={handleUserToggle}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            <span
              className="doctor-user-avatar"
              aria-hidden="true"
            >
              {initials}
            </span>

            <span className="doctor-user-info">
              <strong>
                {userName}
              </strong>

              <small>
                {userEmail}
              </small>
            </span>

            <span
              className={`doctor-user-chevron ${
                userMenuOpen
                  ? "is-open"
                  : ""
              }`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          {userMenuOpen && (
            <div
              className="doctor-user-dropdown"
              role="menu"
              aria-label="Opciones de usuario"
            >
              <div className="doctor-user-dropdown-header">
                <span className="doctor-user-dropdown-avatar">
                  {initials}
                </span>

                <div>
                  <strong>
                    {userName}
                  </strong>

                  <span>
                    {userEmail}
                  </span>
                </div>
              </div>

              <div className="doctor-user-dropdown-divider" />

              <button
                type="button"
                className="doctor-user-dropdown-item"
                onClick={handleProfile}
                role="menuitem"
              >
                <span
                  className="doctor-user-dropdown-item-icon"
                  aria-hidden="true"
                >
                  ◉
                </span>

                <span>
                  <strong>
                    Mi perfil
                  </strong>

                  <small>
                    Ver información de la cuenta
                  </small>
                </span>
              </button>

              <button
                type="button"
                className="doctor-user-dropdown-item"
                onClick={handlePreferences}
                role="menuitem"
              >
                <span
                  className="doctor-user-dropdown-item-icon"
                  aria-hidden="true"
                >
                  ⚙
                </span>

                <span>
                  <strong>
                    Preferencias
                  </strong>

                  <small>
                    Personalizar el panel
                  </small>
                </span>
              </button>

              <button
                type="button"
                className="doctor-user-dropdown-item"
                onClick={handleSecurity}
                role="menuitem"
              >
                <span
                  className="doctor-user-dropdown-item-icon"
                  aria-hidden="true"
                >
                  🔐
                </span>

                <span>
                  <strong>
                    Seguridad
                  </strong>

                  <small>
                    Cuenta y acceso
                  </small>
                </span>
              </button>

              <div className="doctor-user-dropdown-divider" />

              <button
                type="button"
                className="doctor-user-dropdown-item doctor-user-dropdown-logout"
                onClick={handleLogout}
                role="menuitem"
              >
                <span
                  className="doctor-user-dropdown-item-icon"
                  aria-hidden="true"
                >
                  ↪
                </span>

                <span>
                  <strong>
                    Cerrar sesión
                  </strong>

                  <small>
                    Salir de la cuenta
                  </small>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
