import type { Patient } from "@/types/doctor-patients";

export function buildAgenda(patient: Patient | null): string[] {
  if (!patient) {
    return ["Sin agenda porque no hay un paciente seleccionado."];
  }

  const agenda: string[] = [];

  if (patient.appointmentTime) {
    agenda.push(
      `${patient.appointmentTime} - Consulta de seguimiento.`,
    );
  }

  if (patient.monitoringTime) {
    agenda.push(
      `${patient.monitoringTime} - Monitoreo de signos vitales.`,
    );
  }

  if (patient.labTime) {
    agenda.push(
      `${patient.labTime} - Toma o revision de laboratorio.`,
    );
  }

  if (agenda.length === 0) {
    agenda.push("No hay horarios cargados para este paciente.");
  }

  return agenda;
}