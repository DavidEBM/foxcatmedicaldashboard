import type { Patient, PatientFormValues } from "@/types/doctor-patients";

export function getInitialPatientFormValues(patient?: Partial<Patient>): PatientFormValues {
  return {
    name: patient?.name ?? "", documentId: patient?.documentId ?? "",
    age: patient?.age?.toString() ?? "", condition: patient?.condition ?? "",
    status: patient?.status ?? "", photoUrl: patient?.photoUrl ?? "",
    bloodPressureSystolic: patient?.bloodPressureSystolic?.toString() ?? "",
    bloodPressureDiastolic: patient?.bloodPressureDiastolic?.toString() ?? "",
    pulse: patient?.pulse?.toString() ?? "", glucose: patient?.glucose?.toString() ?? "",
    oxygenSaturation: patient?.oxygenSaturation?.toString() ?? "",
    respiratoryRate: patient?.respiratoryRate?.toString() ?? "",
    hemoglobin: patient?.hemoglobin?.toString() ?? "", creatinine: patient?.creatinine?.toString() ?? "",
    bmi: patient?.bmi?.toString() ?? "", packHistory: patient?.packHistory?.toString() ?? "",
    copdGold: patient?.copdGold?.toString() ?? "", copdConfirmed: patient?.copdConfirmed ?? "",
    smokingStatus: patient?.smokingStatus ?? "",
    heartFailureHistory: patient?.heartFailureHistory ?? "", ecg: patient?.ecg ?? "",
    bnp: patient?.bnp?.toString() ?? "", coronaryHistory: patient?.coronaryHistory ?? "",
    arrhythmias: patient?.arrhythmias ?? "", locationCity: patient?.locationCity ?? "",
    ward: patient?.ward ?? "", room: patient?.room ?? "",
    appointmentTime: timeValue(patient?.appointmentTime), monitoringTime: timeValue(patient?.monitoringTime),
    labTime: timeValue(patient?.labTime), notes: patient?.notes ?? "", photoFile: null,
  };
}

function numberOrZero(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(parsed) ? parsed : 0;
}

function textOrDefault(value: string): string { return value.trim() || "No Presenta"; }

function timeValue(value?: string): string {
  return value && /^\d{2}:\d{2}$/.test(value) ? value : "";
}

const LOCATION_ELEVATIONS: Record<string, number> = {
  Bogota: 2640, Medellin: 1495, Cali: 1018, Pasto: 2527, Ipiales: 2898, Barcelona: 12,
};

function getLocationRiskLevel(location: string): number {
  const elevation = LOCATION_ELEVATIONS[location] ?? 0;
  return elevation >= 2500 ? 2 : elevation >= 1500 ? 1 : 0;
}

export function buildPatientPayload(values: PatientFormValues) {
  return {
    name: values.name.trim(), documentId: values.documentId.trim(), age: numberOrZero(values.age),
    condition: textOrDefault(values.condition), status: values.status,
    photoUrl: values.photoUrl || "No Presenta",
    bloodPressureSystolic: numberOrZero(values.bloodPressureSystolic),
    bloodPressureDiastolic: numberOrZero(values.bloodPressureDiastolic), pulse: numberOrZero(values.pulse),
    glucose: numberOrZero(values.glucose), oxygenSaturation: numberOrZero(values.oxygenSaturation),
    respiratoryRate: numberOrZero(values.respiratoryRate), hemoglobin: numberOrZero(values.hemoglobin),
    creatinine: numberOrZero(values.creatinine), bmi: numberOrZero(values.bmi), packHistory: numberOrZero(values.packHistory),
    copdGold: numberOrZero(values.copdGold), copdConfirmed: values.copdConfirmed || "No Presenta",
    smokingStatus: values.smokingStatus || "No Presenta",
    heartFailureHistory: textOrDefault(values.heartFailureHistory), ecg: textOrDefault(values.ecg),
    bnp: numberOrZero(values.bnp), coronaryHistory: textOrDefault(values.coronaryHistory),
    arrhythmias: textOrDefault(values.arrhythmias), locationCity: textOrDefault(values.locationCity),
    locationElevationM: LOCATION_ELEVATIONS[values.locationCity] ?? 0,
    locationRiskLevel: getLocationRiskLevel(values.locationCity),
    ward: textOrDefault(values.ward), room: textOrDefault(values.room),
    appointmentTime: values.appointmentTime || "No Presenta", monitoringTime: values.monitoringTime || "No Presenta",
    labTime: values.labTime || "No Presenta", notes: textOrDefault(values.notes),
  };
}

export function validatePatientForm(values: PatientFormValues): string | null {
  if (!values.name.trim()) return "El nombre del paciente es obligatorio.";
  if (!values.documentId.trim()) return "La cédula o ID del paciente es obligatorio.";
  if (!values.age.trim()) return "La edad del paciente es obligatoria.";
  if (!values.condition.trim()) return "La condición principal es obligatoria.";
  if (!values.status) return "Selecciona el estado del paciente.";
  return null;
}
