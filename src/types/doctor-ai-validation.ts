import type { ClinicalAssessment } from "@/types/doctor-clinical";
import type { Patient } from "@/types/doctor-patients";

export type AiValidationVerdict = "valid" | "incorrect";

export type AiPatientValidationStatus =
  | "complete"
  | "partial"
  | "pending";

export interface AiPatientValidationSummary {
  patientId: string;
  validatedCount: number;
  totalPredictions: number;
  pendingCount: number;
  status: AiPatientValidationStatus;
  latestUpdatedAt?: unknown;
}

export type PredictionSource =
  | "backend"
  | "local-estimate"
  | "demo";

export interface PredictionTimelinePoint {
  hours: number;
  label: string;
  risk: number;
}

export interface AiPrediction {
  key: string;
  label: string;
  risk: number;
  horizonHours: number;
  timeline: PredictionTimelinePoint[];
  source: PredictionSource;
  modelName: string;
  artifact: string;
  target: string;
}

export interface AiPredictionValidation {
  id: string;
  assignedAt?: unknown;
  patientId: string;
  doctorUid: string;
  assignedBy: string;
  status: "validado" | "no_validado";
  predictionName: string;
  predictionValues: {
    risk: number;
    horizonHours: number;
    timeline: PredictionTimelinePoint[];
    source: PredictionSource;
    modelName: string;
    artifact: string;
    target: string;
  };
  predictionKey: string;
  predictionLabel: string;
  predictedRisk: number;
  horizonHours: number;
  predictionTimeline: PredictionTimelinePoint[];
  verdict: AiValidationVerdict;
  source: PredictionSource;
  modelName: string;
  artifact: string;
  target: string;
  createdAt?: unknown;
}

export interface SaveAiPredictionValidationInput {
  patient: Patient;
  prediction: AiPrediction;
  verdict: AiValidationVerdict;
}

export interface BuildPredictionContext {
  patient: Patient;
  assessment: ClinicalAssessment;
}
