"use client";

import type { Patient } from "@/types/doctor-patients";

interface PatientHistoryProps { patient: Patient | null; }

export default function PatientHistory({ patient }: PatientHistoryProps) {
  return (
    <section className="doctor-widget-list" aria-label="Historia del paciente">
      <div className="doctor-widget-list-item"><div><strong>Notas clínicas</strong><span>{patient?.notes || "No hay notas registradas."}</span></div></div>
      <div className="doctor-widget-list-item"><div><strong>Última consulta</strong><span>{String(patient?.lastConsultationAt || "Sin registro")}</span></div></div>
    </section>
  );
}
