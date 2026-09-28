export type WidgetKey =
  | "patient-overview"
  | "medic-ai"
  | "consultation-analysis"
  | "alerts"
  | "agenda"
  | "status"
  | "labs"
  | "critical"
  | "location"
  | "patients"
  | "questionnaires"
  | "notes";

export type QuickAccessType = "widget" | "action";

export interface WidgetDefinition {
  key: WidgetKey;
  label: string;
  description: string;
  shortcutDescription: string;
}

export interface QuickAccessItem {
  id: string;
  type: QuickAccessType;
  target: string;
  label: string;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
  insertBeforeKey?: WidgetKey | null;
}

export type WidgetInteractionMode =
  | "idle"
  | "remove-widget"
  | "drag-widget"
  | "resize-widget";

export interface WidgetState {
  layoutOrder: WidgetKey[];
  persistedLayoutOrder: WidgetKey[];
  hiddenWidgetKeys: WidgetKey[];
  quickAccessItems: QuickAccessItem[];
  widgetSizes: Partial<Record<WidgetKey, WidgetSize>>;
  draftWidgetSizes: Partial<Record<WidgetKey, WidgetSize>>;
  draftLayoutOrder: WidgetKey[];
  layoutEditMode: boolean;
  draggedWidgetKey: WidgetKey | null;
  activeResizeWidgetKey: WidgetKey | null;
  uiMode: WidgetInteractionMode;
  removeTargetKey: WidgetKey | null;
  placementTarget: WidgetPlacement | null;
}