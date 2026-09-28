import type { Patient } from "@/types/doctor-patients";
import type { ClinicalLabItem } from "@/types/doctor-clinical";

export function buildLabs(patient: Patient | null): ClinicalLabItem[] {
  if (!patient) {
    return [
      { label: "Glucosa", value: "Sin dato" },
      { label: "Saturacion O2", value: "Sin dato" },
      { label: "Creatinina", value: "Sin dato" },
      { label: "ECG", value: "Sin dato" },
      { label: "BNP", value: "Sin dato" },
    ];
  }

  return [
    {
      label: "Glucosa",
      value: patient.glucose
        ? `${patient.glucose} mg/dL`
        : "No registrada",
    },
    {
      label: "Saturacion O2",
      value: patient.oxygenSaturation
        ? `${patient.oxygenSaturation}%`
        : "No registrada",
    },
    {
      label: "Creatinina",
      value: patient.creatinine
        ? `${patient.creatinine} mg/dL`
        : "No registrada",
    },
    {
      label: "Pulso",
      value: patient.pulse
        ? `${patient.pulse} bpm`
        : "No registrado",
    },
    {
      label: "Presion sistolica",
      value: patient.bloodPressureSystolic
        ? `${patient.bloodPressureSystolic} mmHg`
        : "No registrada",
    },
    {
      label: "ECG",
      value: patient.ecg || "No registrado",
    },
    {
      label: "BNP",
      value: patient.bnp
        ? `${patient.bnp} pg/mL`
        : "No registrado",
    },
    {
      label: "Antecedentes coronarios",
      value: patient.coronaryHistory || "No registrado",
    },
    {
      label: "Arritmias",
      value: patient.arrhythmias || "No registrado",
    },
  ];
}