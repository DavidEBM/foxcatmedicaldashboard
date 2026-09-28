
export type RiskClassKey =
  | "low"
  | "mild"
  | "moderate"
  | "high"
  | "imminent";

export function getRiskClassKey(
  percent: number | null
): RiskClassKey {
  const value = percent ?? 0;

  if (value < 20) return "low";
  if (value < 40) return "mild";
  if (value < 60) return "moderate";
  if (value < 80) return "high";

  return "imminent";
}

export function getRiskClass(percent: number | null): string {
  const key = getRiskClassKey(percent);
  return key === "imminent" ? "high" : key;
}

export function formatMetricPercent(value: unknown): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Sin dato";
  const percent = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(percent)}%`;
}

export function getModelQualitySummary(
  manifest: import("@/types/ai-training").TrainingManifest | null,
): string {
  if (!manifest) return "No hay manifiesto de entrenamiento disponible.";
  const modelName = manifest.activeModel?.name || "Modelo sin nombre";
  const precision = formatMetricPercent(manifest.activeModel?.combinedPrecision);
  return `${modelName} · precisión combinada ${precision}`;
}

export function summarizeActiveModel(
  manifest: import("@/types/ai-training").TrainingManifest | null,
): string {
  return getModelQualitySummary(manifest);
}

export function getManifestStatus(
  manifest: import("@/types/ai-training").TrainingManifest | null,
): "available" | "unavailable" {
  return manifest ? "available" : "unavailable";
}