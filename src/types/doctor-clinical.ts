import type { Patient } from "@/types/doctor-patients";

export type ClinicalRiskTone = "low" | "medium" | "high";

export type ClinicalRiskType =
  | "respiratory"
  | "cardiac"
  | "dangerousSymptom";

export interface ClinicalAlert {
  tone: "soft" | "success" | "warning" | "critical";
  text: string;
}

export interface ClinicalLabItem {
  label: string;
  value: string;
}

export interface ClinicalAssessment {
  region: RegionProfile;
  shortRisk: number;
  weekRisk: number;
  longRisk: number;

  outcomeRisks: {
    respiratory: number;
    cardiac: number;
    dangerousSymptom: number;
  };

  dominantRiskType: ClinicalRiskType;
  confidence: number;
  expectedOxygen: number;

  environmentalSummary: string;

  summary: string;

  triggers: string[];
  keyFindings: string[];
  recommendations: string[];

  forecast: ClinicalForecast;
  aiMethods: AiMethodRouting[];
}

export interface ConsultationTimeline {
  lowRiskHours: number;
  dangerHours: number;
  projectedRisk: number;
  summary: string;
}

export interface ConsultationAnalysis {
  assessment: ClinicalAssessment;
  headline: string;
  importantSummary: string;

  strengths: string[];
  weaknesses: string[];

  conciseRecommendations: string[];

  lowRiskWindow: string;
  dangerStart: string;

  futureEffects: string[];

  timeline: ConsultationTimeline;
}

export interface ClinicalForecast {
  horizon: string;
  deterioration: string;
  watchSignal: string;
  ifUntreated: string;
}

export interface AiMethodRouting {
  id: string;
  name: string;
  status: "active" | "proxy" | "planned";
  role: string;
  why: string;
  window: string;
  signal: string;
  confidence: number;
}

export interface RiskTimelineItem {
  label: string;
  values: number[];
}

export interface ClinicalCurvePoint {
  x: number;
  y: number;
  active: boolean;
}

export interface RegionProfile {
  label: string;
  altitude: number;
  oxygenAdjustment: number;
  respiratoryStress: number;
  accessPressure: number;
  airQualityIndex: number;
  temperatureC: number;
  humidity: number;
  climate: string;
  careFocus: string;
  recommendationFocus: string;
}

export interface TrainingProfile {
  ready: boolean;
  datasetPatients: number;
  baseLocation: string;
  meanOxygen: number;
  meanAge: number;
  selectedModelName?: string;
  selectedModelPrecision?: number;
  hospitalizationPrecision?: number;
}

export interface TrainingManifest {
  activeModel?: {
    name?: string;
    combinedPrecision?: number;
    hospitalization?: {
      precision_weighted?: number;
    };
  };
}

export type { ConsultationAnalysis as DoctorConsultationAnalysis };