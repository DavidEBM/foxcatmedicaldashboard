import type { Patient } from "@/types/doctor-patients";
import type {
  PatientExportMapper,
  PatientExportRow,
} from "@/types/doctor-export";

export const mapPatientToExportRow: PatientExportMapper = (
  patient
): PatientExportRow => ({
  Nombre: patient.name,
  Documento: patient.documentId,
  Edad: patient.age,
  Condicion: patient.condition,
  Estado: patient.status,
  Ciudad: patient.locationCity,
  Area: patient.ward,
  Habitacion: patient.room,
  PresionSistolica: patient.bloodPressureSystolic,
  PresionDiastolica: patient.bloodPressureDiastolic,
  Pulso: patient.pulse,
  Glucosa: patient.glucose,
  SaturacionO2: patient.oxygenSaturation,
  FrecuenciaRespiratoria: patient.respiratoryRate,
  PackYears: patient.packHistory,
  Hemoglobina: patient.hemoglobin,
  Creatinina: patient.creatinine,
  BMI: patient.bmi,
  COPD_GOLD: patient.copdGold,
  Tabaquismo: patient.smokingStatus,
  FallaCardiaca: patient.heartFailureHistory,
  ECG: patient.ecg,
  BNP: patient.bnp,
  AntecedentesCoronarios: patient.coronaryHistory,
  Arritmias: patient.arrhythmias,
  Altitud_msnm: patient.locationElevationM,
  Consulta: patient.appointmentTime,
  Monitoreo: patient.monitoringTime,
  Laboratorio: patient.labTime,
  Notas: patient.notes,
  Foto: patient.photoUrl,
});

export function buildSelectedPatientRows(
  patient: Patient
): PatientExportRow[] {
  return [mapPatientToExportRow(patient)];
}

export function buildAllPatientRows(
  patients: Patient[]
): PatientExportRow[] {
  return patients.map(mapPatientToExportRow);
}

export function getSelectedPatientFilename(
  patient: Patient
): string {
  return `paciente-${patient.documentId || patient.id}.xlsx`;
}

export const ALL_PATIENTS_FILENAME = "pacientes-foxcat.xlsx";