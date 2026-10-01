import type {
  AiValidationVerdict,
  PredictionSource,
} from "@/types/doctor-ai-validation";

export const AI_VALIDATIONS_COLLECTION =
  "ValidacionPredicciones";

// Cobertura clínica: clasificación categórica GOLD más tres riesgos clínicos.
export const EXPECTED_PREDICTIONS_PER_PATIENT = 4;

export const EXPECTED_VALIDATION_KEYS = [
  "copd_gold",
  "respiratory-risk",
  "cardiac-risk",
  "danger-symptom-risk",
] as const;

export const VALIDATION_VERDICTS: Record<
  Uppercase<AiValidationVerdict>,
  AiValidationVerdict
> = {
  VALID: "valid",
  INCORRECT: "incorrect",
};

export const PREDICTION_SOURCE: Record<
  Uppercase<PredictionSource>,
  PredictionSource
> = {
  BACKEND: "backend",
  "LOCAL-ESTIMATE": "local-estimate",
  DEMO: "demo",
};
