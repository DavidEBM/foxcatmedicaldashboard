import type { Patient } from "@/types/doctor-patients";
import type {
  DashboardPatientStats,
} from "@/types/doctor-dashboard";

export function getDashboardPatientStats(
  patients: Patient[],
  getRiskScore: (patient: Patient) => number
): DashboardPatientStats {
  const riskPatients = patients.filter(
    (patient) => getRiskScore(patient) >= 5
  ).length;

  const areas = [
    ...new Set(
      patients
        .map((patient) => patient.ward)
        .filter(Boolean)
    ),
  ].slice(0, 3);

  return {
    totalPatients: patients.length,
    riskPatients,
    areas,
  };
}