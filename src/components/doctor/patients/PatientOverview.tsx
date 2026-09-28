"use client";

import type { Patient } from "@/types/doctor-patients";

interface PatientOverviewProps {
  patient: Patient | null;
}

export default function PatientOverview({ patient }: PatientOverviewProps) {
  if (!patient) return <div className="doctor-empty-state">Selecciona un paciente.</div>;
  return (
    <section className="doctor-widget-list" aria-label="Resumen del paciente">
      <div className="doctor-widget-list-item"><div><strong>{patient.name}</strong><span>{patient.condition} · {patient.status}</span></div></div>
      <div className="doctor-widget-list-item"><div><strong>Signos vitales</strong><span>SpO₂ {patient.oxygenSaturation}% · FC {patient.pulse} bpm · FR {patient.respiratoryRate} rpm</span></div></div>
      <div className="doctor-widget-list-item"><div><strong>Ubicación</strong><span>{patient.ward} · {patient.room || "Sin habitación"}</span></div></div>
    </section>
  );
}
