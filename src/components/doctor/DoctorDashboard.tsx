"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import DoctorTopbar from "./layout/DoctorTopbar";
import DoctorLeftSidebar from "./layout/DoctorLeftSidebar";
import DoctorRightSidebar from "./layout/DoctorRightSidebar";
import DoctorCookieConsent from "./layout/DoctorCookieConsent";

import DoctorWorkspace from "./workspace/DoctorWorkspace";
import AppLoadingScreen from "@/components/shared/AppLoadingScreen";
import {
  DoctorAgendaWorkspace,
  DoctorPatientsWorkspace,
} from "./workspace/DoctorSidebarWorkspaces";
import WorkspaceWidgetMenu from "./workspace/WorkspaceWidgetMenu";
import WidgetContainer from "./widgets/WidgetContainer";
import AiPredictionValidation from "./ai/AiPredictionValidation";

import WorkspaceContextMenu from "./workspace/context/WorkspaceContextMenu";
import WidgetContextMenu from "./workspace/context/WidgetContextMenu";
import WorkspaceStyleEditor from "./workspace/style-editor/WorkspaceStyleEditor";

import type { DashboardWidget } from "./widgets/WidgetContainer";

import { useWorkspaceLayout } from "@/hooks/doctor/useWorkspaceLayout";
import { useWorkspacePointer } from "@/hooks/doctor/useWorkspacePointer";
import { useWorkspaceResponsive } from "@/hooks/doctor/useWorkspaceResponsive";
import { useWorkspaceNavigation } from "@/hooks/doctor/useWorkspaceNavigation";
import { useWorkspaceStyleEditor } from "@/hooks/doctor/useWorkspaceStyleEditor";
import { usePatients } from "@/hooks/doctor/usePatients";
import { auth } from "@/services/firebase/firebase-config";
import { getUserDocument } from "@/services/firebase/users";
import { logout } from "@/services/firebase/auth";
import { getWidgetSizeConfig } from "@/components/doctor/layout/widgetSizing";
import { computeClinicalAssessment } from "@/lib/doctor/clinical/assessment";
import {
  acceptCookieConsent,
  hasAcceptedCookieConsent,
  readWidgetVisibility,
  readThemePreference,
  writeWidgetVisibility,
  writeActiveSession,
  writeLastPatientId,
  writeThemePreference,
} from "@/lib/doctor/cookie-preferences";

import type {
  WorkspaceAction,
  WorkspacePatient,
  WorkspaceWidgetId,
  WorkspaceWidgetLayout,
  WorkspaceWidgetSize,
} from "@/types/doctor-workspace";
import type { ResizeDirection } from "@/hooks/doctor/useWorkspacePointer";
import type { Patient } from "@/types/doctor-patients";
import type { ClinicalAssessment as FullClinicalAssessment, TrainingProfile } from "@/types/doctor-clinical";

/* ==========================================================
   RISK
========================================================== */

export function getRiskScore(
  currentPatient: WorkspacePatient
): number {
  let score = 0;

  if (
    typeof currentPatient.oxygenSaturation === "number" &&
    currentPatient.oxygenSaturation < 92
  ) {
    score += 3;
  }

  if (
    typeof currentPatient.respiratoryRate === "number" &&
    currentPatient.respiratoryRate >= 22
  ) {
    score += 2;
  }

  if (
    typeof currentPatient.pulse === "number" &&
    currentPatient.pulse >= 100
  ) {
    score += 1;
  }

  if (
    typeof currentPatient.bloodPressureSystolic === "number" &&
    currentPatient.bloodPressureSystolic >= 140
  ) {
    score += 1;
  }

  return score;
}

/* ==========================================================
   TYPES
========================================================== */

type NavigationItem =
  | "dashboard"
  | "patients"
  | "monitoring"
  | "notes"
  | "labs"
  | "care-plan"
  | string;

type CookieConsentStatus = "pending" | "unknown" | "accepted" | "declined";

interface ContextMenuState {
  x: number;
  y: number;
}

interface WidgetContextMenuState
  extends ContextMenuState {
  widgetId: WorkspaceWidgetId;
}

/* ==========================================================
   RIGHT SIDEBAR ACTION MAP
========================================================== */

const RIGHT_SIDEBAR_ACTION_MAP: Record<
  string,
  WorkspaceAction
> = {
  labs: "labs-overview",
  notes: "shift-notes",
  "care-plan": "care-plan",
};

const PREDICTION_WIDGET_IDS = new Set([
  "ai-summary",
]);

/* ==========================================================
   INITIAL WORKSPACE LAYOUT
========================================================== */

const INITIAL_WORKSPACE_LAYOUTS_LEGACY: WorkspaceWidgetLayout[] = [
  {
    id: "patient-summary",
    visible: true,
    order: 0,
    x: 0,
    y: 0,
    width: 280,
    height: 250,
    constraints: {
      minWidth: 240,
      maxWidth: 700,
      minHeight: 180,
      maxHeight: 500,
    },
  },

  {
    id: "risk",
    visible: true,
    order: 1,
    x: 296,
    y: 0,
    width: 280,
    height: 250,
    constraints: {
      minWidth: 240,
      maxWidth: 700,
      minHeight: 180,
      maxHeight: 500,
    },
  },

  {
    id: "vitals",
    visible: true,
    order: 2,
    x: 592,
    y: 0,
    width: 280,
    height: 250,
    constraints: {
      minWidth: 240,
      maxWidth: 700,
      minHeight: 180,
      maxHeight: 500,
    },
  },

  {
    id: "assessment",
    visible: true,
    order: 3,
    x: 0,
    y: 266,
    width: 280,
    height: 250,
    constraints: {
      minWidth: 240,
      maxWidth: 700,
      minHeight: 180,
      maxHeight: 500,
    },
  },

  {
    id: "recommendations",
    visible: true,
    order: 4,
    x: 296,
    y: 266,
    width: 280,
    height: 250,
    constraints: {
      minWidth: 240,
      maxWidth: 700,
      minHeight: 180,
      maxHeight: 500,
    },
  },

  {
    id: "schedule",
    visible: true,
    order: 5,
    x: 592,
    y: 266,
    width: 280,
    height: 250,
    constraints: {
      minWidth: 240,
      maxWidth: 700,
      minHeight: 180,
      maxHeight: 500,
    },
  },

  {
    id: "ai-summary",
    visible: true,
    order: 6,
    x: 0,
    y: 532,
    width: 880,
    height: 600,
    constraints: {
      minWidth: 600,
      maxWidth: 1200,
      minHeight: 420,
      maxHeight: 1000,
    },
  },
];

