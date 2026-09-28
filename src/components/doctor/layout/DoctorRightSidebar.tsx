"use client";

import type { WorkspacePatient } from "@/types/doctor-workspace";

interface DoctorRightSidebarProps {
  collapsed?: boolean;
  patient?: WorkspacePatient | null;
  riskScore?: number;
  onToggle?: () => void;
  onAction?: (action: string) => void;
}

export default function DoctorRightSidebar({
  collapsed = false,
  patient = null,
  riskScore = 0,
  onToggle,
  onAction,
}: DoctorRightSidebarProps) {
  const handleAction = (action: string) => {
    onAction?.(action);
  };

  const alerts = patient
    ? [
        ...(patient.status === "Critico"
          ? [{ title: "Estado crítico", detail: "Requiere valoración prioritaria", tone: "danger" }]
          : []),
        ...(typeof patient.oxygenSaturation === "number" && patient.oxygenSaturation < 92
          ? [{ title: "Saturación baja", detail: `${patient.oxygenSaturation}% de oxígeno`, tone: "danger" }]
          : []),
        ...(typeof patient.respiratoryRate === "number" && patient.respiratoryRate >= 22
          ? [{ title: "Frecuencia respiratoria elevada", detail: `${patient.respiratoryRate} rpm`, tone: "warning" }]
          : []),
        ...(riskScore >= 4
          ? [{ title: "Riesgo clínico elevado", detail: `${riskScore} puntos de riesgo base`, tone: "warning" }]
          : []),
      ]
    : [];

  const activities = patient
    ? [
        { label: "Cita", time: patient.appointmentTime },
        { label: "Monitoreo", time: patient.monitoringTime },
        { label: "Laboratorio", time: patient.labTime },
      ].filter((activity): activity is { label: string; time: string } => Boolean(activity.time))
    : [];

  return (
    <aside
      className={`doctor-right-sidebar ${
        collapsed ? "is-collapsed" : ""
      }`}
      aria-label="Panel clínico contextual"
    >
      {/* ==================================================
          TOGGLE
          ================================================== */}

      <button
        type="button"
        className="doctor-right-sidebar-toggle"
        onClick={onToggle}
        aria-label={
          collapsed
            ? "Mostrar panel derecho"
            : "Ocultar panel derecho"
        }
        aria-expanded={!collapsed}
        title={
          collapsed
            ? "Mostrar panel clínico"
            : "Ocultar panel clínico"
        }
      >
        <span aria-hidden="true">
          {collapsed ? "‹" : "›"}
        </span>
      </button>

      {/* ==================================================
          CONTENIDO
          ================================================== */}

      <div className="doctor-right-sidebar-content">
        <div className="doctor-right-sidebar-header">
          <div>
            <span className="doctor-right-sidebar-eyebrow">
              Panel contextual
            </span>

            <h2>Información clínica</h2>
          </div>

          <button
            type="button"
            className="doctor-right-sidebar-more"
            onClick={() => handleAction("context-menu")}
            aria-label="Más opciones"
            title="Más opciones"
          >
            ⋮
          </button>
        </div>

        <div className="doctor-right-sidebar-scroll">
          {/* ==================================================
              PACIENTE
              ================================================== */}

          <section className="doctor-context-card doctor-context-patient">
            <div className="doctor-context-card-heading">
              <span className="doctor-context-icon purple">
                +
              </span>

              <div>
                <span>Paciente seleccionado</span>

                <strong>
                  {patient?.name ?? "Ningún paciente"}
                </strong>
              </div>
            </div>

            {patient ? (
              <div className="doctor-context-patient-data">
                <div>
                  <span>Condición</span>

                  <strong>
                    {patient.condition ?? "Sin registrar"}
                  </strong>
                </div>

                <div>
                  <span>Estado</span>

                  <strong>
                    {patient.status ?? "Sin registrar"}
                  </strong>
                </div>

                <div>
                  <span>Ubicación</span>

                  <strong>
                    {patient.ward ??
                      patient.locationCity ??
                      "—"}
                  </strong>
                </div>
              </div>
            ) : (
              <p className="doctor-context-empty">
                Selecciona un paciente para visualizar
                información clínica contextual.
              </p>
            )}
          </section>

          {/* ==================================================
              ALERTAS
              ================================================== */}

          <section className="doctor-context-section">
            <div className="doctor-context-section-header">
              <h3>Alertas</h3>

              <span className={`doctor-context-count ${alerts.length ? "danger" : ""}`}>
                {alerts.length}
              </span>
            </div>

            <div className="doctor-alert-list">
              {alerts.length ? alerts.map((alert) => (
                <button
                  type="button"
                  className={`doctor-alert-item ${alert.tone}`}
                  key={`${alert.title}-${alert.detail}`}
                  onClick={() => handleAction("alerts")}
                >
                  <span className="doctor-alert-indicator" />
                  <span className="doctor-alert-content">
                    <strong>{alert.title}</strong>
                    <small>{alert.detail}</small>
                  </span>
                  <span className="doctor-alert-arrow" aria-hidden="true">›</span>
                </button>
              )) : (
                <p className="doctor-context-empty">
                  {patient ? "Sin alertas clínicas detectadas." : "Selecciona un paciente para ver alertas."}
                </p>
              )}
            </div>
          </section>

          {/* ==================================================
              ACTIVIDADES
              ================================================== */}

          <section className="doctor-context-section">
            <div className="doctor-context-section-header">
              <h3>Próximas actividades</h3>

              <button
                type="button"
                className="doctor-context-link"
                onClick={() => handleAction("calendar")}
              >
                Ver todas
              </button>
            </div>

            <div className="doctor-activity-list">
              {activities.length ? activities.map((activity) => (
                <div className="doctor-activity-item" key={activity.label}>
                  <span className="doctor-activity-time">{activity.time}</span>
                  <div className="doctor-activity-line">
                    <span className="doctor-activity-dot blue" />
                    <div>
                      <strong>{activity.label}</strong>
                      <small>{patient?.name}</small>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="doctor-context-empty">
                  {patient ? "No hay actividades con horario registrado." : "Selecciona un paciente para ver sus actividades."}
                </p>
              )}
            </div>
          </section>

          {/* ==================================================
              ACCIONES RÁPIDAS
              ================================================== */}

          <section className="doctor-context-section">
            <div className="doctor-context-section-header">
              <h3>Acciones rápidas</h3>
            </div>

            <div className="doctor-quick-actions">
              <button
                type="button"
                onClick={() => handleAction("history")}
              >
                <span className="doctor-quick-action-icon blue">
                  ↺
                </span>

                <span>Historial</span>
              </button>

              <button
                type="button"
                onClick={() => handleAction("labs")}
              >
                <span className="doctor-quick-action-icon green">
                  ◈
                </span>

                <span>Laboratorios</span>
              </button>

              <button
                type="button"
                onClick={() => handleAction("notes")}
              >
                <span className="doctor-quick-action-icon purple">
                  ≡
                </span>

                <span>Notas</span>
              </button>

              <button
                type="button"
                onClick={() => handleAction("care-plan")}
              >
                <span className="doctor-quick-action-icon red">
                  +
                </span>

                <span>Plan clínico</span>
              </button>
            </div>
          </section>

          {/* ==================================================
              ESTADO DEL MODELO
              ================================================== */}

          <section className="doctor-model-status">
            <div className="doctor-model-status-icon">
              ✦
            </div>

            <div>
              <span>Asistente predictivo</span>
              <strong>Disponible</strong>
            </div>

            <span className="doctor-model-status-dot" />
          </section>
        </div>
      </div>
    </aside>
  );
}

