import type { Patient } from "@/types/doctor-patients";

export function getPatientRiskScore(
  patient: Patient
): number {
  const score =
    (patient.oxygenSaturation < 92 ? 3 : 0) +
    (patient.respiratoryRate >= 22 ? 2 : 0) +
    (patient.pulse >= 100 ? 1 : 0) +
    (patient.bloodPressureSystolic >= 140 ? 1 : 0);

  // misma lógica actual
  // ...
  
  return score;
}

export function getRiskFrontLabel(
  type: string
): string {
  switch (type) {
    case "respiratory":
      return "respiratorio";

    case "cardiac":
      return "cardiopulmonar";

    case "dangerousSymptom":
      return "de síntomas de alarma";

    default:
      return "clínico";
  }
}