const INITIAL_WORKSPACE_LAYOUTS: WorkspaceWidgetLayout[] = INITIAL_WORKSPACE_LAYOUTS_LEGACY.map((layout) => {
  const size = getWidgetSizeConfig(layout.id);
  return {
    ...layout,
    width: size.width,
    height: size.height,
    constraints: {
      minWidth: size.minWidth,
      maxWidth: size.maxWidth,
      minHeight: size.minHeight,
      maxHeight: size.maxHeight,
    },
  };
});

const FALLBACK_TRAINING_PROFILE: TrainingProfile = {
  ready: false,
  datasetPatients: 0,
  baseLocation: "Base clínica local",
  meanOxygen: 95,
  meanAge: 60,
};

/* ==========================================================
   DASHBOARD
========================================================== */

export default function DoctorDashboard() {
  const router = useRouter();
  const [cookieConsentStatus, setCookieConsentStatus] =
    useState<CookieConsentStatus>("pending");
  const cookieConsentAccepted = cookieConsentStatus === "accepted";
  /* ========================================================
     AUTHENTICATED DOCTOR AND ASSIGNED PATIENTS
  ======================================================== */

  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorAuthLoading, setDoctorAuthLoading] = useState(true);
  const [doctorAuthError, setDoctorAuthError] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState("Médico");
  const [doctorEmail, setDoctorEmail] = useState("Cuenta médica");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setDoctorAuthLoading(true);
      setDoctorId(null);

      if (!user) {
        setDoctorName("Médico");
        setDoctorEmail("Cuenta médica");
        setDoctorAuthError("Inicia sesión con una cuenta médica activa para ver tus pacientes.");
        setDoctorAuthLoading(false);
        return;
      }

      void getUserDocument(user.uid)
        .then((userDocument) => {
          if (auth.currentUser?.uid !== user.uid) return;

          if (!userDocument || userDocument.role !== "doctor" || userDocument.status !== "active") {
            setDoctorAuthError("La cuenta actual no tiene un perfil médico activo.");
            return;
          }

          setDoctorAuthError(null);
          setDoctorName(userDocument.displayName || user.displayName || "Médico");
          setDoctorEmail(user.email || "Cuenta médica");
          setDoctorId(user.uid);
        })
        .catch(() => {
          if (auth.currentUser?.uid === user.uid) {
            setDoctorAuthError("No se pudo validar la cuenta médica.");
          }
        })
        .finally(() => {
          if (auth.currentUser?.uid === user.uid) {
            setDoctorAuthLoading(false);
          }
        });
    });

    return unsubscribe;
  }, []);

  const {
    patients,
    selectedPatientId,
    setSelectedPatientId,
    reload: reloadPatients,
    loading: patientsLoading,
    error: patientsError,
  } = usePatients({
    userId: doctorId,
    role: doctorId ? "doctor" : null,
    cookieConsent: cookieConsentAccepted,
  });

  useEffect(() => {
    if (!doctorId) return;

    const timer = window.setTimeout(() => {
      setCookieConsentStatus(
        hasAcceptedCookieConsent()
          ? "accepted"
          : "unknown",
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [doctorId]);

  useEffect(() => {
    if (!doctorId) return;

    const refreshActiveSession = () => {
      const user = auth.currentUser;
      if (user?.uid === doctorId) {
        writeActiveSession(doctorId, user.email || "");
      }
    };

    refreshActiveSession();
    const interval = window.setInterval(refreshActiveSession, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [doctorId]);

  const [notice, setNotice] = useState<string | null>(null);

  /* ========================================================
     CLINICAL WORKSPACE ACTION
  ======================================================== */

  const [action, setAction] =
    useState<WorkspaceAction | null>(
      "labs-overview"
    );

  /* ========================================================
     SIDEBARS
  ======================================================== */

  const [
    leftSidebarCollapsed,
    setLeftSidebarCollapsed,
  ] = useState(true);

  const [
    rightSidebarCollapsed,
    setRightSidebarCollapsed,
  ] = useState(true);

  /* ========================================================
     THEME
  ======================================================== */

  const [darkMode, setDarkMode] =
    useState(false);

  useEffect(() => {
    if (!doctorId || !cookieConsentAccepted) return;

    const timer = window.setTimeout(() => {
      const savedTheme = readThemePreference();
      if (savedTheme) {
        setDarkMode(savedTheme === "dark");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [cookieConsentAccepted, doctorId]);

  const handleThemeToggle = useCallback(() => {
    setDarkMode((current) => {
      const next = !current;
      if (cookieConsentAccepted) {
        writeThemePreference(next ? "dark" : "light");
      }
      return next;
    });
  }, [cookieConsentAccepted]);

  const handleCookieConsentAccept = useCallback(() => {
    acceptCookieConsent();
    setCookieConsentStatus("accepted");

    if (doctorId && selectedPatientId) {
      writeLastPatientId(doctorId, selectedPatientId);
    }

    writeThemePreference(darkMode ? "dark" : "light");
  }, [darkMode, doctorId, selectedPatientId]);

  const handleCookieConsentDecline = useCallback(() => {
    setCookieConsentStatus("declined");
  }, []);

  /* ========================================================
     NAVIGATION
  ======================================================== */

  const [activeItem, setActiveItem] =
    useState<NavigationItem>(
      "dashboard"
    );

  /* ========================================================
     ML
  ======================================================== */

  const [trainingReady] =
    useState(false);

  /* ========================================================
     WORKSPACE MENU
  ======================================================== */

  const [
    workspaceMenuOpen,
    setWorkspaceMenuOpen,
  ] = useState(true);

  /* ========================================================
     WORKSPACE CONTEXT MENU
  ======================================================== */

  const [
    workspaceContextMenu,
    setWorkspaceContextMenu,
  ] =
    useState<ContextMenuState | null>(
      null
    );

  const [
    widgetContextMenu,
    setWidgetContextMenu,
  ] =
    useState<WidgetContextMenuState | null>(
      null
    );

  /* ========================================================
     PATIENT
  ======================================================== */

  const patient = useMemo(
    () =>
      patients.find(
        (item) =>
          item.id ===
          selectedPatientId
      ) ?? null,
    [
      patients,
      selectedPatientId,
    ]
  );

  /* ========================================================
     RISK
  ======================================================== */

  const riskScore = useMemo(
    () =>
      patient
        ? getRiskScore(patient)
        : 0,
    [patient]
  );

  /* ========================================================
     ASSESSMENT
  ======================================================== */

  const assessment = useMemo<FullClinicalAssessment | null>(
    () => patient
      ? computeClinicalAssessment(
          patient as unknown as Patient,
          FALLBACK_TRAINING_PROFILE,
        )
      : null,
    [patient],
  );

  /* ========================================================
     RESPONSIVE WORKSPACE
  ======================================================== */

  const {
    isInteractive,
  } =
    useWorkspaceResponsive();

  /* ========================================================
     WORKSPACE LAYOUT
  ======================================================== */

  const {
    layouts,
    style,
    toggleWidget,
    setWidgetVisibility,
    showWidget,
    hideWidget,
    moveWidgetToFirst,
    moveWidgetToLast,
    updatePosition,
    updateSize,
    updateStyle,
    setContainerWidth,
  } =
    useWorkspaceLayout({
      initialLayouts:
        INITIAL_WORKSPACE_LAYOUTS,

      initialStyle: {
        columns: 3,
        gap: 10,
        rowGap: 10,
        horizontalPadding: 0,
        verticalPadding: 0,
        widgetMinWidth: 280,
        widgetMinHeight: 180,
        widgetRadius: 16,
      },
    });

  const widgetVisibilityHydratedFor = useRef<string | null>(null);
  const skipWidgetVisibilitySave = useRef(false);

  useEffect(() => {
    if (!doctorId) {
      widgetVisibilityHydratedFor.current = null;
      return;
    }

    if (!cookieConsentAccepted || widgetVisibilityHydratedFor.current === doctorId) {
      return;
    }

    widgetVisibilityHydratedFor.current = doctorId;
    skipWidgetVisibilitySave.current = true;

    const savedVisibility = readWidgetVisibility(doctorId);
    if (savedVisibility) {
      setWidgetVisibility(savedVisibility);
    }
  }, [cookieConsentAccepted, doctorId, setWidgetVisibility]);

  useEffect(() => {
    if (
      !doctorId ||
      !cookieConsentAccepted ||
      widgetVisibilityHydratedFor.current !== doctorId
    ) {
      return;
    }

    if (skipWidgetVisibilitySave.current) {
      skipWidgetVisibilitySave.current = false;
      return;
    }

    writeWidgetVisibility(
      doctorId,
      Object.fromEntries(
        layouts.map((layout) => [layout.id, layout.visible]),
      ),
    );
  }, [cookieConsentAccepted, doctorId, layouts]);

  /* ========================================================
     REAL WORKSPACE WIDTH
  ======================================================== */

  const handleContainerWidthChange =
    useCallback(
      (width: number) => {
        setContainerWidth(
          width
        );
      },
      [setContainerWidth]
    );

  /* ========================================================
     NAVIGATION
  ======================================================== */

  const {
    workspaceRef,
    goToTop,
    goToPatient,
    goToEnd,
  } =
    useWorkspaceNavigation({
      patientWidgetId:
        "patient-summary",
    });

  /* ========================================================
     STYLE EDITOR
  ======================================================== */

  const {
    isOpen:
      styleEditorOpen,

    draft:
      styleDraft,

    openEditor:
      openStyleEditor,

    updateDraft:
      updateStyleDraft,

    confirm:
      confirmStyleEditor,

    cancel:
      cancelStyleEditor,

    resetDraft:
      resetStyleDraft,
  } =
    useWorkspaceStyleEditor({
      style,
      onConfirm:
        updateStyle,
    });

  /* ========================================================
     POINTER
  ======================================================== */

  const [resizeDraft, setResizeDraft] = useState<{
    widgetId: WorkspaceWidgetId;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const {
    mode,
    activeWidgetId,
    isResizing,
    isResizeArmed,

    handleWidgetPointerDown,
    handleWidgetPointerUp,
    handleWidgetDoubleClick,
    handleResizePointerDown,
    armResize,
    confirmResize,
    cancelResize,
  } = useWorkspacePointer({
    enabled:
      isInteractive,

    layouts,

    style,

    onResize: (
      widgetId: WorkspaceWidgetId,
      size: WorkspaceWidgetSize,
      position: { x: number; y: number },
      direction: ResizeDirection
    ) => {
      // La posición debe entrar primero para que el reflow calcule
      // colisiones usando la geometría nueva del widget.
      updatePosition(widgetId, position.x, position.y);
      updateSize(
        widgetId,
        size.width,
        size.height,
        direction
      );
    },

    onResizeArm: (widgetId) => {
      const layout = layouts.find((item) => item.id === widgetId);
      if (layout) {
        setResizeDraft({
          widgetId,
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
        });
      }
    },
  });

  const handleConfirmResize = useCallback(() => {
    setResizeDraft(null);
    confirmResize();
  }, [confirmResize]);

  const handleCancelResize = useCallback(() => {
    if (resizeDraft) {
      updateSize(resizeDraft.widgetId, resizeDraft.width, resizeDraft.height);
      updatePosition(resizeDraft.widgetId, resizeDraft.x, resizeDraft.y);
    }
    setResizeDraft(null);
    cancelResize();
  }, [cancelResize, resizeDraft, updatePosition, updateSize]);

  const handleArmResize = useCallback((widgetId: WorkspaceWidgetId) => {
    setWidgetContextMenu(null);
    armResize(widgetId);
  }, [armResize]);

  /* ========================================================
     ACTIONS
  ======================================================== */

  const handleAction = (
    nextAction: WorkspaceAction
  ) => {
    setNotice(null);
    setAction(nextAction);

    setWorkspaceContextMenu(
      null
    );

    setWidgetContextMenu(
      null
    );
  };

  const handleClose = () => {
    setAction(null);
  };

  /* ========================================================
     NAVIGATION
  ======================================================== */

  const handleNavigation = (
    item: NavigationItem
  ) => {
    if (item === "laboratory") {
      setNotice(null);
      setActiveItem("dashboard");
      setAction("labs-overview");
      setWorkspaceContextMenu(null);
      setWidgetContextMenu(null);
      return;
    }

    const unavailableSections: Record<string, string> = {
      consultations: "Consultas",
      monitoring: "Monitoreo",
      history: "Historial",
      "care-plans": "Planes de cuidado",
      tools: "Herramientas",
      reports: "Reportes",
    };

    if (item in unavailableSections) {
      setNotice(`La sección ${unavailableSections[item]} es una herramienta que se encuentra en desarrollo y aún no está disponible.`);
      return;
    }

    if (item !== "dashboard" && item !== "patients" && item !== "appointments") {
      return;
    }

    setNotice(null);
    setActiveItem(item);
    setAction(item === "dashboard" ? "labs-overview" : null);
    setWorkspaceContextMenu(null);
    setWidgetContextMenu(null);
  };

  const handleSelectAssignedPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    handleNavigation("dashboard");
  };

  const handleTopbarNavigation = (item: string) => {
    if (item === "home") {
      handleNavigation("dashboard");
      return;
    }

    if (item === "settings" || item === "preferences") {
      setNotice(null);
      openStyleEditor();
      return;
    }

    if (item === "logout") {
      void logout()
        .then(() => router.replace("/"))
        .catch(() => setNotice("No se pudo cerrar la sesión. Inténtalo de nuevo."));
      return;
    }

    const labels: Record<string, string> = {
      notifications: "Notificaciones",
      help: "Ayuda",
      profile: "Mi perfil",
      security: "Seguridad",
    };

    const label = labels[item];
    if (label) {
      setNotice(`La opción ${label} es una herramienta que se encuentra en desarrollo y aún no está disponible.`);
    }
  };

  /* ========================================================
     QUICK ACTIONS
  ======================================================== */

  const quickActions: Array<{
    id: WorkspaceAction;
    label: string;
    icon: string;
  }> = [
    {
      id: "quick-history",
      label: "Historial rápido",
      icon: "◷",
    },

    {
      id: "active-patients",
      label: "Pacientes activos",
      icon: "👥",
    },

    {
      id: "remote-monitoring",
      label: "Monitoreo remoto",
      icon: "⌁",
    },

    {
      id: "labs-overview",
      label: "Laboratorios",
      icon: "▣",
    },

    {
      id: "care-plan",
      label: "Plan sugerido",
      icon: "✓",
    },

    {
      id: "shift-notes",
      label: "Notas del turno",
      icon: "✎",
    },
  ];

  /* ========================================================
     DASHBOARD WIDGETS
  ======================================================== */

  const widgets =
    useMemo<DashboardWidget[]>(
      () => {
        if (!patient) {
          return [];
        }

        return [
          {
            id: "patient-summary",
            title:
              "Paciente seleccionado",
            subtitle:
              "Información clínica básica",
            icon: "👤",
            accent: "purple",

            content: (
              <div className="doctor-widget-list">
                <div className="doctor-widget-list-item">
                  <div>
                    <strong>
                      {patient.name}
                    </strong>

                    <span>
                      {patient.condition ??
                        "Sin condición registrada"}
                    </span>
                  </div>
                </div>

                <div className="doctor-widget-list-item">
                  <div>
                    <strong>
                      Estado
                    </strong>

                    <span>
                      {patient.status ??
                        "Sin estado"}
                    </span>
                  </div>
                </div>

                <div className="doctor-widget-list-item">
                  <div>
                    <strong>
                      Ubicación
                    </strong>

                    <span>
                      {patient.ward ??
                        "Sin servicio registrado"}

                      {" · "}

                      {patient.locationCity ??
                        "Sin ciudad"}
                    </span>
                  </div>
                </div>
              </div>
            ),

            defaultVisible:
              true,
          },

          {
            id: "risk",
            title:
              "Riesgo clínico",
            subtitle:
              "Indicador provisional",
            icon: "◉",

            accent:
              riskScore >= 4
                ? "red"
                : riskScore >= 2
                  ? "purple"
                  : "green",

            content: (
              <div>
                <div className="doctor-widget-metric">
                  <div>
                    <div className="doctor-widget-metric-label">
                      Riesgo base
                    </div>

                    <div className="doctor-widget-metric-value">
                      {riskScore}

                      <span className="doctor-widget-metric-unit">
                        puntos
                      </span>
                    </div>
                  </div>

                  <span
                    className={
                      riskScore >= 4
                        ? "doctor-widget-status red"
                        : riskScore >= 2
                          ? "doctor-widget-status purple"
                          : "doctor-widget-status green"
                    }
                  >
                    {riskScore >= 4
                      ? "Atención"
                      : riskScore >= 2
                        ? "Vigilancia"
                        : "Estable"}
                  </span>
                </div>

                <div className="doctor-widget-progress">
                  <div
                    className="doctor-widget-progress-bar"
                    style={{
                      width: `${Math.min(
                        100,
                        riskScore * 14
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ),

            defaultVisible:
              true,
          },

          {
            id: "vitals",
            title:
              "Signos vitales",
            subtitle:
              "Datos clínicos de la consulta",
            icon: "♥",
            accent: "red",

            content: (
              <div className="doctor-clinical-data-grid">
                {[
                  ["Diagnóstico", patient.condition],
                  ["Estado clínico", patient.status],
                  ["Presión arterial", `${patient.bloodPressureSystolic ?? "--"}/${patient.bloodPressureDiastolic ?? "--"} mmHg`],
                  ["Frecuencia cardíaca", `${patient.pulse ?? "--"} bpm`],
                  ["Saturación O₂", `${patient.oxygenSaturation ?? "--"}%`],
                  ["Frecuencia respiratoria", `${patient.respiratoryRate ?? "--"} rpm`],
                  ["Glucosa", `${patient.glucose ?? "--"} mg/dL`],
                  ["Hemoglobina", `${patient.hemoglobin ?? "--"} g/dL`],
                  ["Creatinina", `${patient.creatinine ?? "--"} mg/dL`],
                  ["IMC", `${patient.bmi ?? "--"} kg/m²`],
                  ["ECG", patient.ecg],
                  ["BNP", `${patient.bnp ?? "--"} pg/mL`],
                  ["EPOC / GOLD", patient.copdGold ? `GOLD ${patient.copdGold}` : "No registrado"],
                  ["Tabaquismo", patient.smokingStatus],
                  ["Carga tabáquica", patient.packHistory !== undefined ? `${patient.packHistory} paquetes-año` : "No registrada"],
                  ["Falla cardíaca", patient.heartFailureHistory],
                  ["Antecedente coronario", patient.coronaryHistory],
                  ["Arritmias", patient.arrhythmias],
                  ["Notas clínicas", patient.notes],
                ].map(([label, value]) => (
                  <div className="doctor-clinical-data-card" key={label}>
                    <strong>{label}</strong>
                    <span>{value || "No registrado"}</span>
                  </div>
                ))}
              </div>
            ),

            defaultVisible:
              true,
          },

          {
            id: "assessment",
            title:
              "Evaluación clínica",
            subtitle:
              "Horizontes de riesgo",
            icon: "▣",
            accent: "blue",

            content: assessment ? (
              <div className="doctor-widget-list">
                <div className="doctor-widget-list-item">
                  <div>
                    <strong>
                      Corto plazo
                    </strong>

                    <span>
                      {assessment.shortRisk}%
                    </span>
                  </div>
                </div>

                <div className="doctor-widget-list-item">
                  <div>
                    <strong>
                      Próxima semana
                    </strong>

                    <span>
                      {assessment.weekRisk}%
                    </span>
                  </div>
                </div>

                <div className="doctor-widget-list-item">
                  <div>
                    <strong>
                      Largo plazo
                    </strong>

                    <span>
                      {assessment.longRisk}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="doctor-widget-empty">
                Sin evaluación disponible.
              </div>
            ),

            defaultVisible:
              true,
          },

          {
            id: "recommendations",
            title:
              "Recomendaciones",
            subtitle:
              "Orientación clínica provisional",
            icon: "✓",
            accent: "green",

            content: assessment ? (
              <div className="doctor-widget-list">
                {assessment.recommendations.map(
                  (
                    recommendation,
                    index
                  ) => (
                    <div
                      key={`${recommendation}-${index}`}
                      className="doctor-widget-list-item"
                    >
                      <div>
                        <strong>
                          Recomendación{" "}
                          {index + 1}
                        </strong>

                        <span>
                          {recommendation}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="doctor-widget-empty">
                Sin recomendaciones.
              </div>
            ),

            defaultVisible:
              true,
          },

          {
            id: "schedule",
            title:
              "Agenda del paciente",
            subtitle:
              "Actividades registradas",
            icon: "◷",
            accent: "blue",

            content: (
              <div className="doctor-widget-list">
                <div className="doctor-widget-list-item">
                  <div>
                    <strong>
                      Consulta
                    </strong>

                    <span>
                      {patient.appointmentTime ??
                        "Sin horario"}
                    </span>
                  </div>
                </div>

                <div className="doctor-widget-list-item">
                  <div>
                    <strong>
                      Monitoreo
                    </strong>

                    <span>
                      {patient.monitoringTime ??
                        "Sin horario"}
                    </span>
                  </div>
                </div>

                <div className="doctor-widget-list-item">
                  <div>
                    <strong>
                      Laboratorio
                    </strong>

                    <span>
                      {patient.labTime ??
                        "Sin horario"}
                    </span>
                  </div>
                </div>
              </div>
            ),

            defaultVisible:
              true,
          },

          {
            id: "ai-summary",
            title: "Predicciones IA",
            subtitle: "Modelos y valoración clínica del paciente",
            icon: "✦",
            accent: "purple",
            content: (
              <AiPredictionValidation
                patient={patient as unknown as Patient}
                assessment={assessment}
                doctorUid={doctorId}
                trainingProfile={FALLBACK_TRAINING_PROFILE}
              />
            ),
            defaultVisible: true,
          },
        ];
      },
      [
        patient,
        riskScore,
        assessment,
        doctorId,
      ]
    );

  /* ========================================================
     WIDGET MENU
  ======================================================== */

  const workspaceMenuWidgets =
    useMemo(
      () =>
        widgets.map(
          (widget) => ({
            id: widget.id,

            title:
              widget.title,

            shortTitle:
              widget.title.length >
              16
                ? `${widget.title.slice(
                    0,
                    16
                  )}…`
                : widget.title,

            icon:
              widget.icon ?? "□",
          })
        ),
      [widgets]
    );

  const clinicalLayouts = useMemo(
    () => layouts.filter((layout) => !PREDICTION_WIDGET_IDS.has(layout.id)),
    [layouts],
  );

  const visiblePredictionWidgets = useMemo(
    () => widgets.filter((widget) =>
      PREDICTION_WIDGET_IDS.has(widget.id) &&
      layouts.some((layout) => layout.id === widget.id && layout.visible),
    ),
    [layouts, widgets],
  );

  const handleToggleWidget = (
    widgetId: string
  ) => {
    const widget = layouts.find((layout) => layout.id === widgetId);
    const visibleCount = layouts.filter((layout) => layout.visible).length;

    if (widget?.visible && visibleCount <= 1) {
      setNotice("Debe permanecer visible al menos un widget en el dashboard.");
      return;
    }

    setNotice(null);
    toggleWidget(widgetId);
  };

  const handleQuickAction = (actionId: WorkspaceAction, label: string) => {
    const descriptions: Partial<Record<WorkspaceAction, string>> = {
      "quick-history": "El historial clínico completo",
      "active-patients": "La vista detallada de pacientes activos",
      "remote-monitoring": "El monitoreo avanzado de pacientes",
      "labs-overview": "La gestión de resultados de laboratorio",
      "care-plan": "La gestión de planes de cuidado",
      "shift-notes": "El módulo de notas clínicas",
    };

    setNotice(`${descriptions[actionId] ?? label} se encuentra en desarrollo y aún no está disponible.`);
  };

  /* ========================================================
     RENDER WIDGET
  ======================================================== */

  const renderWidget = (
    layout: WorkspaceWidgetLayout,
    resizeState?: {
      isArmed: boolean;
      isResizing: boolean;
      onResizePointerDown?: (
        event: React.PointerEvent<HTMLElement>,
        widgetId: WorkspaceWidgetId,
        direction: ResizeDirection
      ) => void;
    }
  ) => {
    const widget =
      widgets.find(
        (item) =>
          item.id === layout.id
      );

    if (!widget) {
      return null;
    }

    return (
      <WidgetContainer
        widgets={[widget]}
        resizeState={resizeState}
      />
    );
  };

  /* ========================================================
     RIGHT SIDEBAR
  ======================================================== */

  const handleRightSidebarAction = (
    nextAction: string
  ) => {
    if (nextAction === "calendar") {
      handleNavigation("appointments");
      return;
    }

    if (nextAction === "context-menu") {
      setNotice("Las opciones adicionales del panel clínico se encuentran en desarrollo.");
      return;
    }

    if (nextAction === "alerts") {
      setNotice("La gestión detallada de alertas clínicas se encuentra en desarrollo.");
      return;
    }

    const mappedAction =
      RIGHT_SIDEBAR_ACTION_MAP[
        nextAction
      ];

    if (!mappedAction) {
      setNotice("Esta acción del panel clínico aún no está disponible.");
      return;
    }

    handleAction(
      mappedAction
    );
  };

  /* ========================================================
     WORKSPACE CONTEXT MENU
  ======================================================== */

  const handleWorkspaceContextMenu = (
    event: React.MouseEvent<HTMLElement>
  ) => {
    if (!isInteractive) {
      return;
    }

    setWidgetContextMenu(
      null
    );

    setWorkspaceContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  };

  /* ========================================================
     WIDGET CONTEXT MENU
  ======================================================== */

  const handleWidgetContextMenu = (
    event: React.MouseEvent<HTMLElement>,
    widgetId: WorkspaceWidgetId
  ) => {
    if (!isInteractive) {
      return;
    }

    setWorkspaceContextMenu(
      null
    );

    setWidgetContextMenu({
      x: event.clientX,
      y: event.clientY,
      widgetId,
    });
  };

  /* ========================================================
     WIDGET CONTEXT ACTIONS
  ======================================================== */

  const handleHideWidget = (
    widgetId: WorkspaceWidgetId
  ) => {
    const visibleCount = layouts.filter((layout) => layout.visible).length;
    const target = layouts.find((layout) => layout.id === widgetId);

    if (target?.visible && visibleCount <= 1) {
      setNotice("Debe permanecer visible al menos un widget en el dashboard.");
      setWidgetContextMenu(null);
      return;
    }

    hideWidget(widgetId);

    setWidgetContextMenu(
      null
    );
  };

  const handleMoveWidgetToFirst = (
    widgetId: WorkspaceWidgetId
  ) => {
    moveWidgetToFirst(
      widgetId
    );

    setWidgetContextMenu(
      null
    );
  };

  const handleMoveWidgetToLast = (
    widgetId: WorkspaceWidgetId
  ) => {
    moveWidgetToLast(
      widgetId
    );

    setWidgetContextMenu(
      null
    );
  };

  /* ========================================================
     WORKSPACE CONTEXT ACTIONS
  ======================================================== */

  const handleChangeWorkspaceStyles =
    () => {
      setWorkspaceContextMenu(
        null
      );

      openStyleEditor();
    };

  const handleGoToTop = () => {
    setWorkspaceContextMenu(
      null
    );

    goToTop();
  };

  const handleGoToPatient = () => {
    setWorkspaceContextMenu(
      null
    );

    const patientWidget = layouts.find((layout) => layout.id === "patient-summary");

    if (patientWidget && !patientWidget.visible) {
      showWidget("patient-summary");
      window.requestAnimationFrame(goToPatient);
      return;
    }

    goToPatient();
  };

  const handleGoToEnd = () => {
    setWorkspaceContextMenu(
      null
    );

    goToEnd();
  };

  /* ========================================================
     DASHBOARD CLASS
  ======================================================== */

  const dashboardClassName = [
    "doctor-dashboard",

    darkMode
      ? "is-dark"
      : "",

    leftSidebarCollapsed
      ? "left-sidebar-collapsed"
      : "",

    rightSidebarCollapsed
      ? "right-sidebar-collapsed"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (doctorAuthLoading || (doctorId !== null && patientsLoading)) {
    return (
      <AppLoadingScreen
        message={doctorAuthLoading
          ? "Validando tu sesión médica…"
          : "Cargando tus pacientes asignados…"}
      />
    );
  }

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <main
      className={
        dashboardClassName
      }
    >
      <div className="doctor-dashboard-shell">

        {/* ==================================================
            LEFT SIDEBAR
        ================================================== */}

        <DoctorLeftSidebar
          collapsed={
            leftSidebarCollapsed
          }

          activeItem={
            activeItem
          }

          patientsCount={
            patients.length
          }

          onNavigate={
            handleNavigation
          }

          onToggle={() =>
            setLeftSidebarCollapsed(
              (value) =>
                !value
            )
          }
        />

        {/* ==================================================
            CENTRAL CONTENT
        ================================================== */}

        <div className="doctor-dashboard-content">

          {/* =================================================
              TOPBAR
          ================================================= */}

          <DoctorTopbar
            title={
              activeItem === "patients"
                ? "Pacientes a mi cargo"
                : activeItem === "appointments"
                  ? "Agenda médica"
                  : "Dashboard clínico"
            }

            onThemeToggle={handleThemeToggle}

            darkMode={
              darkMode
            }

            userName={doctorName}

            userEmail={doctorEmail}

            workspaceMenuEnabled={activeItem === "dashboard" && Boolean(patient)}

            onNavigate={handleTopbarNavigation}

            workspaceMenuOpen={
              workspaceMenuOpen
            }

            onWorkspaceMenuToggle={() =>
              setWorkspaceMenuOpen(
                (value) =>
                  !value
              )
            }
          />

          {/* =================================================
              MAIN
          ================================================= */}

          <section
            ref={workspaceRef}
            className="doctor-dashboard-main"
          >

            {activeItem === "dashboard" && (
              <aside
                className="doctor-research-alert"
                role="alert"
                aria-label="Aviso de privacidad y datos clínicos"
              >
                <span className="doctor-research-alert-icon" aria-hidden="true">
                  !
                </span>

                <div>
                  <strong>Aviso de investigación y privacidad</strong>
                  <p>
                    Todos los pacientes expuestos en este sistema son de datasets públicos anonimizados
                    (sin identificación por protección a su privacidad), es por eso que algunos pacientes
                    pueden tener datos clínicos faltantes. Favor tener en cuenta esto a la hora de hacer
                    la validación y gracias por ayudar en esta investigación.
                  </p>
                </div>
              </aside>
            )}

            {activeItem === "patients" ? (
              <DoctorPatientsWorkspace
                patients={patients}
                doctorUid={doctorId}
                selectedPatientId={selectedPatientId}
                loading={doctorAuthLoading || patientsLoading}
                error={doctorAuthError ?? patientsError}
                onSelectPatient={handleSelectAssignedPatient}
                onRefresh={() => reloadPatients()}
              />
            ) : activeItem === "appointments" ? (
              <DoctorAgendaWorkspace patients={patients} />
            ) : (
              <>

            {/* ===============================================
                PAGE HEADER
            =============================================== */}

            <header className="doctor-patient-header">
              <div>
                <span className="doctor-dashboard-eyebrow">
                  Resumen del paciente
                </span>

                <h2>
                  {patient
                    ? patient.name
                    : "Dashboard clínico"}
                </h2>

                <p>
                  {patient
                    ? `${patient.condition ?? "Sin condición registrada"} · ${patient.status ?? "Sin estado"}`
                    : "Seleccione un paciente para comenzar."}
                </p>

                {patient && (
                  <div className="doctor-patient-key-data">
                    <span>{patient.documentId ? `ID ${patient.documentId}` : "ID sin registrar"}</span>
                    <span>{patient.age ? `${patient.age} años` : "Edad sin registrar"}</span>
                    <span>{patient.ward || "Servicio sin registrar"}</span>
                    <span>{patient.locationCity || "Ubicación sin registrar"}</span>
                  </div>
                )}
              </div>

              {patient && (
                <div className="doctor-risk-summary">
                  <span>
                    Riesgo estimado · 24 h
                  </span>

                  <strong>
                    {assessment?.shortRisk ?? 0}%
                  </strong>
                  <small>Riesgo base: {riskScore} puntos</small>
                </div>
              )}
            </header>

            {/* ===============================================
                MINI TOPBAR: WIDGET VISIBILITY
            =============================================== */}

            {patient && workspaceMenuOpen && (
              <WorkspaceWidgetMenu
                widgets={workspaceMenuWidgets}
                layouts={layouts.map((layout) => ({
                  id: layout.id,
                  visible: layout.visible,
                }))}
                onToggleWidget={handleToggleWidget}
                onRequestClose={() => setWorkspaceMenuOpen(false)}
              />
            )}

            {/* ===============================================
                WORKSPACE
            =============================================== */}

            <section className="doctor-clinical-widgets-section" aria-labelledby="doctor-clinical-widgets-heading">
              {patient && (
                <header className="doctor-clinical-widgets-heading">
                  <div>
                    <span className="doctor-dashboard-eyebrow">Información del caso</span>
                    <h2 id="doctor-clinical-widgets-heading">Widgets clínicos</h2>
                    <p>Datos del paciente y evaluación clínica actual.</p>
                  </div>
                </header>
              )}
            {patient ? (
              <DoctorWorkspace
                action={
                  action
                }

                patient={
                  patient
                }

                patients={
                  patients
                }

                trainingReady={
                  trainingReady
                }

                assessment={
                  assessment
                }

                getRiskScore={
                  getRiskScore
                }

                doctorId={doctorId}

                doctorName={doctorName}

                onSelectPatient={handleSelectAssignedPatient}

                layouts={
                  clinicalLayouts
                }

                style={
                  style
                }

                onContainerWidthChange={
                  handleContainerWidthChange
                }

                isInteractive={
                  isInteractive
                }

                mode={
                  mode
                }

                activeWidgetId={
                  activeWidgetId
                }

                isResizing={
                  isResizing
                }

                isResizeArmed={
                  isResizeArmed
                }

                onConfirmResize={
                  handleConfirmResize
                }

                onCancelResize={
                  handleCancelResize
                }

                onClose={
                  handleClose
                }

                onAction={
                  handleAction
                }

                onWidgetPointerDown={
                  handleWidgetPointerDown
                }

                onWidgetPointerUp={
                  handleWidgetPointerUp
                }

                onWidgetDoubleClick={
                  handleWidgetDoubleClick
                }

                onResizePointerDown={
                  handleResizePointerDown
                }

                onWidgetContextMenu={
                  handleWidgetContextMenu
                }

                onWorkspaceContextMenu={
                  handleWorkspaceContextMenu
                }

                renderWidget={
                  renderWidget
                }
              />
            ) : (
              <section className="doctor-empty-state">
                <h2>
                  {doctorAuthLoading || patientsLoading
                    ? "Cargando pacientes asignados"
                    : "No hay pacientes seleccionados"}
                </h2>

                <p>
                  {doctorAuthError ?? patientsError ??
                    "No hay pacientes asignados a esta cuenta médica."}
                </p>
              </section>
            )}
            </section>

            {patient && (
              <section
                className="doctor-prediction-section"
                aria-labelledby="doctor-predictions-heading"
              >
                <header className="doctor-prediction-section-header">
                  <div>
                    <span className="doctor-dashboard-eyebrow">Apoyo a la decisión clínica</span>
                    <h2 id="doctor-predictions-heading">Predicciones IA</h2>
                    <p>Estimaciones asociadas al paciente seleccionado. Requieren revisión del médico.</p>
                  </div>
                  <span className="doctor-prediction-patient">{patient.name}</span>
                </header>
                {visiblePredictionWidgets.length > 0 ? (
                  <WidgetContainer widgets={visiblePredictionWidgets} />
                ) : (
                  <p className="doctor-prediction-empty">Todos los widgets de predicción están ocultos. Puedes mostrarlos desde el menú de widgets.</p>
                )}
              </section>
            )}

            {/* ===============================================
                QUICK ACTIONS
            =============================================== */}

            {patient && (
              <section
                className="doctor-action-grid"
                aria-label="Acciones clínicas"
              >
                {quickActions.map(
                  ({
                    id,
                    label,
                    icon,
                  }) => (
                    <button
                      key={id}
                      type="button"
                      className="doctor-action-button"
                      onClick={() =>
                        handleQuickAction(id, label)
                      }
                    >
                      <span
                        className="doctor-action-icon"
                        aria-hidden="true"
                      >
                        {icon}
                      </span>

                      <span>
                        {label}
                      </span>
                      <small>En desarrollo</small>
                    </button>
                  )
                )}
              </section>
            )}

              </>
            )}

            {notice && (
              <div className="doctor-development-notice" role="status">
                <span aria-hidden="true">ℹ</span>
                <p>{notice}</p>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  aria-label="Cerrar aviso"
                >
                  ×
                </button>
              </div>
            )}

          </section>
        </div>

        {/* ==================================================
            RIGHT SIDEBAR
        ================================================== */}

        <DoctorRightSidebar
          collapsed={
            rightSidebarCollapsed
          }

          patient={
            patient
          }

          riskScore={riskScore}

          onToggle={() =>
            setRightSidebarCollapsed(
              (value) =>
                !value
            )
          }

          onAction={
            handleRightSidebarAction
          }
        />

        {/* ==================================================
            WORKSPACE CONTEXT MENU
        ================================================== */}

        {workspaceContextMenu && (
          <WorkspaceContextMenu
            x={
              workspaceContextMenu.x
            }

            y={
              workspaceContextMenu.y
            }

            onChangeStyles={
              handleChangeWorkspaceStyles
            }

            onGoToTop={
              handleGoToTop
            }

            onGoToPatient={
              handleGoToPatient
            }

            onGoToEnd={
              handleGoToEnd
            }

            onClose={() =>
              setWorkspaceContextMenu(
                null
              )
            }
          />
        )}

        {/* ==================================================
            WIDGET CONTEXT MENU
        ================================================== */}

        {widgetContextMenu && (
          <WidgetContextMenu
            widgetId={
              widgetContextMenu.widgetId
            }

            x={
              widgetContextMenu.x
            }

            y={
              widgetContextMenu.y
            }

            onHide={
              handleHideWidget
            }

            onMoveToFirst={
              handleMoveWidgetToFirst
            }

            onMoveToLast={
              handleMoveWidgetToLast
            }

            onResize={
              handleArmResize
            }

            onClose={() =>
              setWidgetContextMenu(
                null
              )
            }
          />
        )}

        {/* ==================================================
            STYLE EDITOR
        ================================================== */}

        <WorkspaceStyleEditor
          isOpen={
            styleEditorOpen
          }

          draft={
            styleDraft.draft
          }

          onChange={
            updateStyleDraft
          }

          onConfirm={
            confirmStyleEditor
          }

          onCancel={
            cancelStyleEditor
          }

          onReset={
            resetStyleDraft
          }
        />

        {doctorId && cookieConsentStatus === "unknown" && (
          <DoctorCookieConsent
            onAccept={handleCookieConsentAccept}
            onDecline={handleCookieConsentDecline}
          />
        )}

      </div>
    </main>
  );
}
