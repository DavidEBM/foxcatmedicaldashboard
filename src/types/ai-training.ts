export interface AiMetricBlock {
  mean?: number | null;
  std?: number | null;
  min?: number | null;
  max?: number | null;

  [key: string]: unknown;
}

export interface SpecializedOutcome {
  key: string;
  label: string;
  column: string | null;
  artifact: string | null;

  positiveRate: number | null;

  precision: number | null;
  accuracy: number | null;
  recall: number | null;
  f1: number | null;
  aucRoc: number | null;

  metrics: Record<
    string,
    AiMetricBlock | number | null
  >;

  split: unknown;
}

export interface AiModelTaskMetrics {
  precision_weighted: number | null;
  accuracy: number | null;
  recall_weighted: number | null;
  f1_weighted: number | null;
  auc_roc: number | null;

  [key: string]: unknown;
}

export interface ActiveAiModel {
  name: string;

  combinedPrecision: number | null;
  combinedAccuracy: number | null;
  combinedAucRoc: number | null;
  combinedF1: number | null;
  combinedRecall: number | null;
  combinedMcc: number | null;

  triage: AiModelTaskMetrics | null;
  hospitalization: AiModelTaskMetrics | null;

  predictionLatency: unknown;
}

export interface CandidateAiModel {
  id: string;
  name: string;

  combinedPrecision: number | null;
  combinedAccuracy: number | null;
  combinedAucRoc: number | null;
  combinedF1: number | null;
  combinedRecall: number | null;
  combinedMcc: number | null;

  validation: unknown;
  test: unknown;
  crossValidation: unknown;
}

export interface AiArtifact {
  key: string;
  path: string;
  browserExecutable: false;
  requiresInferenceBackend: true;
}

export interface TrainingProfile {
  ready: boolean;

  selectedModelName: string;
  selectedModelPrecision: number | null;
  selectedModelMcc: number | null;
  selectedModelAucRoc: number | null;

  triagePrecision: number | null;
  hospitalizationPrecision: number | null;

  minimumPrecisionTarget: number;

  calibrationMode: string;

  datasetSplit: unknown;
  crossValidation: unknown;

  specializedOutcomes:
    Record<string, SpecializedOutcome>;
}

export interface TrainingManifest {
  trainingVersion: string;
  generatedAtUtc: string | null;

  minimumPrecisionTarget: number;

  activeModel: ActiveAiModel;
  candidateModels: CandidateAiModel[];

  specializedOutcomes:
    Record<string, SpecializedOutcome>;

  trainingProfile: TrainingProfile;

  artifacts:
    Record<string, AiArtifact>;

  design: unknown;
  dataset: unknown;
  evaluation: unknown;
  riskMathValidation: unknown;
  splitSummary: unknown;
}