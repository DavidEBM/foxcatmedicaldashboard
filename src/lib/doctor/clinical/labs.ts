import type { Patient } from "@/types/doctor-patients";
import type { ClinicalLabItem } from "@/types/doctor-clinical";

export function buildLabs(patient: Patient | null): ClinicalLabItem[] {
  const value = (input: unknown, suffix = "") =>
    input !== undefined && input !== null && input !== ""
      ? `${input}${suffix}`
      : "No registrado";

  return [
    { label: "Glucosa", value: value(patient?.glucose, " mg/dL") },
    { label: "Hemoglobina", value: value(patient?.hemoglobin, " g/dL") },
    { label: "Creatinina", value: value(patient?.creatinine, " mg/dL") },
    { label: "BNP", value: value(patient?.bnp, " pg/mL") },
    { label: "ECG", value: value(patient?.ecg) },
    { label: "Saturación O₂", value: value(patient?.oxygenSaturation, "%") },
  ];
}
