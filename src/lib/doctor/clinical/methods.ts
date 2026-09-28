import type { Patient } from "@/types/doctor-patients";
import type {
  AiMethodRouting,
  ClinicalAssessment,
  RegionProfile,
  TrainingManifest,
  TrainingProfile,
} from "@/types/doctor-clinical";

export function buildAiMethodRouting(
  patient: Patient | null,
  assessment: ClinicalAssessment | null,
  region: RegionProfile | null,
  trainingProfile: TrainingProfile,
  trainingManifest?: TrainingManifest | null,
): AiMethodRouting[] {
  if (!patient || !assessment || !region) {
    return [];
  }

  const manifest = trainingManifest ?? {};
  const activeModel = manifest.activeModel ?? {};

  const activeModelName = String(
    activeModel.name ||
      trainingProfile.selectedModelName ||
      "",
  );

  const hasRandomForest = activeModelName
    .toLowerCase()
    .includes("randomforest");

  const respiratoryRisk =
    assessment.outcomeRisks?.respiratory ?? 0;

  const cardiacRisk =
    assessment.outcomeRisks?.cardiac ?? 0;

  const respiratoryFlag =
    respiratoryRisk >= cardiacRisk;

  const rehabCandidate =
    respiratoryRisk >= 55 ||
    Number(patient.copdGold || 0) >= 3;

  const longFollowUpNeed =
    assessment.longRisk >= 55 ||
    Number(patient.packHistory || 0) >= 40 ||
    Number(patient.age || 0) >= 75;

  const featureCoverage = assessment.confidence || 0;

  const combinedPrecision = Number(
    activeModel.combinedPrecision ??
      trainingProfile.selectedModelPrecision ??
      0,
  );

  const hospitalizationPrecision = Number(
    activeModel.hospitalization
      ?.precision_weighted ??
      trainingProfile.hospitalizationPrecision ??
      0,
  );

  return [
    {
      id: "chaid",
      name: "Arbol de Decision CHAID",
      status: "active",
      role: "Estratifica peligro temprano y abre la primera rama del caso por estado, O2, FR y GOLD.",
      why: `Se activa porque el caso necesita una lectura rapida de riesgo a 24 horas con ${assessment.shortRisk}% y ${assessment.triggers.length} detonantes visibles.`,
      window: `Ventana clave: ${assessment.shortRisk}% en 24h`,
      signal: respiratoryFlag
        ? `Nodo dominante: oxigenacion/FR en ${region.label}`
        : "Nodo dominante: estado hemodinamico y carga global",
      confidence: Math.max(
        assessment.confidence,
        78,
      ),
    },

    {
      id: "wald-logistic",
      name: "Regresion Logistica Binaria (Wald)",
      status: "active",
      role: "Pesa la fuerza de asociacion de edad, tabaquismo, falla cardiaca y biomarcadores con el desenlace clinico.",
      why: `Se usa para explicar por que el frente ${assessment.dominantRiskType} domina el caso con edad ${patient.age || "sin dato"}, tabaquismo ${patient.smokingStatus || "sin dato"} y pack-years ${patient.packHistory || "sin dato"}.`,
      window: `Asociacion hacia 7 dias: ${assessment.weekRisk}%`,
      signal:
        "Coeficientes clinicos visibles: tabaquismo, edad, O2, creatinina, glucosa",
      confidence: Math.max(
        featureCoverage - 4,
        70,
      ),
    },

    {
      id: "random-forest",
      name: "Random Forest",
      status: hasRandomForest
        ? "active"
        : "proxy",
      role: "Generaliza el riesgo en cohortes y consolida el modelo ganador exportado por el manifiesto.",
      why: hasRandomForest
        ? `El manifiesto actual selecciono ${activeModel.name || "RandomForest"} como mejor modelo con precision ${combinedPrecision}%.`
        : "El manifiesto activo no tiene un Random Forest ganador, pero se mantiene como comparador de generalizacion del caso.",
      window: `Motor de referencia: ${combinedPrecision}% precision`,
      signal: `Hospitalizacion ${hospitalizationPrecision}%`,
      confidence: Math.max(
        combinedPrecision,
        72,
      ),
    },

    {
      id: "xgboost",
      name: "XGBoost",
      status: "proxy",
      role: "Modelo tabular para relaciones no lineales entre SpO2, FR, presion, BNP, edad y comorbilidades.",
      why: `Se propone como candidato predictivo porque el caso tiene senales tabulares mixtas y riesgo 24h de ${assessment.shortRisk}%.`,
      window:
        "Benchmark tabular: actual, 24h, 7 dias y 30 dias",
      signal:
        "Gradiente boosting con regularizacion para eventos clinicos raros",
      confidence: Math.max(
        featureCoverage - 2,
        62,
      ),
    },

    {
      id: "lightgbm",
      name: "LightGBM",
      status: "proxy",
      role: "Prueba rapida de boosting tabular para cohortes medianas con muchas variables clinicas faltantes.",
      why: "Se sugiere para comparar velocidad, calibracion y ranking de importancia frente a RandomForest.",
      window:
        "Validacion cruzada y calibracion por ventana temporal",
      signal:
        "Histogram boosting, importancia por ganancia y estabilidad por fold",
      confidence: Math.max(
        featureCoverage - 4,
        60,
      ),
    },

    {
      id: "catboost",
      name: "CatBoost",
      status: "proxy",
      role: "Modelo tabular fuerte cuando hay variables categoricas clinicas como ciudad, tabaquismo, estado y antecedentes.",
      why: `Puede aprovechar categorias del paciente sin codificacion fragil: ${patient.locationCity || "sin ciudad"}, ${patient.smokingStatus || "sin tabaquismo"}.`,
      window:
        "Comparador para longitudinalidad y validacion clinica",
      signal:
        "Boosting categorico con menor fuga por codificacion",
      confidence: Math.max(
        featureCoverage - 5,
        58,
      ),
    },

    {
      id: "mlp",
      name: "Red Neuronal MLP",
      status: longFollowUpNeed
        ? "proxy"
        : "planned",
      role: "Vigila patrones complejos de reingreso y deterioro tardio cuando la carga cronica supera la ventana aguda.",
      why: longFollowUpNeed
        ? `El caso entra a seguimiento de reingreso porque el riesgo a largo plazo es ${assessment.longRisk}% con carga cronica relevante.`
        : "Aun no se prioriza para este caso porque la senal tardia es menor que la aguda.",
      window: `Reingreso / 30 dias: ${assessment.longRisk}%`,
      signal:
        "Carga cronica, pack-years, edad, GOLD y contexto de seguimiento",
      confidence: longFollowUpNeed
        ? Math.max(
            assessment.longRisk - 8,
            62,
          )
        : 40,
    },

    {
      id: "genetic",
      name: "Algoritmos Geneticos",
      status:
        featureCoverage >= 70
          ? "proxy"
          : "planned",
      role: "Prioriza las variables con mas impacto esperado sobre calidad de vida y deterioro acumulado.",
      why:
        featureCoverage >= 70
          ? `Se activa como capa de priorizacion porque hay ${featureCoverage}% de cobertura clinica y el caso combina comorbilidad, tabaquismo y contexto ambiental.`
          : "No hay suficiente cobertura para una buena priorizacion multivariable; faltan campos clave del paciente.",
      window: `Priorizacion de variables: ${featureCoverage}% cobertura`,
      signal:
        "Edad, O2, GOLD, tabaquismo, IMC, creatinina, glucosa",
      confidence: Math.max(
        featureCoverage - 6,
        45,
      ),
    },

    {
      id: "psm",
      name: "Propensity Score Matching",
      status: rehabCandidate
        ? "proxy"
        : "planned",
      role: "Controla sesgo observacional al estimar si la rehabilitacion respiratoria podria cambiar el pronostico del caso.",
      why: rehabCandidate
        ? `Se sugiere porque el paciente parece candidato a rehabilitacion por EPOC/GOLD y frente respiratorio ${respiratoryRisk}%.`
        : "Queda en reserva hasta que el caso muestre indicios mas claros de rehabilitacion comparativa.",
      window: `Impacto potencial sobre seguimiento: ${assessment.weekRisk}% a 7 dias`,
      signal:
        "Comparacion observacional para rehabilitacion y adherencia",
      confidence: rehabCandidate
        ? Math.max(
            respiratoryRisk - 5,
            55,
          )
        : 35,
    },
  ];
}