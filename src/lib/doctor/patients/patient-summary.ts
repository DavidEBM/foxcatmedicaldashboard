import type {
  Patient,
} from "@/types/doctor-patients";

import type {
  ConsultationAnalysis,
} from "@/types/doctor-analysis";

export type BuildConsultationAnalysis =
  (
    patient: Patient
  ) => ConsultationAnalysis | null;

export function buildPatientFacingSummary(
  patient: Patient,
  buildConsultationAnalysis: BuildConsultationAnalysis
): string {
  const summary =
    buildConsultationAnalysis(
      patient
    );

  if (!summary) {
    return "";
  }

  return [
    `Paciente: ${patient.name}.`,
    `Resumen: ${summary.importantSummary}`,
    `Riesgo en el tiempo: ${summary.timeline.summary}`,
    `Recomendaciones principales: ${summary.conciseRecommendations.join(" ")}`,
    `Seguimiento: ${summary.lowRiskWindow}`,
    `Atención: si no sigues las recomendaciones, ${summary.dangerStart}.`,
  ].join(" ");
}