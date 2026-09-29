export const ML_ALGORITHMS = [
  { id: "XGBoost", label: "XGBoost" },
  { id: "LightGBM", label: "LightGBM" },
  { id: "CatBoost", label: "CatBoost" },
  { id: "RandomForest", label: "Random Forest" },
  { id: "ExtraTrees", label: "Extra Trees" },
  { id: "LogisticRegression", label: "Regresión logística" },
  { id: "SVM", label: "SVM" },
  { id: "DeepLearningMLP", label: "Red neuronal MLP" },
] as const;

export const ML_TARGETS = [
  { id: "copd_gold", label: "COPD GOLD (1–4)" },
  {
    id: "history_of_heart_failure",
    label: "Antecedente de insuficiencia cardiaca",
  },
  { id: "bodex", label: "BODEX (0–10)" },
  { id: "escala_disnea", label: "Escala de disnea (0–10)" },
  { id: "epocconfirmado", label: "EPOC confirmado" },
  { id: "clasifisui", label: "Clasificación SUI (urgencias)" },
] as const;

export type MlAlgorithmId = (typeof ML_ALGORITHMS)[number]["id"];
export type MlTargetId = (typeof ML_TARGETS)[number]["id"];
