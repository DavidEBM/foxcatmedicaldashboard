export interface SpecializedOutcome {
  key?: string;
  id?: string;
  name?: string;
  label?: string;

  currentRisk?: number;
  risk?: number;
  precision?: number;

  monthRisk?: number;
  longRisk?: number;
  finalRisk?: number;

  horizonHours?: number;

  timeline?: Array<{
    hours?: number;
    label?: string;
    risk?: number;
  }>;

  modelName?: string;
  artifact?: string;
  target?: string;
}

export interface TrainingManifest {
  activeModel?: {
    name?: string;
    combinedPrecision?: number;
    hospitalization?: {
      precision_weighted?: number;
    };
  };

  specializedOutcomes?:
    | SpecializedOutcome[]
    | Record<string, SpecializedOutcome>;
}