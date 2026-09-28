import type { Patient } from "@/types/doctor-patients";

export type AiMethodStatus =
  | "active"
  | "proxy"
  | "planned"
  | "info";

export interface AiMethod {
  name: string;
  status: AiMethodStatus;
  role: string;
  why: string;
  window: string;
  signal: string;
  confidence: number;
}

export interface ClinicalForecast {
  deterioration: string;
  horizon: string;
  watchSignal: string;
  ifUntreated: string;
}

export interface ClinicalAssessment {
  summary: string;
  confidence: number;
  expectedOxygen: number;

  shortRisk: number;
  weekRisk: number;
  longRisk: number;

  dominantRiskType: string;

  region: {
    label: string;
    altitude?: number;
    oxygenAdjustment?: number;
    airQualityIndex?: number;
  };

  forecast: ClinicalForecast;

  triggers: string[];
  recommendations: string[];

  environmentalSummary: string;

  aiMethods: AiMethod[];

  outcomeRisks: {
    respiratory: number;
    cardiac: number;
    dangerousSymptom: number;
  };
}

export interface TrainingProfile {
  datasetPatients: number;
  selectedModelPrecision: number;
  selectedModelName: string;
  minimumPrecisionTarget: number;

  datasetSplit: {
    train: number;
    validation: number;
    test: number;
  };

  crossValidation: {
    strategy?: string;
    folds?: number;
    meanPrecision?: number;
  };

  locationCounts?: Record<string, number>;

  sourceFiles?: string[];
  sampleRows?: string[];

  baseLocation: string;

  meanAge: number;
  meanOxygen: number;
  meanRespRate: number;
  meanAltitude: number;

  heartFailureRate: number;
  smokingExposureRate: number;
  goldHighRate: number;
  respiratoryFailureRate: number;
  cardiacFailureRate: number;
  dangerousSymptomRate: number;

  triagePrecision: number;
  hospitalizationPrecision: number;

  calibrationMode: string;

  ready: boolean;
  retrainedWithAdjustments?: boolean;
}

export interface AiModelMetrics {
  precision_weighted?: number;
  sensitivity?: number;
  specificity?: number;
}

export interface AiModelArtifacts {
  triageModel?: string;
  hospitalizationModel?: string;
  [key: string]: unknown;
}

export interface AiCandidateModel {
  name: string;
  combinedPrecision?: number;
  combinedAucRoc?: number;
  adjusted?: boolean;
  [key: string]: unknown;
}

export interface TrainingManifest {
  generatedAt?: string;
  selectedMetric?: string;

  activeModel?: {
    combinedPrecision?: number;
    combinedAucRoc?: number;
    adjusted?: boolean;

    artifacts?: AiModelArtifacts;

    triage?: AiModelMetrics;
    hospitalization?: AiModelMetrics;
  };

  candidateModels?: AiCandidateModel[];

  riskMathValidation?: {
    summary?: string;

    hospitalization_alignment?: {
      auc_roc?: number;
      sensitivity?: number;
      specificity?: number;
    };

    monotonic_checks?: {
      oxygen_vs_risk_spearman?: number;
      respiratory_rate_vs_risk_spearman?: number;
    };

    recommendation_checks?: {
      recommendation_coverage?: number;
      trigger_coverage?: number;
    };

    rule_checks?: string[];
  };

  datasetSplit?: {
    train: number;
    validation: number;
    test: number;
  };

  crossValidation?: {
    strategy?: string;
    folds?: number;
    meanPrecision?: number;
  };

  [key: string]: unknown;
}

export interface AiDebugData {
  assessment: ClinicalAssessment | null;

  precision: number;
  modelPrecision: number;
  modelTarget: number;
  modelStatus: string;

  foundCoverageCount: number;
  totalCoverageCount: number;

  availableCoverageLabels: string[];
  missingCoverageLabels: string[];

  modelName: string;

  generatedAt: string;
  generatedAtLabel: string;
  manifestFreshnessMinutes: number | null;

  selectedMetric: string;

  datasetSplit: {
    train: number;
    validation: number;
    test: number;
  };

  crossValidation: TrainingManifest["crossValidation"];

  modelAdjusted: boolean;
  modelArtifacts: AiModelArtifacts;
  modelArtifactsCount: number;

  triageMetrics: AiModelMetrics;
  hospitalizationMetrics: AiModelMetrics;

  triagePrecision: number;
  hospitalizationPrecision: number;
  combinedAucRoc: number;

  candidateCount: number;
  rankedCandidates: AiCandidateModel[];

  riskMathValidation: TrainingManifest["riskMathValidation"];
  validationSummary: string;

  calibrationMode: string;

  trainingReady: boolean;
  retrainedWithAdjustments: boolean;

  trainingSummary: string;
  sourceFiles: string[];

  sampleRows: string[];

  locationSummary: string;

  datasetPatients: number;
  baseLocation: string;

  meanAge: number;
  meanOxygen: number;
  meanRespRate: number;
  meanAltitude: number;

  heartFailureRate: number;
  smokingExposureRate: number;
  goldHighRate: number;
  respiratoryFailureRate: number;
  cardiacFailureRate: number;
  dangerousSymptomRate: number;

  patientSignalLines: string[];
  activeVariables: string[];

  aiMethods: AiMethod[];
  activeAiMethods: AiMethod[];
  proxyAiMethods: AiMethod[];
  pendingAiMethods: AiMethod[];

  clinicalForecast: ClinicalForecast | null;

  mathLines: string[];
  processLog: string[];

  triggerLines: string[];
  recommendationLines: string[];
}

export interface AiDebugSize {
  width: number;
  height: number;
}

export interface AiDebugPosition {
  x: number | null;
  y: number | null;
}

export interface AiDebugDrag {
  offsetX: number;
  offsetY: number;
}

export interface AiDebugResizeSession {
  direction: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
}