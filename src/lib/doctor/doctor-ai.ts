import type {
  AiDebugData,
  AiMethod,
  ClinicalAssessment,
  TrainingManifest,
  TrainingProfile,
} from "@/types/doctor-ai";
import type { Patient } from "@/types/doctor-patients";

export const DEFAULT_ALTITUDE_METERS = 2500;

export function getTechnicalPrecision(
  assessment: ClinicalAssessment | null,
  training: TrainingProfile,
): number {
  if (!assessment) {
    return 0;
  }

  const datasetFactor = Math.min(
    1,
    Number(training.datasetPatients || 0) / 230,
  );

  const coverageFactor = Number(assessment.confidence || 0) / 100;

  return Math.round(
    (coverageFactor * 0.7 + datasetFactor * 0.3) * 100,
  );
}

export function getAiMethodStatusLabel(
  status: AiMethod["status"],
): string {
  switch (status) {
    case "active":
      return "Activa";

    case "proxy":
      return "Proxy clínico";

    case "planned":
      return "Pendiente";

    default:
      return "Informativa";
  }
}

export function getAiMethodTone(
  status: AiMethod["status"],
): string {
  switch (status) {
    case "active":
      return "active";

    case "proxy":
      return "proxy";

    case "planned":
      return "planned";

    default:
      return "info";
  }
}

