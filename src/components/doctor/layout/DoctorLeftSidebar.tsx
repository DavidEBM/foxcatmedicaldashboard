"use client";

interface DoctorLeftSidebarProps {
  collapsed?: boolean;
  activeItem?: string;
  patientsCount?: number;
  onNavigate?: (item: string) => void;
  onToggle?: () => void;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}

const MAIN_ITEMS: SidebarItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "⌂",
  },
  {
    id: "patients",
    label: "Pacientes",
    icon: "♙",
    badge: "12",
  },
  {
    id: "appointments",
    label: "Agenda",
    icon: "□",
  },
  {
    id: "consultations",
    label: "Consultas",
    icon: "＋",
  },
  {
    id: "monitoring",
    label: "Monitoreo",
    icon: "⌁",
  },
];

const CLINICAL_ITEMS: SidebarItem[] = [
  {
    id: "laboratory",
    label: "Laboratorio",
    icon: "◈",
  },
  {
    id: "history",
    label: "Historial",
    icon: "↺",
  },
  {
    id: "care-plans",
    label: "Planes de cuidado",
    icon: "✓",
  },
];

const MANAGEMENT_ITEMS: SidebarItem[] = [
  {
    id: "tools",
    label: "Herramientas",
    icon: "◇",
  },
  {
    id: "reports",
    label: "Reportes",
    icon: "▤",
  },
];

export default function DoctorLeftSidebar({
  collapsed = false,
  activeItem = "dashboard",
  patientsCount = 0,
  onNavigate,
  onToggle,
}: DoctorLeftSidebarProps) {
  const handleNavigate = (item: string) => {
    onNavigate?.(item);
  };

  const renderItem = (item: SidebarItem) => {
    const active = activeItem === item.id;
    const badge = item.id === "patients"
      ? String(patientsCount)
      : item.badge;

    return (
      <button
        key={item.id}
        type="button"
        className={`doctor-sidebar-item ${
          active ? "is-active" : ""
        }`}
        onClick={() => handleNavigate(item.id)}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
      >
        <span
          className="doctor-sidebar-item-icon"
          aria-hidden="true"
        >
          {item.icon}
        </span>

        {!collapsed && (
          <>
            <span className="doctor-sidebar-item-label">
              {item.label}
            </span>

            {badge && (
              <span className="doctor-sidebar-item-badge">
                {badge}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <aside
      className={`doctor-left-sidebar ${
        collapsed ? "is-collapsed" : ""
      }`}
      aria-label="Navegación clínica"
    >
      <div className="doctor-left-sidebar-scroll">
        {/* ==================================================
            PRINCIPAL
            ================================================== */}

        <div className="doctor-sidebar-section">
          {!collapsed && (
            <span className="doctor-sidebar-section-title">
              Principal
            </span>
          )}

          <nav
            className="doctor-sidebar-nav"
            aria-label="Navegación principal"
          >
            {MAIN_ITEMS.map(renderItem)}
          </nav>
        </div>

        {/* ==================================================
            CLÍNICO
            ================================================== */}

        <div className="doctor-sidebar-section">
          {!collapsed && (
            <span className="doctor-sidebar-section-title">
              Clínico
            </span>
          )}

          <nav
            className="doctor-sidebar-nav"
            aria-label="Módulos clínicos"
          >
            {CLINICAL_ITEMS.map(renderItem)}
          </nav>
        </div>

        {/* ==================================================
            GESTIÓN
            ================================================== */}

        <div className="doctor-sidebar-section doctor-sidebar-tools">
          {!collapsed && (
            <span className="doctor-sidebar-section-title">
              Gestión
            </span>
          )}

          <nav
            className="doctor-sidebar-nav"
            aria-label="Gestión"
          >
            {MANAGEMENT_ITEMS.map(renderItem)}
          </nav>
        </div>
      </div>

      {/* ====================================================
          FOOTER
          ==================================================== */}

      <div className="doctor-sidebar-footer">
        <div
          className="doctor-sidebar-system-status"
          title="Sistema operativo"
        >
          <span className="doctor-sidebar-status-dot" />

          {!collapsed && (
            <span className="doctor-sidebar-status-content">
              <strong>
                Sistema operativo
              </strong>

              <small>
                Servicios disponibles
              </small>
            </span>
          )}
        </div>

        {!collapsed && (
          <div className="doctor-sidebar-version">
            <span>
              Medical Dashboard
            </span>

            <span>
              v1.0
            </span>
          </div>
        )}
      </div>

      {/* ====================================================
          COLLAPSE
          ==================================================== */}

      <button
        type="button"
        className="doctor-sidebar-collapse-button"
        onClick={onToggle}
        aria-label={
          collapsed
            ? "Expandir menú lateral"
            : "Colapsar menú lateral"
        }
        aria-expanded={!collapsed}
        title={
          collapsed
            ? "Expandir menú lateral"
            : "Colapsar menú lateral"
        }
      >
        <span aria-hidden="true">
          {collapsed ? "›" : "‹"}
        </span>
      </button>
    </aside>
  );
}
