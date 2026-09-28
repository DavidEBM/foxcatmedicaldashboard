import type {
  ClinicalAssessment,
  WorkspacePatient,
} from "@/types/doctor-workspace";

export function summarizeDay(
  patients: WorkspacePatient[],
  selectedPatient: WorkspacePatient | null,
  getRiskScore: (patient: WorkspacePatient) => number,
  trainingReady: boolean
) {
  const riskHigh = patients.filter(
    (patient) => getRiskScore(patient) >= 5
  ).length;

  return {
    activePatients: patients.length,
    highPriority: riskHigh,
    currentPatient: selectedPatient?.name ?? "Sin paciente seleccionado",
    trainingStatus: trainingReady
      ? "Calibrado con dataset local."
      : "Usando perfil base de respaldo.",
  };
}

export function getScheduledPatients(
  patients: WorkspacePatient[]
): WorkspacePatient[] {
  return patients
    .filter(
      (patient) =>
        patient.appointmentTime ||
        patient.monitoringTime ||
        patient.labTime
    )
    .sort((a, b) =>
      (a.appointmentTime ?? "99:99").localeCompare(
        b.appointmentTime ?? "99:99"
      )
    );
}

export function getLabsOverview(
  patients: WorkspacePatient[],
  getRiskScore: (patient: WorkspacePatient) => number
): WorkspacePatient[] {
  return patients
    .filter(
      (patient) =>
        patient.glucose ||
        patient.creatinine ||
        patient.oxygenSaturation ||
        patient.respiratoryRate
    )
    .sort((a, b) => getRiskScore(b) - getRiskScore(a))
    .slice(0, 6);
}

export function getRemoteMonitoringPatients(
  patients: WorkspacePatient[],
  getRiskScore: (patient: WorkspacePatient) => number
): WorkspacePatient[] {
  return patients.filter((patient) => getRiskScore(patient) >= 4);
}

export function buildCarePlan(
  patient: WorkspacePatient | null,
  assessment: ClinicalAssessment | null
) {
  if (!patient || !assessment) {
    return null;
  }

  return {
    patientName: patient.name,
    recommendations: assessment.recommendations,
    risks: {
      short: assessment.shortRisk,
      week: assessment.weekRisk,
      long: assessment.longRisk,
    },
  };
}