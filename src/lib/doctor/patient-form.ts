import type {
  Patient,
  PatientFormValues,
} from "@/types/doctor-patients";

export function getInitialPatientFormValues(
  patient?: Partial<Patient>
): PatientFormValues {
  return {
    name: patient?.name ?? "",
    documentId: patient?.documentId ?? "",
    age: patient?.age?.toString() ?? "",
    condition: patient?.condition ?? "",
    status: patient?.status ?? "",

    photoUrl: patient?.photoUrl ?? "",

    bloodPressureSystolic:
      patient?.bloodPressureSystolic?.toString() ?? "",

    bloodPressureDiastolic:
      patient?.bloodPressureDiastolic?.toString() ?? "",

    pulse:
      patient?.pulse?.toString() ?? "",

    glucose:
      patient?.glucose?.toString() ?? "",

    oxygenSaturation:
      patient?.oxygenSaturation?.toString() ?? "",

    respiratoryRate:
      patient?.respiratoryRate?.toString() ?? "",

    hemoglobin:
      patient?.hemoglobin?.toString() ?? "",

    creatinine:
      patient?.creatinine?.toString() ?? "",

    bmi:
      patient?.bmi?.toString() ?? "",

    packHistory:
      patient?.packHistory?.toString() ?? "",

    copdGold:
      patient?.copdGold?.toString() ?? "",

    smokingStatus:
      patient?.smokingStatus ?? "",

    heartFailureHistory:
      patient?.heartFailureHistory ?? "",

    ecg:
      patient?.ecg ?? "",

    bnp:
      patient?.bnp?.toString() ?? "",

    coronaryHistory:
      patient?.coronaryHistory ?? "",

    arrhythmias:
      patient?.arrhythmias ?? "",

    locationCity:
      patient?.locationCity ?? "",

    ward:
      patient?.ward ?? "",

    room:
      patient?.room ?? "",

    appointmentTime:
      patient?.appointmentTime ?? "",

    monitoringTime:
      patient?.monitoringTime ?? "",

    labTime:
      patient?.labTime ?? "",

    notes:
      patient?.notes ?? "",

    photoFile: null,
  };
}

function numberOrNull(
  value: string
): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const number = Number(trimmed);

  return Number.isFinite(number)
    ? number
    : null;
}

export function buildPatientPayload(
  values: PatientFormValues
) {
  return {
    name: values.name.trim(),
    documentId: values.documentId.trim(),
    age: numberOrNull(values.age),
    condition: values.condition.trim(),
    status: values.status,

    photoUrl: values.photoUrl,

    bloodPressureSystolic:
      numberOrNull(
        values.bloodPressureSystolic
      ),

    bloodPressureDiastolic:
      numberOrNull(
        values.bloodPressureDiastolic
      ),

    pulse: numberOrNull(values.pulse),

    glucose:
      numberOrNull(values.glucose),

    oxygenSaturation:
      numberOrNull(
        values.oxygenSaturation
      ),

    respiratoryRate:
      numberOrNull(
        values.respiratoryRate
      ),

    hemoglobin:
      numberOrNull(values.hemoglobin),

    creatinine:
      numberOrNull(values.creatinine),

    bmi: numberOrNull(values.bmi),

    packHistory:
      numberOrNull(values.packHistory),

    copdGold:
      values.copdGold.trim(),

    smokingStatus:
      values.smokingStatus.trim(),

    heartFailureHistory:
      values.heartFailureHistory.trim(),

    ecg: values.ecg.trim(),

    bnp: numberOrNull(values.bnp),

    coronaryHistory:
      values.coronaryHistory.trim(),

    arrhythmias:
      values.arrhythmias.trim(),

    locationCity:
      values.locationCity.trim(),

    ward: values.ward.trim(),

    room: values.room.trim(),

    appointmentTime:
      values.appointmentTime,

    monitoringTime:
      values.monitoringTime,

    labTime: values.labTime,

    notes: values.notes.trim(),
  };
}

export function validatePatientForm(
  values: PatientFormValues
): string | null {
  if (!values.name.trim()) {
    return "El nombre del paciente es obligatorio.";
  }

  if (!values.documentId.trim()) {
    return "La cédula o ID del paciente es obligatorio.";
  }

  if (!values.age.trim()) {
    return "La edad del paciente es obligatoria.";
  }

  if (!values.condition.trim()) {
    return "La condición principal es obligatoria.";
  }

  if (!values.status) {
    return "Selecciona el estado del paciente.";
  }

  return null;
}