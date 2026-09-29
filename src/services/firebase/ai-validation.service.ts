import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { auth } from "@/services/firebase/firebase-config";

import { db } from "@/services/firebase/config";

import {
  AI_VALIDATIONS_COLLECTION,
  EXPECTED_PREDICTIONS_PER_PATIENT,
} from "@/lib/doctor/ai-validation/constants";

import type {
  AdminPatientValidationSummary,
  AdminPredictionValidationSummary,
  AdminValidationAnalytics,
  AdminValidationPredictionReview,
} from "@/types/admin-validation";
import type {
  AiPatientValidationStatus,
  AiPatientValidationSummary,
  AiPredictionValidation,
  AiValidationVerdict,
  SaveAiPredictionValidationInput,
} from "@/types/doctor-ai-validation";

interface ValidationSubscriptionOptions<T> {
  onData: (value: T) => void;
  onError?: (error: Error) => void;
}

export type PatientValidationVerdicts = Record<
  string,
  AiValidationVerdict
>;

function timestampMillis(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (value && typeof value === "object" && "seconds" in value) {
    const seconds = Number((value as { seconds?: unknown }).seconds);
    return Number.isFinite(seconds) ? seconds * 1000 : 0;
  }

  return 0;
}

/**
 * Unifica las claves de backend y las claves de las estimaciones locales.
 * Por ejemplo, copd_gold y paciente-respiratory-risk representan el mismo
 * modelo en distintas rutas de la interfaz.
 */
export function canonicalizePredictionKey(
  predictionKey: unknown,
): string {
  const key = String(predictionKey ?? "")
    .trim()
    .toLowerCase();

  if (key === "copd_gold" || key.endsWith("-respiratory-risk")) {
    return "respiratory-risk";
  }

  if (
    key === "history_of_heart_failure" ||
    key.endsWith("-cardiac-risk")
  ) {
    return "cardiac-risk";
  }

  if (key.endsWith("-danger-symptom-risk")) {
    return "danger-symptom-risk";
  }

  return key;
}

interface LatestValidation {
  verdict: AiValidationVerdict;
  label: string;
  modelName: string;
  target: string;
  updatedAt?: unknown;
  millis: number;
}

function getLatestValidations(
  documents: Array<{ data: () => DocumentData }>,
): Map<string, Map<string, LatestValidation>> {
  const latestByPatient = new Map<string, Map<string, LatestValidation>>();

  documents.forEach((document) => {
    const data = document.data();
    const patientId = String(data.patientId ?? "").trim();
    const predictionKey = canonicalizePredictionKey(data.predictionKey);
    const verdict = data.status === "validado" ? "valid" : "incorrect";

    if (!patientId || !predictionKey) {
      return;
    }

    const updatedAt = data.createdAt ?? data.assignedAt;
    const millis = timestampMillis(updatedAt);
    const patientValidations = latestByPatient.get(patientId) ?? new Map();
    const current = patientValidations.get(predictionKey);

    if (!current || millis >= current.millis) {
      patientValidations.set(predictionKey, {
        verdict,
        label: String(data.predictionLabel ?? data.predictionName ?? "Predicción IA"),
        modelName: String(data.predictionValues?.modelName ?? data.modelName ?? "Modelo IA"),
        target: String(data.predictionValues?.target ?? data.target ?? predictionKey),
        updatedAt,
        millis,
      });
      latestByPatient.set(patientId, patientValidations);
    }
  });

  return latestByPatient;
}

function getSummary(
  patientId: string,
  validations: Map<string, LatestValidation>,
): AiPatientValidationSummary {
  const validatedCount = Math.min(
    validations.size,
    EXPECTED_PREDICTIONS_PER_PATIENT,
  );
  const totalPredictions = EXPECTED_PREDICTIONS_PER_PATIENT;
  const pendingCount = Math.max(totalPredictions - validatedCount, 0);
  const latest = Array.from(validations.values()).sort(
    (a, b) => b.millis - a.millis,
  )[0];
  const status: AiPatientValidationStatus =
    validatedCount === 0
      ? "pending"
      : validatedCount >= totalPredictions
        ? "complete"
        : "partial";

  return {
    patientId,
    validatedCount,
    totalPredictions,
    pendingCount,
    status,
    latestUpdatedAt: latest?.updatedAt,
  };
}

export function subscribeToDoctorValidationSummaries(
  doctorUid: string | null,
  options: ValidationSubscriptionOptions<
    Record<string, AiPatientValidationSummary>
  >,
): Unsubscribe {
  if (!doctorUid) {
    options.onData({});
    return () => undefined;
  }

  const validationsQuery = query(
    collection(db, AI_VALIDATIONS_COLLECTION),
    where("doctorUid", "==", doctorUid),
  );

  return onSnapshot(
    validationsQuery,
    (snapshot) => {
      const latestByPatient = getLatestValidations(snapshot.docs);
      const summaries: Record<string, AiPatientValidationSummary> = {};

      latestByPatient.forEach((validations, patientId) => {
        summaries[patientId] = getSummary(patientId, validations);
      });

      options.onData(summaries);
    },
    (error) => options.onError?.(error),
  );
}

