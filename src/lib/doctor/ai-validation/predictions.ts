import type { Patient } from "@/types/doctor-patients";
import type {
  ClinicalAssessment,
  TrainingManifest,
  TrainingProfile,
} from "@/types/doctor-clinical";

import type {
  AiPrediction,
  PredictionSource,
} from "@/types/doctor-ai-validation";

import {
  PREDICTION_SOURCE,
} from "./constants";

import {
  buildPredictionTimeline,
  clampPercent,
  formatHorizon,
  normalizeHours,
} from "./timeline";

export function normalizePredictionKey(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
}

export function getRiskClass(
  risk: unknown,
): "high" | "medium" | "low" {
  const value = clampPercent(risk);

  if (value >= 70) {
    return "high";
  }

  if (value >= 45) {
    return "medium";
  }

  return "low";
}

export function getRiskLabel(
  risk: unknown,
): "Alto" | "Medio" | "Bajo" {
  const value = clampPercent(risk);

  if (value >= 70) {
    return "Alto";
  }

  if (value >= 45) {
    return "Medio";
  }

  return "Bajo";
}

interface RawPrediction {
  key?: string;
  predictionKey?: string;

  label?: string;
  predictionLabel?: string;

  risk?: number;
  predictedRisk?: number;

  finalRisk?: number;
  monthRisk?: number;

  horizonHours?: number;

  timeline?: Array<{
    hours?: number;
    label?: string;
    risk?: number;
  }>;

  source?: PredictionSource;
  modelName?: string;
  artifact?: string;
  target?: string;
}

export function normalizePrediction(
  prediction: RawPrediction | null | undefined,
  trainingProfile?: TrainingProfile,
): AiPrediction | null {
  if (!prediction) {
    return null;
  }

  const key = normalizePredictionKey(
    prediction.key ?? prediction.predictionKey,
  );

  const label = String(
    prediction.label ??
      prediction.predictionLabel ??
      "Predicción IA",
  ).trim();

  if (!key) {
    return null;
  }

  let timeline = Array.isArray(
    prediction.timeline,
  )
    ? prediction.timeline
        .map((point) => ({
          hours: normalizeHours(point.hours),
          label: String(
            point.label ??
              formatHorizon(point.hours),
          ),
          risk: clampPercent(point.risk),
        }))
        .filter((point) => point.hours > 0)
    : [];

  const directRisk = clampPercent(
    prediction.risk ??
      prediction.predictedRisk ??
      0,
  );

  if (!timeline.length) {
    const finalRisk = clampPercent(
      prediction.finalRisk ??
        prediction.monthRisk ??
        Math.min(98, directRisk + 20),
    );

    timeline = buildPredictionTimeline(
      directRisk,
      finalRisk,
    );
  }

  const firstPoint = timeline[0];

  return {
    key,
    label,

    risk:
      directRisk ||
      clampPercent(firstPoint?.risk),

    horizonHours: normalizeHours(
      prediction.horizonHours ??
        firstPoint?.hours ??
        24,
    ),

    timeline,

    source:
      prediction.source ??
      PREDICTION_SOURCE["LOCAL-ESTIMATE"],

    modelName:
      prediction.modelName ??
      trainingProfile?.selectedModelName ??
      "",

    artifact: prediction.artifact ?? "",

    target:
      prediction.target ?? key,
  };
}

/**
 * Creates the small, stable catalog shown to the doctor when the backend
 * has not returned individual prediction records yet. Keeping this adapter
 * here means the widget can consume both backend and local predictions.
 */
export function buildPredictionCatalog(
  patient: Patient,
  assessment: ClinicalAssessment,
  trainingProfile?: TrainingProfile,
  trainingManifest?: TrainingManifest | null,
): AiPrediction[] {
  const outcomeRisks = assessment.outcomeRisks ?? {
    respiratory: assessment.shortRisk,
    cardiac: assessment.weekRisk,
    dangerousSymptom: assessment.longRisk,
  };

  const modelName =
    trainingManifest?.activeModel?.name ??
    trainingProfile?.selectedModelName ??
    "Estimación clínica local";

  const items = [
    ["respiratory-risk", "Deterioro respiratorio", outcomeRisks.respiratory],
    ["cardiac-risk", "Evento cardiovascular", outcomeRisks.cardiac],
    ["danger-symptom-risk", "Síntomas de alarma", outcomeRisks.dangerousSymptom],
  ] as const;

  return items.map(([key, label, risk]) => {
    const normalizedRisk = clampPercent(risk);
    return {
      key: `${patient.id}-${key}`,
      label,
      risk: normalizedRisk,
      horizonHours: 24,
      timeline: buildPredictionTimeline(
        normalizedRisk,
        Math.min(99, normalizedRisk + 20),
      ),
      source: PREDICTION_SOURCE["LOCAL-ESTIMATE"],
      modelName,
      artifact: "workspace-clinical-assessment",
      target: key,
    };
  });
}
