export type WorkspaceAction =
  | "mark-shift"
  | "daily-summary"
  | "quick-history"
  | "surgery-assist"
  | "calendar-view"
  | "active-patients"
  | "remote-monitoring"
  | "labs-overview"
  | "shift-notes"
  | "visual-settings"
  | "support-center"
  | "care-plan";

export interface WorkspaceState {
  action: WorkspaceAction | null;
  visible: boolean;
}

export interface WorkspacePatient {
  id: string;
  name: string;
  condition?: string;
  status?: string;
  notes?: string;

  appointmentTime?: string;
  monitoringTime?: string;
  labTime?: string;

  documentId?: string;
  age?: number;

  locationCity?: string;
  ward?: string;

  glucose?: number;
  creatinine?: number;
  bnp?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;

  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  pulse?: number;
}

export interface ClinicalAssessment {
  recommendations: string[];
  shortRisk: number;
  weekRisk: number;
  longRisk: number;
}

/* =========================================================
   WORKSPACE WIDGETS
   ========================================================= */

export type WorkspaceWidgetId =
  | "patient-summary"
  | "risk"
  | "vitals"
  | "assessment"
  | "recommendations"
  | "schedule"
  | string;

export interface WorkspaceWidgetSize {
  width: number;
  height: number;
}

export interface WorkspaceWidgetConstraints {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export interface WorkspaceWidgetLayout {
  id: WorkspaceWidgetId;

  visible: boolean;

  order: number;

  x: number;
  y: number;

  width: number;
  height: number;

  constraints?: WorkspaceWidgetConstraints;
}

/* =========================================================
   WORKSPACE GLOBAL STYLE
   ========================================================= */

export interface WorkspaceStyle {
  columns: number;

  gap: number;

  rowGap: number;

  horizontalPadding: number;
  verticalPadding: number;

  widgetMinWidth: number;
  widgetMinHeight: number;

  widgetRadius: number;
}

/* =========================================================
   WORKSPACE INTERACTION
   ========================================================= */

export type WorkspaceInteractionMode =
  | "default"
  | "context-widget"
  | "context-workspace"
  | "resize"
  | "style-editor";

export interface WorkspaceContextMenuState {
  x: number;
  y: number;

  widgetId?: WorkspaceWidgetId;
}

export interface WorkspaceResizeSession {
  widgetId: WorkspaceWidgetId;

  pointerId: number;

  startPointerX: number;
  startPointerY: number;

  startWidth: number;
  startHeight: number;

  lastAppliedWidth: number;
  lastAppliedHeight: number;

  startedAt: number;
  lastUpdateAt: number;
}

/* =========================================================
   WORKSPACE STYLE EDITOR
   ========================================================= */

export interface WorkspaceStyleDraft {
  original: WorkspaceStyle;
  draft: WorkspaceStyle;
}