import type { Patient } from "@/types/doctor-patients";
import type {
  ClinicalAlert,
  ClinicalAssessment,
} from "@/types/doctor-clinical";
import { normalizeOxygenValue } from "@/lib/doctor/doctor-utils";

export function buildAlerts(
  patient: Patient | null,
  assessment: ClinicalAssessment | null,
): ClinicalAlert[] {
  if (!patient) {
    return [
      {
        tone: "soft",
        text: "Selecciona un paciente para calcular alertas.",
      },
    ];
  }

  const alerts: ClinicalAlert[] = [];
  const oxygen = normalizeOxygenValue(patient.oxygenSaturation);

  if (patient.status === "Critico") {
    alerts.push({
      tone: "critical",
      text: "Estado critico. Priorizar valoracion inmediata.",
    });
  }

  if (oxygen !== null && oxygen < 92) {
    alerts.push({
      tone: "critical",
      text: `Saturacion de O2 comprometida: ${oxygen}%.`,
    });
  }

  if ((patient.glucose ?? 0) >= 200) {
    alerts.push({
      tone: "warning",
      text: `Glucosa elevada: ${patient.glucose} mg/dL.`,
    });
  }

  if ((patient.pulse ?? 0) >= 100) {
    alerts.push({
      tone: "warning",
      text: `Pulso acelerado: ${patient.pulse} bpm.`,
    });
  }

  if ((patient.respiratoryRate ?? 0) >= 24) {
    alerts.push({
      tone: "warning",
      text: `Frecuencia respiratoria alta: ${patient.respiratoryRate} rpm.`,
    });
  }

  if (
    (patient.bloodPressureSystolic ?? 0) >= 150 ||
    (patient.bloodPressureDiastolic ?? 0) >= 95
  ) {
    alerts.push({
      tone: "warning",
      text: `Presion alta: ${patient.bloodPressureSystolic}/${patient.bloodPressureDiastolic}.`,
    });
  }

  if ((patient.bnp ?? 0) >= 400) {
    alerts.push({
      tone: (patient.bnp ?? 0) >= 900 ? "critical" : "warning",
      text: `BNP elevado: ${patient.bnp} pg/mL.`,
    });
  }

  if (patient.arrhythmias === "Si") {
    alerts.push({
      tone: "warning",
      text: "Arritmias registradas: vigilar ritmo y sintomas asociados.",
    });
  }

  if (
    patient.ecg &&
    !String(patient.ecg).toLowerCase().includes("normal")
  ) {
    alerts.push({
      tone: "warning",
      text: `ECG con hallazgo: ${patient.ecg}.`,
    });
  }

  const respiratoryRisk = assessment?.outcomeRisks.respiratory ?? 0;
  const cardiacRisk = assessment?.outcomeRisks.cardiac ?? 0;
  const symptomRisk = assessment?.outcomeRisks.dangerousSymptom ?? 0;

  if (respiratoryRisk >= 70) {
    alerts.push({
      tone: "critical",
      text: `Riesgo respiratorio alto: ${respiratoryRisk}%.`,
    });
  }

  if (cardiacRisk >= 70) {
    alerts.push({
      tone: "warning",
      text: `Riesgo cardiaco relevante: ${cardiacRisk}%.`,
    });
  }

  if (symptomRisk >= 70) {
    alerts.push({
      tone: "warning",
      text: `Riesgo de nuevo sintoma peligroso: ${symptomRisk}%.`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      tone: "success",
      text: "Paciente estable. No hay alertas mayores activas.",
    });
  }

  return alerts;
}