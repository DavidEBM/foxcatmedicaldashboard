import type { TrainingManifest } from "@/types/ai-training";

export function normalizeNumber(
  value: unknown,
  fallback: number | null = null
): number | null {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

export function normalizePercent(
  value: unknown,
  fallback: number | null = null
): number | null {
  const number = normalizeNumber(
    value,
    fallback
  );

  if (number === null) {
    return fallback;
  }

  return number >= 0 && number <= 1
    ? number * 100
    : number;
}


export function normalizeManifest(
  rawManifest: unknown
): TrainingManifest {
  if (
    !rawManifest ||
    typeof rawManifest !== "object"
  ) {
    throw new Error(
      "El manifiesto IA está vacío o no tiene un formato válido."
    );
  }

  const raw = rawManifest as Record<string, unknown>;
  const trainingProfile = raw.trainingProfile && typeof raw.trainingProfile === "object"
    ? raw.trainingProfile as Record<string, unknown>
    : {};
  const activeModel = raw.activeModel && typeof raw.activeModel === "object"
    ? raw.activeModel as Record<string, unknown>
    : {};

  return {
    ...raw,
    trainingVersion: String(raw.trainingVersion ?? "unknown"),
    generatedAtUtc: typeof raw.generatedAtUtc === "string" ? raw.generatedAtUtc : null,
    minimumPrecisionTarget: normalizeNumber(raw.minimumPrecisionTarget, 90) ?? 90,
    activeModel: {
      ...activeModel,
      name: String(activeModel.name ?? "Modelo no identificado"),
      combinedPrecision: normalizePercent(activeModel.combinedPrecision),
      combinedAccuracy: normalizePercent(activeModel.combinedAccuracy),
      combinedAucRoc: normalizePercent(activeModel.combinedAucRoc),
      combinedF1: normalizePercent(activeModel.combinedF1),
      combinedRecall: normalizePercent(activeModel.combinedRecall),
      combinedMcc: normalizeNumber(activeModel.combinedMcc),
      triage: activeModel.triage && typeof activeModel.triage === "object"
        ? activeModel.triage as TrainingManifest["activeModel"]["triage"]
        : null,
      hospitalization: activeModel.hospitalization && typeof activeModel.hospitalization === "object"
        ? activeModel.hospitalization as TrainingManifest["activeModel"]["hospitalization"]
        : null,
      predictionLatency: activeModel.predictionLatency ?? null,
    },
    candidateModels: Array.isArray(raw.candidateModels) ? raw.candidateModels : [],
    specializedOutcomes: raw.specializedOutcomes && typeof raw.specializedOutcomes === "object"
      ? raw.specializedOutcomes
      : {},
    trainingProfile: {
      ...trainingProfile,
      ready: Boolean(trainingProfile.ready),
      selectedModelName: String(trainingProfile.selectedModelName ?? activeModel.name ?? "Modelo no identificado"),
      selectedModelPrecision: normalizePercent(trainingProfile.selectedModelPrecision),
      selectedModelMcc: normalizeNumber(trainingProfile.selectedModelMcc),
      selectedModelAucRoc: normalizePercent(trainingProfile.selectedModelAucRoc),
      triagePrecision: normalizePercent(trainingProfile.triagePrecision),
      hospitalizationPrecision: normalizePercent(trainingProfile.hospitalizationPrecision),
      minimumPrecisionTarget: normalizeNumber(trainingProfile.minimumPrecisionTarget, 90) ?? 90,
      calibrationMode: String(trainingProfile.calibrationMode ?? ""),
      datasetSplit: trainingProfile.datasetSplit ?? null,
      crossValidation: trainingProfile.crossValidation ?? null,
      specializedOutcomes: trainingProfile.specializedOutcomes && typeof trainingProfile.specializedOutcomes === "object"
        ? trainingProfile.specializedOutcomes
        : {},
    },
    artifacts: raw.artifacts && typeof raw.artifacts === "object" ? raw.artifacts : {},
    design: raw.design ?? null,
    dataset: raw.dataset ?? null,
    evaluation: raw.evaluation ?? null,
    riskMathValidation: raw.riskMathValidation ?? null,
    splitSummary: raw.splitSummary ?? null,
  } as TrainingManifest;
}