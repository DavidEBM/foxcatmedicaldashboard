import type {
  AiValidationVerdict,
  PredictionSource,
} from "@/types/doctor-ai-validation";

export const AI_VALIDATIONS_COLLECTION =
  "ValidacionPredicciones";

// El panel clínico consolida dos predicciones del backend y una estimación
// local de síntomas de alarma para cada paciente.
export const EXPECTED_PREDICTIONS_PER_PATIENT = 3;

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
