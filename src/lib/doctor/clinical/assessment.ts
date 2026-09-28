import type { Patient } from "@/types/doctor-patients";
import type {
  ClinicalAssessment,
  RegionProfile,
  TrainingManifest,
  TrainingProfile,
} from "@/types/doctor-clinical";
import { buildClinicalForecast } from "./forecast";
import { buildAiMethodRouting } from "./methods";

const DEFAULT_REGION: RegionProfile = {
  label: "Contexto regional no especificado",
  altitude: 0,
  oxygenAdjustment: 0,
  respiratoryStress: 0,
  accessPressure: 0,
  airQualityIndex: 0,
  temperatureC: 20,
  humidity: 50,
  climate: "No especificado",
  careFocus: "Seguimiento clínico habitual",
  recommendationFocus: "Verificar los datos clínicos disponibles",
};

function clampRisk(value: number): number {
  return Math.max(0, Math.min(99, Math.round(value)));
}

/**
 * Evaluación heurística local para completar las vistas clínicas cuando
 * no hay un servicio de evaluación disponible. No sustituye el juicio médico.
 */
export function computeClinicalAssessment(
  patient: Patient,
  trainingProfile: TrainingProfile,
  trainingManifest: TrainingManifest | null = null,
): ClinicalAssessment {
  const oxygen = Number(patient.oxygenSaturation || 0);
  const respiratoryRate = Number(patient.respiratoryRate || 0);
  const pulse = Number(patient.pulse || 0);
  const systolic = Number(patient.bloodPressureSystolic || 0);
  const base =
    (oxygen > 0 && oxygen < 92 ? 28 : oxygen > 0 && oxygen < 95 ? 12 : 0) +
    (respiratoryRate >= 24 ? 24 : respiratoryRate >= 22 ? 14 : respiratoryRate >= 20 ? 6 : 0) +
    (pulse >= 120 ? 16 : pulse >= 100 ? 10 : 0) +
    (systolic >= 180 || (systolic > 0 && systolic < 90) ? 20 : systolic >= 150 ? 8 : 0) +
    (patient.status === "Critico" ? 30 : patient.status === "Riesgo" ? 12 : 0);

  const shortRisk = clampRisk(base);
  const weekRisk = clampRisk(Math.max(shortRisk, shortRisk + 8));
  const longRisk = clampRisk(Math.max(weekRisk, weekRisk + 8));
  const outcomeRisks = {
    respiratory: clampRisk((oxygen > 0 && oxygen < 92 ? 35 : 8) + (respiratoryRate >= 22 ? 22 : 0)),
    cardiac: clampRisk((patient.heartFailureHistory === "Si" ? 28 : 8) + (pulse >= 100 ? 12 : 0) + (systolic >= 150 ? 12 : 0)),
    dangerousSymptom: clampRisk((shortRisk * 0.7) + (patient.status === "Critico" ? 18 : 0)),
  };
  const dominantRiskType: ClinicalAssessment["dominantRiskType"] =
    outcomeRisks.respiratory >= outcomeRisks.cardiac && outcomeRisks.respiratory >= outcomeRisks.dangerousSymptom
      ? "respiratory"
      : outcomeRisks.cardiac >= outcomeRisks.dangerousSymptom
        ? "cardiac"
        : "dangerousSymptom";

  const triggers: string[] = [];
  if (oxygen > 0 && oxygen < 92) triggers.push(`Saturación de oxígeno reducida: ${oxygen}%.`);
  if (respiratoryRate >= 22) triggers.push(`Frecuencia respiratoria elevada: ${respiratoryRate} rpm.`);
  if (pulse >= 100) triggers.push(`Pulso elevado: ${pulse} bpm.`);
  if (patient.status === "Critico") triggers.push("Estado crítico registrado en la ficha.");

  const recommendations = triggers.length
    ? ["Revisar las señales clínicas y confirmar los valores registrados.", "Priorizar valoración clínica según el protocolo del equipo tratante."]
    : ["Continuar el seguimiento habitual y actualizar los datos clínicos cuando corresponda."];
  const confidence = Math.max(0, Math.min(100, 50 + [oxygen, respiratoryRate, pulse, systolic].filter((value) => value > 0).length * 10));
  const region: RegionProfile = {
    ...DEFAULT_REGION,
    label: patient.locationCity || DEFAULT_REGION.label,
    altitude: patient.locationElevationM || 0,
    respiratoryStress: patient.locationRiskLevel || 0,
  };
  const partialAssessment: ClinicalAssessment = {
    region,
    shortRisk,
    weekRisk,
    longRisk,
    outcomeRisks,
    dominantRiskType,
    confidence,
    expectedOxygen: Math.max(85, Math.min(98, Number(trainingProfile.meanOxygen || 95) - (region.altitude > 2000 ? 2 : 0))),
    environmentalSummary: `Contexto registrado: ${region.label}.`,
    summary: `Estimación heurística local: riesgo ${shortRisk}% en 24 horas, ${weekRisk}% a 7 días y ${longRisk}% a 30 días. Esta estimación no sustituye una valoración médica.`,
    triggers,
    keyFindings: triggers.length ? triggers : ["No se detectan señales de alerta en los datos disponibles."],
    recommendations,
    forecast: {
      horizon: "Seguimiento ordinario",
      deterioration: "No se identifica una progresión dominante con los datos disponibles.",
      watchSignal: "Vigilar cambios clínicos y completar datos faltantes.",
      ifUntreated: "La evolución debe reevaluarse según criterio del equipo tratante.",
    },
    aiMethods: [],
  };

  partialAssessment.forecast = buildClinicalForecast(patient, partialAssessment, region);
  partialAssessment.aiMethods = buildAiMethodRouting(
    patient,
    partialAssessment,
    region,
    trainingProfile,
    trainingManifest,
  );

  return partialAssessment;
}
