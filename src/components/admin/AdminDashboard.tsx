"use client";

import { useState } from "react";
import { logout } from "@/services/firebase/auth";

import type { AdminUser } from "@/services/firebase/admin-users";

import AdminProfile from "@/components/admin/AdminProfile";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminPatients from "@/components/admin/AdminPatients";
import AdminImport from "@/components/admin/AdminImport";
import AdminTraining from "@/components/admin/AdminTraining";
import AdminValidations from "@/components/admin/AdminValidations";
import AdminRegistrationControl from "@/components/admin/AdminRegistrationControl";

type AdminSection =
  | "profile"
  | "users"
  | "registration"
  | "patients"
  | "validations"
  | "models"
  | "training"
  | "import"
  | null;

interface AdminDashboardProps {
  currentAdmin: AdminUser;
}

interface NavigationItem {
  id: Exclude<AdminSection, null>;
  label: string;
  icon: string;
  description: string;
}

const navigationItems: NavigationItem[] = [
  {
    id: "profile",
    label: "Perfil",
    icon: "◉",
    description:
      "Información de la cuenta administrativa",
  },
  {
    id: "users",
    label: "Usuarios",
    icon: "◎",
    description:
      "Cuentas, roles y estados",
  },
  {
    id: "patients",
    label: "Pacientes",
    icon: "♡",
    description:
      "Pacientes y asignaciones médicas",
  },
  {
    id: "registration",
    label: "Registro",
    icon: "âš™",
    description: "Habilitar o desactivar nuevos registros",
  },
  {
    id: "validations",
    label: "Validaciones",
    icon: "✓",
    description:
      "Comparativa entre predicciones IA y criterio médico",
  },
  {
    id: "models",
    label: "Modelos de IA",
    icon: "◇",
    description:
      "Modelos de inteligencia artificial",
  },
  {
    id: "training",
    label: "Entrenar IAs",
    icon: "⚙",
    description:
      "Entrenamiento, validación y diagnósticos de modelos",
  },
  {
    id: "import",
    label: "Importar",
    icon: "↑",
    description:
      "Importación de información clínica",
  },
];

export default function AdminDashboard({
  currentAdmin,
}: AdminDashboardProps) {
  const [activeSection, setActiveSection] =
    useState<AdminSection>(null);
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const currentNavigationItem =
    navigationItems.find(
      (item) => item.id === activeSection
    );

  function handleNavigation(
    section: Exclude<AdminSection, null>
  ) {
    setActiveSection(section);
  }

  async function handleLogout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await logout();
      window.location.replace("/");
    } catch {
      setIsLoggingOut(false);
    }
  }

  function renderActiveSection() {
    switch (activeSection) {
      case "profile":
        return (
          <AdminProfile
            admin={currentAdmin}
          />
        );

      case "users":
        return (
          <AdminUsers
            currentAdmin={currentAdmin}
          />
        );

      case "patients":
        return (
          <AdminPatients
            currentAdmin={currentAdmin}
          />
        );

      case "registration":
        return <AdminRegistrationControl currentAdmin={currentAdmin} />;

      case "validations":
        return <AdminValidations />;

      case "models":
        return (
          <section className="admin-module">
            <div className="admin-module-header">
              <div>
                <span className="admin-eyebrow">
                  INTELIGENCIA ARTIFICIAL
                </span>

                <h2>
                  Modelos de IA
                </h2>

                <p>
                  Administración de los modelos
                  utilizados por Foxcat Medical.
                </p>
              </div>
            </div>

            <div className="admin-empty-state">
              <div className="admin-empty-icon">
                ◇
              </div>

              <h3>
                Módulo pendiente de migración
              </h3>

              <p>
                La administración de modelos de
                inteligencia artificial estará
                disponible en una siguiente etapa.
              </p>
            </div>
          </section>
        );

      case "training":
        return <AdminTraining />;

      case "import":
        return (
          <AdminImport
            currentAdmin={currentAdmin}
          />
        );

      default:
        return (
          <section className="admin-welcome">
            <div className="admin-welcome-icon">
              +
            </div>

            <div>
              <span className="admin-eyebrow">
                BIENVENIDO
              </span>

              <h2>
                Centro de administración
              </h2>

              <p>
                Selecciona un módulo del menú para
                administrar los diferentes
                componentes de Foxcat Medical.
              </p>
            </div>
          </section>
        );
    }
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-topbar">
        <div className="admin-brand">
          <div className="admin-brand-logo">
            <img
              src="/icons/logo.png"
              alt="Foxcat Medical"
            />
          </div>

          <div className="admin-brand-text">
            <strong>
              Foxcat Medical
            </strong>

            <span>
              Panel administrativo
            </span>
          </div>
        </div>

        <div className="admin-topbar-account">
          <span className="admin-account-role">
            Administrador
          </span>

          <span className="admin-account-name">
            {currentAdmin.displayName ||
              currentAdmin.email ||
              "Administrador"}
          </span>

          <button
            type="button"
            className="admin-logout-button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-label="Cerrar sesión"
          >
            {isLoggingOut ? "Saliendo..." : "Cerrar sesión"}
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <span className="admin-sidebar-label">
              ADMINISTRACIÓN
            </span>

            <h2>
              Centro de control
            </h2>
          </div>

          <nav
            className="admin-navigation"
            aria-label="Navegación administrativa"
          >
            {navigationItems.map((item) => {
              const isActive =
                activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    isActive
                      ? "admin-nav-button active"
                      : "admin-nav-button"
                  }
                  onClick={() =>
                    handleNavigation(item.id)
                  }
                  title={item.description}
                  aria-current={
                    isActive
                      ? "page"
                      : undefined
                  }
                >
                  <span className="admin-nav-icon">
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <div className="admin-status-indicator">
              <span className="admin-status-dot" />

              <div>
                <strong>
                  Sistema activo
                </strong>

                <span>
                  Sesión administrativa
                </span>
              </div>
            </div>
          </div>
        </aside>

        <main className="admin-main">
          <div className="admin-content">
            <div className="admin-intro">
              <div>
                <span className="admin-eyebrow">
                  PANEL ADMINISTRATIVO
                </span>

                <h1>
                  Gestión de Foxcat Medical
                </h1>

                <p>
                  Administra usuarios, pacientes,
                  modelos de inteligencia artificial
                  e información clínica.
                </p>
              </div>

              <div className="admin-intro-badge">
                <span className="admin-status-dot" />

                <span>
                  Sistema operativo
                </span>
              </div>
            </div>

            {currentNavigationItem && (
              <div className="admin-breadcrumb">
                <span>
                  Administración
                </span>

                <span className="admin-breadcrumb-separator">
                  /
                </span>

                <strong>
                  {currentNavigationItem.label}
                </strong>
              </div>
            )}

            <div className="admin-section-container">
              {renderActiveSection()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