export function subscribeToAdminValidationAnalytics(
  options: ValidationSubscriptionOptions<AdminValidationAnalytics>,
): Unsubscribe {
  const validationsQuery = query(
    collection(db, AI_VALIDATIONS_COLLECTION),
  );

  return onSnapshot(
    validationsQuery,
    (snapshot) => {
      const latestByPatient = getLatestValidations(snapshot.docs);
      const patientSummaries: Record<string, AdminPatientValidationSummary> = {};
      const predictionSummaries: Record<string, AdminPredictionValidationSummary> = {};

      latestByPatient.forEach((validations, patientId) => {
        const reviews: Record<string, AdminValidationPredictionReview> = {};
        let validCount = 0;
        let incorrectCount = 0;

        validations.forEach((validation, predictionKey) => {
          reviews[predictionKey] = {
            verdict: validation.verdict,
            label: validation.label,
            modelName: validation.modelName,
            target: validation.target,
            updatedAt: validation.updatedAt,
          };

          if (validation.verdict === "valid") {
            validCount += 1;
          } else {
            incorrectCount += 1;
          }

          const current = predictionSummaries[predictionKey] ?? {
            predictionKey,
            label: validation.label,
            modelName: validation.modelName,
            target: validation.target,
            reviewedCount: 0,
            validCount: 0,
            incorrectCount: 0,
          };

          current.reviewedCount += 1;
          if (validation.verdict === "valid") {
            current.validCount += 1;
          } else {
            current.incorrectCount += 1;
          }
          predictionSummaries[predictionKey] = current;
        });

        const reviewedCount = Math.min(
          validations.size,
          EXPECTED_PREDICTIONS_PER_PATIENT,
        );
        const totalPredictions = EXPECTED_PREDICTIONS_PER_PATIENT;
        const pendingCount = Math.max(totalPredictions - reviewedCount, 0);
        const latest = Array.from(validations.values()).sort(
          (left, right) => right.millis - left.millis,
        )[0];

        patientSummaries[patientId] = {
          patientId,
          reviewedCount,
          validCount,
          incorrectCount,
          totalPredictions,
          pendingCount,
          status: incorrectCount > 0
            ? "not-validated"
            : reviewedCount === 0
              ? "missing"
              : reviewedCount >= totalPredictions
                ? "validated"
                : "partial",
          predictions: reviews,
          latestUpdatedAt: latest?.updatedAt,
        };
      });

      options.onData({ patientSummaries, predictionSummaries });
    },
    (error) => options.onError?.(error),
  );
}

export function subscribeToPatientValidationVerdicts(
  doctorUid: string | null,
  patientId: string | null,
  options: ValidationSubscriptionOptions<PatientValidationVerdicts>,
): Unsubscribe {
  if (!doctorUid || !patientId) {
    options.onData({});
    return () => undefined;
  }

  const validationsQuery = query(
    collection(db, AI_VALIDATIONS_COLLECTION),
    where("doctorUid", "==", doctorUid),
  );

  return onSnapshot(
    validationsQuery,
    (snapshot) => {
      const latestByPatient = getLatestValidations(
        snapshot.docs.filter((document) => document.data().patientId === patientId),
      );
      const latest = latestByPatient.get(patientId) ?? new Map();
      const verdicts: PatientValidationVerdicts = {};

      latest.forEach((validation, predictionKey) => {
        verdicts[predictionKey] = validation.verdict;
      });

      options.onData(verdicts);
    },
    (error) => options.onError?.(error),
  );
}

function normalizeRisk(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, Math.round(numeric)),
  );
}

function normalizeHours(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.round(numeric);
}

export async function saveAiPredictionValidation(
  input: SaveAiPredictionValidationInput,
  doctorUid: string,
): Promise<AiPredictionValidation> {
  if (!doctorUid) {
    throw new Error(
      "No existe una sesión de médico activa.",
    );
  }

  if (auth.currentUser?.uid !== doctorUid) {
    throw new Error("La sesión médica no coincide con el usuario autenticado.");
  }

  if (!input.patient?.id) {
    throw new Error(
      "No se encontró el paciente.",
    );
  }

  if (!input.prediction?.key) {
    throw new Error(
      "No se encontró la predicción.",
    );
  }

  if (input.verdict !== "valid" && input.verdict !== "incorrect") {
    throw new Error("Selecciona una validación correcta o incorrecta.");
  }

  if (!Array.isArray(input.prediction.timeline) || input.prediction.timeline.length === 0) {
    throw new Error("La predicción no contiene una línea temporal válida.");
  }

  const predictionTimeline =
    input.prediction.timeline.map(
      (point) => ({
        hours: normalizeHours(point.hours),
        label: String(point.label ?? ""),
        risk: normalizeRisk(point.risk),
      }),
    );

  const status: AiPredictionValidation["status"] = input.verdict === "valid"
    ? "validado"
    : "no_validado";

  const predictionValues = {
    risk: normalizeRisk(input.prediction.risk),
    horizonHours: normalizeHours(input.prediction.horizonHours),
    timeline: predictionTimeline,
    source: input.prediction.source,
    modelName: String(input.prediction.modelName ?? ""),
    artifact: String(input.prediction.artifact ?? ""),
    target: String(input.prediction.target ?? ""),
  };

  const assignedAt = serverTimestamp();
  const payload = {
    assignedAt,
    assignedBy: doctorUid,
    patientId: input.patient.id,
    doctorUid,
    status,
    predictionName: String(input.prediction.label ?? "Predicción IA"),
    predictionKey: input.prediction.key,
    predictionValues,
    createdAt: assignedAt,
  };

  const reference = await addDoc(
    collection(
      db,
      AI_VALIDATIONS_COLLECTION,
    ),
    payload,
  );

  return {
    id: reference.id,
    ...payload,
    predictionLabel: payload.predictionName,
    predictedRisk: predictionValues.risk,
    horizonHours: predictionValues.horizonHours,
    predictionTimeline,
    verdict: input.verdict,
    source: predictionValues.source,
    modelName: predictionValues.modelName,
    artifact: predictionValues.artifact,
    target: predictionValues.target,
  };
}
