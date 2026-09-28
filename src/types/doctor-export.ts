import type { Patient } from "@/types/doctor-patients";

export interface PatientExportRow {
  [key: string]: unknown;
  Nombre: string;
  Documento: string;
  Edad: unknown;
  Condicion: string;
  Estado: string;
  Ciudad: string;
  Area: string;
  Habitacion: string;
  PresionSistolica: unknown;
  PresionDiastolica: unknown;
  Pulso: unknown;
  Glucosa: unknown;
  SaturacionO2: unknown;
  FrecuenciaRespiratoria: unknown;
  PackYears: unknown;
  Hemoglobina: unknown;
  Creatinina: unknown;
  BMI: unknown;
  COPD_GOLD: unknown;
  Tabaquismo: string;
  FallaCardiaca: unknown;
  ECG: string;
  BNP: unknown;
  AntecedentesCoronarios: unknown;
  Arritmias: unknown;
  Altitud_msnm: unknown;
  Consulta: string;
  Monitoreo: string;
  Laboratorio: string;
  Notas: string;
  Foto: string;
}

export type PatientExportMode = "selected" | "all";

export type PatientExportMapper = (
  patient: Patient
) => PatientExportRow;