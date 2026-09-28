import type { Patient } from "@/types/doctor-patients";
import type { DoctorProfile } from "@/types/doctor";
import type { UserLayout } from "@/types/doctor-layout";

export interface TrainingProfile {
  ready: boolean;
  selectedModelName: string;
  selectedModelPrecision: number;
  triagePrecision?: number;
  hospitalizationPrecision?: number;
  minimumPrecisionTarget?: number;
  calibrationMode?: string;
  [key: string]: unknown;
}

export interface TrainingManifest {
  trainingProfile?: Partial<TrainingProfile>;
  activeModel?: {
    name: string;
    combinedPrecision: number;
    triage?: {
      precision_weighted?: number;
    };
    hospitalization?: {
      precision_weighted?: number;
    };
  };
  minimumPrecisionTarget?: number;
  [key: string]: unknown;
}

export interface DoctorDashboardState {
  patients: Patient[];
  selectedPatientId: string | null;
  doctorProfile: DoctorProfile;
  trainingProfile: TrainingProfile;
  trainingManifest: TrainingManifest | null;
  layout: Partial<UserLayout> | null;
}

export interface DashboardPatientStats {
  totalPatients: number;
  riskPatients: number;
  areas: string[];
}