import type { AiValidationVerdict } from "@/types/doctor-ai-validation";

export type AdminPatientValidationStatus =
  | "validated"
  | "partial"
  | "missing"
  | "not-validated";

export interface AdminValidationPredictionReview {
  verdict: AiValidationVerdict;
  label: string;
  modelName: string;
  target: string;
  updatedAt?: unknown;
}

export interface AdminPatientValidationSummary {
  patientId: string;
  reviewedCount: number;
  validCount: number;
  incorrectCount: number;
  totalPredictions: number;
  pendingCount: number;
  status: AdminPatientValidationStatus;
  goldVerdict: AiValidationVerdict | null;
  predictions: Record<string, AdminValidationPredictionReview>;
  latestUpdatedAt?: unknown;
}

export interface AdminPredictionValidationSummary {
  predictionKey: string;
  label: string;
  modelName: string;
  target: string;
  reviewedCount: number;
  validCount: number;
  incorrectCount: number;
}

export interface AdminValidationRecord {
  patientId: string;
  doctorUid: string;
  predictionKey: string;
  target: string;
  verdict: AiValidationVerdict;
  updatedAt?: unknown;
  updatedAtMillis: number;
}

export interface AdminValidationAnalytics {
  patientSummaries: Record<string, AdminPatientValidationSummary>;
  predictionSummaries: Record<string, AdminPredictionValidationSummary>;
  records: AdminValidationRecord[];
}
