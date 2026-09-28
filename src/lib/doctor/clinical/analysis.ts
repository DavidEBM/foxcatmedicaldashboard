import type {
  ClinicalAssessment,
  ConsultationAnalysis,
} from "@/types/doctor-clinical";
import type { Patient } from "@/types/doctor-patients";
import {
  buildConsultationTimeline,
  getConsultationLowRiskWindow,
} from "./forecast";
import { riskTone } from "./risk";

export function buildConsultationAnalysis(
  patient: Patient,
  assessment: ClinicalAssessment,
): ConsultationAnalysis {
  const futureEffects: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (
    patient.oxygenSaturation &&
    patient.oxygenSaturation >=
      Math.round(assessment.expectedOxygen)
  ) {
    strengths.push(
      `Oxigenacion conservada frente a referencia esperada (${patient.oxygenSaturation}% vs ${Math.round(assessment.expectedOxygen)}%).`,
    );
  }

  if (patient.status === "Estable") {
    strengths.push(
      "Estado clinico actual reportado como estable.",
    );
  }

  if (patient.glucose && patient.glucose < 180) {
    strengths.push(
      "Control metabolico sin senal severa inmediata.",
    );
  }

  if (patient.pulse && patient.pulse < 100) {
    strengths.push(
      `Pulso sin taquicardia marcada (${patient.pulse} bpm).`,
    );
  }

  if (
    patient.respiratoryRate &&
    patient.respiratoryRate < 24
  ) {
    strengths.push(
      `Frecuencia respiratoria dentro de margen no critico (${patient.respiratoryRate} rpm).`,
    );
  }

  if (assessment.outcomeRisks.respiratory >= 60) {
    weaknesses.push(
      `Fragilidad respiratoria relevante (${assessment.outcomeRisks.respiratory}%).`,
    );

    futureEffects.push(
      "Puede progresar a desaturacion sostenida, mayor trabajo ventilatorio y agotamiento respiratorio.",
    );
  }

  if (assessment.outcomeRisks.cardiac >= 55) {
    weaknesses.push(
      `Carga cardiopulmonar importante (${assessment.outcomeRisks.cardiac}%).`,
    );

    futureEffects.push(
      "Puede aumentar la probabilidad de inestabilidad hemodinamica o descompensacion cardiaca.",
    );
  }

  if (
    assessment.outcomeRisks.dangerousSymptom >= 55
  ) {
    weaknesses.push(
      `Riesgo de cambio clinico sintomatico (${assessment.outcomeRisks.dangerousSymptom}%).`,
    );

    futureEffects.push(
      "Puede aparecer disnea subjetiva mayor, secreciones problematicas o intolerancia al esfuerzo.",
    );
  }

  if (Number(patient.packHistory || 0) >= 40) {
    weaknesses.push(
      `Historial tabaquico acumulado alto (${patient.packHistory} paquetes-año).`,
    );
  }

  if (patient.heartFailureHistory === "Si") {
    weaknesses.push(
      "Antecedente de falla cardiaca que eleva el riesgo global.",
    );
  }

  if (Number(patient.copdGold || 0) >= 3) {
    weaknesses.push(
      `EPOC avanzado (${patient.copdGold}).`,
    );
  }

  const timeline =
    buildConsultationTimeline(assessment);

  const conciseRecommendations =
    assessment.recommendations.slice(0, 3);

  const dangerStart =
    assessment.shortRisk >= 70
      ? "el riesgo ya es alto en menos de 24 horas"
      : assessment.shortRisk >= 45
        ? "puede volverse peligroso dentro de 24 horas"
        : assessment.weekRisk >= 55
          ? "puede escalar a un nivel preocupante hacia 7 dias"
          : "el mayor riesgo apareceria hacia el seguimiento de 30 dias";

  return {
    assessment,

    headline: `${patient.name} presenta un frente ${getRiskFrontLabel(
      assessment.dominantRiskType,
    )} con riesgo ${riskTone(
      assessment.shortRisk,
    ).toLowerCase()} en las proximas 24 horas.`,

    importantSummary: assessment.summary,

    strengths: strengths.length
      ? strengths.slice(0, 3)
      : [
          "No hay fortalezas clínicas dominantes claramente marcadas; conviene leer el caso de forma conservadora.",
        ],

    weaknesses: weaknesses.length
      ? weaknesses.slice(0, 4)
      : [
          "No se detectan debilidades mayores fuera de la vigilancia rutinaria actual.",
        ],

    conciseRecommendations,

    lowRiskWindow:
      getConsultationLowRiskWindow(assessment),

    dangerStart,

    futureEffects: futureEffects.length
      ? futureEffects.slice(0, 3)
      : [
          "Si mantiene adherencia y control, el riesgo futuro inmediato no muestra una progresión dominante.",
        ],

    timeline,
  };
}

function getRiskFrontLabel(
  riskType: ClinicalAssessment["dominantRiskType"],
): string {
  switch (riskType) {
    case "respiratory":
      return "respiratorio";

    case "cardiac":
      return "cardiaco";

    case "dangerousSymptom":
      return "sintomatico";

    default:
      return "clinico";
  }
}