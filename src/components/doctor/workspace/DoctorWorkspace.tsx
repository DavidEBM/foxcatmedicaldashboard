"use client";

import type {
  ClinicalAssessment,
  WorkspaceAction,
  WorkspaceInteractionMode,
  WorkspacePatient,
  WorkspaceStyle,
  WorkspaceWidgetId,
  WorkspaceWidgetLayout,
} from "@/types/doctor-workspace";

import WorkspaceCanvas from "./WorkspaceCanvas";
import PatientNotes from "@/components/doctor/notes/PatientNotes";
import {
  buildCarePlan,
  getLabsOverview,
  getRemoteMonitoringPatients,
  getScheduledPatients,
  summarizeDay,
} from "@/lib/doctor/doctor-workspace";

interface DoctorWorkspaceProps {
  action: WorkspaceAction | null;
  patient: WorkspacePatient | null;
  patients: WorkspacePatient[];
  trainingReady: boolean;
  assessment: ClinicalAssessment | null;

  getRiskScore: (
    patient: WorkspacePatient
  ) => number;
  doctorId: string | null;
  doctorName: string;
  onSelectPatient: (patientId: string) => void;

  layouts: WorkspaceWidgetLayout[];
  style: WorkspaceStyle;

  onContainerWidthChange?: (
    width: number
  ) => void;

  isInteractive?: boolean;

  mode?: WorkspaceInteractionMode;

  activeWidgetId?: WorkspaceWidgetId | null;

  isResizing?: boolean;

  isResizeArmed?: boolean;

  onConfirmResize?: () => void;

  onCancelResize?: () => void;

  onClose: () => void;

  onAction: (
    action: WorkspaceAction
  ) => void;