export function formatDebugTimestamp(
  value?: string | Date | null,
): string {
  if (!value) {
    return "sin fecha";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  return String(value).trim() !== "";
}

function getCoverageFields(patient: Patient | null) {
  return [
    { label: "Documento", value: patient?.documentId },
    { label: "Edad", value: patient?.age },
    { label: "Saturación O2", value: patient?.oxygenSaturation },
    { label: "Frecuencia respiratoria", value: patient?.respiratoryRate },
    { label: "Pulso", value: patient?.pulse },
    { label: "Glucosa", value: patient?.glucose },
    { label: "Creatinina", value: patient?.creatinine },
    { label: "COPD GOLD", value: patient?.copdGold },
    { label: "Pack-years", value: patient?.packHistory },
    { label: "Ciudad clínica", value: patient?.locationCity },
    { label: "Altitud", value: patient?.locationElevationM },
    { label: "Antecedente cardiaco", value: patient?.heartFailureHistory },
    { label: "ECG", value: patient?.ecg },
    { label: "BNP", value: patient?.bnp },
    { label: "Antecedentes coronarios", value: patient?.coronaryHistory },
    { label: "Arritmias", value: patient?.arrhythmias },
    { label: "Estado clínico", value: patient?.status },
    { label: "Tabaquismo", value: patient?.smokingStatus },
    { label: "Hemoglobina", value: patient?.hemoglobin },
    { label: "IMC", value: patient?.bmi },
  ];
}

export interface BuildAiDebugDataDependencies {
  getRegionProfile: (
    city?: string,
  ) => {
    label?: string;
    altitude?: number;
    oxygenAdjustment?: number;
    airQualityIndex?: number;
  } | null;

  computeClinicalAssessment: (
    patient: Patient,
  ) => ClinicalAssessment;

  buildAiMethodRouting: (
    patient: Patient,
    assessment: ClinicalAssessment,
    region: ReturnType<
      BuildAiDebugDataDependencies["getRegionProfile"]
    >,
  ) => AiMethod[];

  buildClinicalForecast: (
    patient: Patient,
    assessment: ClinicalAssessment,
    region: ReturnType<
      BuildAiDebugDataDependencies["getRegionProfile"]
    >,
  ) => ClinicalAssessment["forecast"];
}

export function buildAiDebugData(
  patient: Patient | null,
  training: TrainingProfile,
  manifest: TrainingManifest,
  fallbackTrainingProfile: TrainingProfile,
  dependencies: BuildAiDebugDataDependencies,
): AiDebugData {
  const activeModel = manifest.activeModel ?? {};

  const candidateModels = Array.isArray(manifest.candidateModels)
    ? [...manifest.candidateModels]
    : [];

  const rankedCandidates = candidateModels
    .sort(
      (a, b) =>
        Number(b.combinedPrecision || 0) -
        Number(a.combinedPrecision || 0),
    )
    .slice(0, 5);

  const assessment = patient
    ? dependencies.computeClinicalAssessment(patient)
    : null;

  const region = patient
    ? dependencies.getRegionProfile(patient.locationCity)
    : null;

  const aiMethods =
    patient && assessment
      ? dependencies.buildAiMethodRouting(
          patient,
          assessment,
          region,
        )
      : [];

  const clinicalForecast =
    patient && assessment
      ? dependencies.buildClinicalForecast(
          patient,
          assessment,
          region,
        )
      : null;

  const precision = getTechnicalPrecision(
    assessment,
    training,
  );

  const modelPrecision = Number(
    activeModel.combinedPrecision ||
      training.selectedModelPrecision ||
      0,
  );

  const coverageFields = getCoverageFields(patient);

  const availableCoverageLabels = coverageFields
    .filter(({ value }) => hasValue(value))
    .map(({ label }) => label);

  const missingCoverageLabels = coverageFields
    .filter(({ value }) => !hasValue(value))
    .map(({ label }) => label);

  const foundCoverageCount =
    availableCoverageLabels.length;

  const totalCoverageCount =
    coverageFields.length;

  const locationSummary = Object.entries(
    training.locationCounts || {},
  )
    .slice(0, 4)
    .map(
      ([location, count]) =>
        `${location}: ${count}`,
    )
    .join(" | ");

  const triagePrecision = Number(
    activeModel.triage?.precision_weighted ||
      training.triagePrecision ||
      0,
  );

  const hospitalizationPrecision = Number(
    activeModel.hospitalization?.precision_weighted ||
      training.hospitalizationPrecision ||
      0,
  );

  const generatedAt = manifest.generatedAt || "";

  const generatedAtLabel =
    formatDebugTimestamp(generatedAt);

  const manifestFreshnessMinutes = manifest.generatedAt
    ? Math.max(
        0,
        Math.round(
          (Date.now() -
            new Date(manifest.generatedAt).getTime()) /
            60000,
        ),
      )
    : null;

  const datasetSplit =
    manifest.datasetSplit ||
    training.datasetSplit || {
      train: 70,
      validation: 15,
      test: 15,
    };

  const crossValidation =
    manifest.crossValidation ||
    training.crossValidation ||
    {};

  const validationSummary =
    manifest.riskMathValidation?.summary ||
    "Sin bloque de validación heurística en el manifiesto actual.";

  const modelTarget = Number(
    training.minimumPrecisionTarget || 90,
  );

  const modelName =
    training.selectedModelName ||
    (training.ready
      ? "Foxcat Explainable Heuristic v1 - calibración local COPD"
      : "Foxcat Explainable Heuristic v1 - perfil base de respaldo");

  const baseLocation =
    training.baseLocation || "Barcelona";

  const patientSignalLines = patient
    ? [
        `Documento: ${patient.documentId || "sin dato"}`,
        `Estado actual: ${patient.status || "sin dato"}`,
        `Ciudad: ${
          region?.label ||
          patient.locationCity ||
          baseLocation
        }`,
        `Servicio / cama: ${
          patient.ward || "sin dato"
        } / ${patient.room || "sin dato"}`,
        `Condición principal: ${
          patient.condition || "sin dato"
        }`,
      ]
    : [
        "Selecciona un paciente para ver la señal clínica completa del turno.",
      ];

  return {
    assessment,

    precision,
    modelPrecision,
    modelTarget,

    modelStatus:
      modelPrecision >= modelTarget
        ? "Cumple mínimo"
        : "Debajo del mínimo",

    foundCoverageCount,
    totalCoverageCount,

    availableCoverageLabels,
    missingCoverageLabels,

    modelName,

    generatedAt,
    generatedAtLabel,
    manifestFreshnessMinutes,

    selectedMetric:
      manifest.selectedMetric ||
      "combined_precision_weighted",

    datasetSplit,
    crossValidation,

    modelAdjusted: Boolean(activeModel.adjusted),

    modelArtifacts:
      activeModel.artifacts || {},

    modelArtifactsCount: Object.values(
      activeModel.artifacts || {},
    ).filter(Boolean).length,

    triageMetrics: activeModel.triage || {},
    hospitalizationMetrics:
      activeModel.hospitalization || {},

    triagePrecision,
    hospitalizationPrecision,

    combinedAucRoc: Number(
      activeModel.combinedAucRoc || 0,
    ),

    candidateCount: candidateModels.length,
    rankedCandidates,

    riskMathValidation:
      manifest.riskMathValidation || undefined,

    validationSummary,

    calibrationMode:
      training.calibrationMode ||
      (training.ready
        ? "Calibración estadística local"
        : "Perfil base local"),

    trainingReady: Boolean(training.ready),

    retrainedWithAdjustments: Boolean(
      training.retrainedWithAdjustments,
    ),

    trainingSummary: training.ready
      ? `Training.py cargó ${
          training.datasetPatients
        } registros desde ${
          training.sourceFiles?.join(" + ") ||
          "dataset local"
        } con split ${datasetSplit.train}% train / ${
          datasetSplit.validation
        }% validation / ${
          datasetSplit.test
        }% test. Modelo activo: ${
          training.selectedModelName ||
          "sin nombre"
        } con precisión combinada ${
          training.selectedModelPrecision ||
          precision
        }%.`
      : "No hubo entrenamiento en tiempo real. El motor usa un perfil base de respaldo con medias predefinidas.",

    sourceFiles:
      training.sourceFiles || ["Dataset local"],

    sampleRows:
      training.sampleRows?.length
        ? training.sampleRows
        : fallbackTrainingProfile.sampleRows || [],

    locationSummary:
      locationSummary || "Barcelona: 230",

    datasetPatients: Number(
      training.datasetPatients || 0,
    ),

    baseLocation,

    meanAge: Number(training.meanAge || 0),
    meanOxygen: Number(training.meanOxygen || 0),
    meanRespRate: Number(
      training.meanRespRate || 0,
    ),
    meanAltitude: Number(
      training.meanAltitude ||
        DEFAULT_ALTITUDE_METERS,
    ),

    heartFailureRate: Math.round(
      Number(training.heartFailureRate || 0) *
        100,
    ),

    smokingExposureRate: Math.round(
      Number(training.smokingExposureRate || 0) *
        100,
    ),

    goldHighRate: Math.round(
      Number(training.goldHighRate || 0) * 100,
    ),

    respiratoryFailureRate: Math.round(
      Number(training.respiratoryFailureRate || 0) *
        100,
    ),

    cardiacFailureRate: Math.round(
      Number(training.cardiacFailureRate || 0) *
        100,
    ),

    dangerousSymptomRate: Math.round(
      Number(training.dangerousSymptomRate || 0) *
        100,
    ),

    patientSignalLines,

    activeVariables: [
      `Edad actual: ${patient?.age || "sin dato"}`,
      `Saturación O2: ${
        patient?.oxygenSaturation || "sin dato"
      }%`,
      `Frecuencia respiratoria: ${
        patient?.respiratoryRate || "sin dato"
      } rpm`,
      `Pulso: ${patient?.pulse || "sin dato"} bpm`,
      `Pack-years: ${
        patient?.packHistory || "sin dato"
      }`,
      `Glucosa: ${
        patient?.glucose || "sin dato"
      } mg/dL`,
      `Creatinina: ${
        patient?.creatinine || "sin dato"
      } mg/dL`,
      `COPD GOLD: ${
        patient?.copdGold || "sin dato"
      }`,
      `Tabaquismo: ${
        patient?.smokingStatus || "sin dato"
      }`,
      `Falla cardiaca: ${
        patient?.heartFailureHistory || "sin dato"
      }`,
      `Región activa: ${
        region?.label || baseLocation
      }`,
      `AQI regional: ${
        region?.airQualityIndex || "sin dato"
      }`,
      `Altitud regional: ${
        region?.altitude || "sin dato"
      } m`,
    ],

    aiMethods,

    activeAiMethods: aiMethods.filter(
      (item) => item.status === "active",
    ),

    proxyAiMethods: aiMethods.filter(
      (item) => item.status === "proxy",
    ),

    pendingAiMethods: aiMethods.filter(
      (item) => item.status === "planned",
    ),

    clinicalForecast,

    mathLines: assessment
      ? [
          `O2 esperada = max(88, ${training.meanOxygen.toFixed(
            1,
          )} - ajusteRegional ${
            region?.oxygenAdjustment || 0
          }) = ${Math.round(
            assessment.expectedOxygen,
          )}%`,

          `Riesgo 24h = base + estado + oxigenación + FR + pulso + glucosa + creatinina + COPD + tabaquismo + falla cardiaca + altitud`,

          `Confianza de entrada = variables presentes / variables evaluadas = ${assessment.confidence}%`,

          `Cobertura del paciente = ${foundCoverageCount}/${totalCoverageCount} datos relevantes detectados en la última revisión`,

          `Precisión técnica estimada = 0.7 * confianza + 0.3 * coberturaDataset = ${precision}%`,

          `Subriesgos: respiratorio ${
            assessment.outcomeRisks?.respiratory || 0
          }% | cardiaco ${
            assessment.outcomeRisks?.cardiac || 0
          }% | síntoma peligroso ${
            assessment.outcomeRisks
              ?.dangerousSymptom || 0
          }%`,

          `Modelo seleccionado = ${
            training.selectedModelName ||
            "sin nombre"
          } con ${modelPrecision}% sobre mínimo ${modelTarget}%`,

          `Pronóstico sin tratamiento = ${
            clinicalForecast?.horizon ||
            "sin ventana"
          } -> ${
            clinicalForecast?.deterioration ||
            "sin deterioro estimado"
          }`,
        ]
      : [
          "Selecciona un paciente para ver la matemática aplicada por el motor heurístico.",
        ],

    processLog: assessment
      ? [
          "1. Leer paciente seleccionado desde Firestore sincronizado.",
          `2. Normalizar ciudad y cargar perfil regional de ${
            region?.label || baseLocation
          }.`,
          `3. Ajustar por altitud ${
            region?.altitude ||
            DEFAULT_ALTITUDE_METERS
          } m y carga tabáquica ${
            patient?.packHistory || 0
          } pack-years.`,
          `4. Comparar saturación observada (${
            patient?.oxygenSaturation ||
            "sin dato"
          }%) con saturación esperada (${Math.round(
            assessment.expectedOxygen,
          )}%).`,
          "5. Calcular subriesgos respiratorio, cardiaco y de síntoma peligroso antes de consolidar ventanas temporales.",
          `6. Orquestar métodos IA del caso (${
            aiMethods.filter(
              (item) => item.status !== "planned",
            ).length
          } activos/proxy) y generar recomendaciones con ${
            assessment.triggers.length
          } detonantes activos.`,
        ]
      : [
          "1. Esperando paciente activo.",
          "2. El panel mostrará trazas y variables cuando haya un caso seleccionado.",
        ],

    triggerLines:
      assessment?.triggers?.length
        ? assessment.triggers
        : [
            "Sin detonantes visibles hasta seleccionar un paciente.",
          ],

    recommendationLines:
      assessment?.recommendations?.length
        ? assessment.recommendations
        : [
            "Sin recomendaciones visibles hasta seleccionar un paciente.",
          ],
  };
}