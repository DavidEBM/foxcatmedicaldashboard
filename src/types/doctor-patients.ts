export type PatientStatus =
  | "Estable"
  | "Riesgo"
  | "Critico";

export type SmokingStatus =
  | "Nunca"
  | "Exfumador"
  | "Activo"
  | "Alta carga"
  | "No Presenta"
  | "";

export type PatientStatusClass =
  | "stable"
  | "warning"
  | "critical"
  | "neutral";

export interface Patient {
  id: string;

  name: string;
  documentId: string;
  age: number;
  condition: string;

  status: PatientStatus;
  statusClass: PatientStatusClass;

  photoUrl: string;

  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  pulse: number;
  glucose: number;

  oxygenSaturation: number;
  respiratoryRate: number;

  hemoglobin: number;
  creatinine: number;
  bmi: number;

  packHistory: number;
  copdGold: number;
  copdConfirmed: string;
  smokingStatus: SmokingStatus;

  heartFailureHistory: string;
  coronaryHistory: string;
  arrhythmias: string;

  ecg: string;
  bnp: number;

  locationCity: string;
  locationElevationM: number;
  locationRiskLevel: number;

  ward: string;
  room: string;

  appointmentTime: string;
  monitoringTime: string;
  labTime: string;

  notes: string;

  createdBy: string;
  assignedDoctorIds: string[];

  createdAt?: unknown;
  updatedAt?: unknown;
  lastConsultationAt?: unknown;
}

export interface PatientFormValues {
  name: string;
  documentId: string;
  age: string;
  condition: string;
  status: PatientStatus | "";
  photoUrl: string;
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  pulse: string;
  glucose: string;
  oxygenSaturation: string;
  respiratoryRate: string;
  hemoglobin: string;
  creatinine: string;
  bmi: string;
  packHistory: string;
  copdGold: string;
  copdConfirmed: string;
  smokingStatus: SmokingStatus;
  heartFailureHistory: string;
  ecg: string;
  bnp: string;
  coronaryHistory: string;
  arrhythmias: string;
  locationCity: string;
  ward: string;
  room: string;
  appointmentTime: string;
  monitoringTime: string;
  labTime: string;
  notes: string;
  photoFile: File | null;
}
