import type { WorkspaceWidgetConstraints, WorkspaceWidgetId } from "@/types/doctor-workspace";

export interface WidgetSizeConfig extends WorkspaceWidgetConstraints {
  width: number;
  height: number;
}

/** Tamaños funcionales: reflejan la densidad real de cada widget. */
export const WIDGET_SIZE_CONFIG: Record<string, WidgetSizeConfig> = {
  "patient-summary": { width: 360, height: 300, minWidth: 280, minHeight: 220, maxWidth: 720, maxHeight: 620 },
  risk: { width: 320, height: 260, minWidth: 240, minHeight: 190, maxWidth: 620, maxHeight: 560 },
  vitals: { width: 420, height: 330, minWidth: 340, minHeight: 270, maxWidth: 900, maxHeight: 720 },
  assessment: { width: 420, height: 330, minWidth: 340, minHeight: 270, maxWidth: 900, maxHeight: 760 },
  recommendations: { width: 460, height: 380, minWidth: 360, minHeight: 300, maxWidth: 920, maxHeight: 900 },
  schedule: { width: 380, height: 330, minWidth: 300, minHeight: 260, maxWidth: 820, maxHeight: 760 },
  "ai-summary": { width: 560, height: 390, minWidth: 460, minHeight: 330, maxWidth: 1100, maxHeight: 820 },
  "ai-copd": { width: 560, height: 430, minWidth: 480, minHeight: 360, maxWidth: 1100, maxHeight: 760 },
  "ai-heart-failure": { width: 560, height: 430, minWidth: 480, minHeight: 360, maxWidth: 1100, maxHeight: 760 },
  "ai-clinical-risk": { width: 760, height: 420, minWidth: 600, minHeight: 340, maxWidth: 1280, maxHeight: 820 },
};

export const GENERIC_WIDGET_SIZE: WidgetSizeConfig = {
  width: 360,
  height: 280,
  minWidth: 280,
  minHeight: 220,
  maxWidth: 1000,
  maxHeight: 900,
};

export function getWidgetSizeConfig(id: WorkspaceWidgetId): WidgetSizeConfig {
  return WIDGET_SIZE_CONFIG[id] ?? GENERIC_WIDGET_SIZE;
}