  onWidgetPointerDown?: (
    event: React.PointerEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  onWidgetPointerUp?: (
    event: React.PointerEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  onWidgetDoubleClick?: (
    event: React.MouseEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  onResizePointerDown?: (
    event: React.PointerEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  onWidgetContextMenu?: (
    event: React.MouseEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => void;

  onWorkspaceContextMenu?: (
    event: React.MouseEvent<HTMLElement>
  ) => void;

  renderWidget: (
    layout: WorkspaceWidgetLayout
  ) => React.ReactNode;
}

const WORKSPACE_TITLES: Record<
  WorkspaceAction,
  string
> = {
  "mark-shift": "Marcar turno",
  "daily-summary": "Resumen diario",
  "quick-history": "Historia rápida",
  "surgery-assist": "Asistencia quirúrgica",
  "calendar-view": "Calendario",
  "active-patients": "Pacientes activos",
  "remote-monitoring": "Monitoreo remoto",
  "labs-overview": "Resultados de laboratorio",
  "shift-notes": "Notas del turno",
  "visual-settings": "Configuración visual",
  "support-center": "Centro de soporte",
  "care-plan": "Plan de cuidado",
};

interface WorkspaceContentProps {
  action: WorkspaceAction;
  patient: WorkspacePatient | null;
  patients: WorkspacePatient[];
  trainingReady: boolean;
  assessment: ClinicalAssessment | null;
  getRiskScore: (patient: WorkspacePatient) => number;
  doctorId: string | null;
  doctorName: string;
  onSelectPatient: (patientId: string) => void;
  onClose: () => void;
}

function WorkspaceContent({
  action,
  patient,
  patients,
  trainingReady,
  assessment,
  getRiskScore,
  doctorId,
  doctorName,
  onSelectPatient,
  onClose,
}: WorkspaceContentProps) {
  const title = WORKSPACE_TITLES[action];
  const summary = summarizeDay(patients, patient, getRiskScore, trainingReady);
  const carePlan = buildCarePlan(patient, assessment);
  const scheduledPatients = getScheduledPatients(patients);
  const monitoredPatients = getRemoteMonitoringPatients(patients, getRiskScore);
  const laboratoryPatients = getLabsOverview(patients, getRiskScore);

  return (
    <section className="doctor-workspace-panel">
      <header className="doctor-workspace-panel-header">
        <div>
          <span className="doctor-workspace-panel-kicker">
            Herramienta clínica
          </span>

          <h2>{title}</h2>
        </div>

        <button
          type="button"
          className="doctor-workspace-panel-close"
          onClick={onClose}
          aria-label="Cerrar herramienta clínica"
        >
          ×
        </button>
      </header>

      <div className="doctor-workspace-panel-body">
        {action === "quick-history" && patient && (
          <div className="doctor-tool-detail-grid">
            <article><span>Paciente</span><strong>{patient.name}</strong></article>
            <article><span>Condición</span><strong>{patient.condition || "Sin registrar"}</strong></article>
            <article><span>Estado</span><strong>{patient.status || "Sin registrar"}</strong></article>
            <article><span>Servicio</span><strong>{patient.ward || "Sin registrar"}</strong></article>
            <article className="is-wide"><span>Notas clínicas</span><p>{patient.notes || "No hay notas clínicas registradas."}</p></article>
          </div>
        )}

        {action === "shift-notes" && (
          patient
            ? doctorId
              ? <PatientNotes patientId={patient.id} doctorId={doctorId} doctorName={doctorName} />
              : <p>Inicia sesión como médico para consultar y guardar notas.</p>
            : <p>Selecciona un paciente para consultar sus notas.</p>
        )}

        {action === "active-patients" && (
          <div className="doctor-tool-record-list">
            {patients.map((item) => <button className="doctor-tool-record-button" type="button" key={item.id} onClick={() => onSelectPatient(item.id)}><strong>{item.name}</strong><span>{item.condition || "Condición sin registrar"} · {item.status || "Sin estado"}</span><small>Abrir paciente en el dashboard</small></button>)}
            {!patients.length && <p>No tienes pacientes asignados actualmente.</p>}
          </div>
        )}

        {action === "remote-monitoring" && (
          <div className="doctor-tool-record-list">
            {monitoredPatients.map((item) => <button className="doctor-tool-record-button" type="button" key={item.id} onClick={() => onSelectPatient(item.id)}><strong>{item.name}</strong><span>Riesgo local {getRiskScore(item)} · SpO₂ {item.oxygenSaturation ?? "—"}% · FR {item.respiratoryRate ?? "—"} rpm</span><small>Abrir seguimiento del paciente</small></button>)}
            {!monitoredPatients.length && <p>No hay pacientes que superen el umbral local de monitoreo.</p>}
          </div>
        )}

        {action === "labs-overview" && (
          <div className="doctor-tool-record-list">
            {laboratoryPatients.map((item) => <button className="doctor-tool-record-button" type="button" key={item.id} onClick={() => onSelectPatient(item.id)}><strong>{item.name}</strong><span>Glucosa {item.glucose ?? "—"} mg/dL · Creatinina {item.creatinine ?? "—"} mg/dL · BNP {item.bnp ?? "—"}</span><small>Abrir ficha clínica</small></button>)}
            {!laboratoryPatients.length && <p>No hay resultados clínicos registrados.</p>}
          </div>
        )}

        {action === "calendar-view" && (
          <div className="doctor-tool-record-list">
            {scheduledPatients.map((item) => <button className="doctor-tool-record-button" type="button" key={item.id} onClick={() => onSelectPatient(item.id)}><strong>{item.name}</strong><span>Consulta {item.appointmentTime || "—"} · Monitoreo {item.monitoringTime || "—"} · Laboratorio {item.labTime || "—"}</span><small>Abrir paciente en el dashboard</small></button>)}
            {!scheduledPatients.length && <p>No hay horarios registrados.</p>}
          </div>
        )}

        {action === "daily-summary" && (
          <div className="doctor-tool-detail-grid">
            <article><span>Pacientes asignados</span><strong>{summary.activePatients}</strong></article>
            <article><span>Prioridad alta</span><strong>{summary.highPriority}</strong></article>
            <article className="is-wide"><span>Paciente activo</span><strong>{summary.currentPatient}</strong></article>
            <article className="is-wide"><span>Modelo</span><strong>{summary.trainingStatus}</strong></article>
          </div>
        )}

        {action === "care-plan" && (
          carePlan
            ? <div className="doctor-tool-detail-grid"><article className="is-wide"><span>Paciente</span><strong>{carePlan.patientName}</strong></article><article><span>Riesgo corto plazo</span><strong>{carePlan.risks.short}%</strong></article><article><span>Riesgo semanal</span><strong>{carePlan.risks.week}%</strong></article><article><span>Riesgo largo plazo</span><strong>{carePlan.risks.long}%</strong></article><article className="is-wide"><span>Recomendaciones para revisión</span><ul>{carePlan.recommendations.map((recommendation, index) => <li key={`${index}-${recommendation}`}>{recommendation}</li>)}</ul></article><p className="doctor-tool-disclaimer">Resumen orientativo; validar decisiones con el equipo tratante.</p></div>
            : <p>Selecciona un paciente para preparar el resumen del plan de cuidado.</p>
        )}

        {!["quick-history", "shift-notes", "active-patients", "remote-monitoring", "labs-overview", "calendar-view", "daily-summary", "care-plan"].includes(action) && (
          <><p>Paciente activo: <strong>{patient?.name ?? "Ninguno"}</strong></p><p>Pacientes disponibles: <strong>{patients.length}</strong></p><p>Entrenamiento: <strong>{trainingReady ? "Disponible" : "No disponible"}</strong></p></>
        )}
      </div>
    </section>
  );
}

export default function DoctorWorkspace({
  action,
  patient,
  patients,
  trainingReady,
  assessment,
  getRiskScore,
  doctorId,
  doctorName,
  onSelectPatient,
  layouts,
  style,
  onContainerWidthChange,
  isInteractive = false,
  mode = "default",
  activeWidgetId = null,
  isResizing = false,
  isResizeArmed = false,
  onConfirmResize,
  onCancelResize,
  onClose,
  onAction,
  onWidgetPointerDown,
  onWidgetPointerUp,
  onWidgetDoubleClick,
  onResizePointerDown,
  onWidgetContextMenu,
  onWorkspaceContextMenu,
  renderWidget,
}: DoctorWorkspaceProps) {
  /*
   * Estas dependencias forman parte de la API del workspace
   * y serán utilizadas por las capas de interacción clínica.
   */
  void onAction;

  return (
    <div
      className={[
        "doctor-workspace",
        isResizing ? "is-resizing" : "",
      ].filter(Boolean).join(" ")}
      data-workspace-interactive={isInteractive ? "true" : "false"}
    >
      {action && (
        <WorkspaceContent
          action={action}
          patient={patient}
          patients={patients}
          trainingReady={trainingReady}
          assessment={assessment}
          getRiskScore={getRiskScore}
          doctorId={doctorId}
          doctorName={doctorName}
          onSelectPatient={onSelectPatient}
          onClose={onClose}
        />
      )}

      {isResizeArmed && (
        <div className="workspace-resize-toolbar" role="status">
          <span>Modo de redimensionamiento activo</span>
          <button type="button" className="workspace-resize-toolbar-cancel" onClick={onCancelResize}>
            Cancelar
          </button>
          <button type="button" className="workspace-resize-toolbar-confirm" onClick={onConfirmResize}>
            Confirmar tamaño
          </button>
        </div>
      )}

      <WorkspaceCanvas
        layouts={layouts}
        style={style}
        onContainerWidthChange={
          onContainerWidthChange
        }
        isInteractive={isInteractive}
        mode={mode}
        activeWidgetId={activeWidgetId}
        isResizing={isResizing}
        isResizeArmed={isResizeArmed}
        onWidgetPointerDown={
          onWidgetPointerDown
        }
        onWidgetPointerUp={
          onWidgetPointerUp
        }
        onWidgetDoubleClick={
          onWidgetDoubleClick
        }
        onResizePointerDown={
          onResizePointerDown
        }
        onWidgetContextMenu={
          onWidgetContextMenu
        }
        onWorkspaceContextMenu={
          onWorkspaceContextMenu
        }
        renderWidget={renderWidget}
      />

      {/*
        Cursor personalizado eliminado: se conserva el archivo por compatibilidad,
        pero el workspace usa el cursor nativo durante el resize.
        // El cursor custom solo debe aparecer mientras existe un arrastre
        // real. Al quedar armado el resize, la última posición del mouse
        // puede estar fuera del widget y producir una esquina morada suelta.
      />
      */}
    </div>
  );
}

