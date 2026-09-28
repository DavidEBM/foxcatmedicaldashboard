"use client";

import type { Patient } from "@/types/doctor-patients";
import PatientCard from "./PatientCard";

interface PatientListProps {
  patients: Patient[];
  selectedPatientId: string | null;
  onSelect: (patientId: string) => void;
  onDelete: (patient: Patient) => void;
}

export default function PatientList({
  patients,
  selectedPatientId,
  onSelect,
  onDelete,
}: PatientListProps) {
  if (!patients.length) {
    return (
      <div className="empty-state">
        Todavía no hay pacientes registrados.
      </div>
    );
  }

  return (
    <div className="patient-list">
      {patients.map(patient => (
        <PatientCard
          key={patient.id}
          patient={patient}
          selected={
            patient.id === selectedPatientId
          }
          onSelect={() =>
            onSelect(patient.id)
          }
          onDelete={() =>
            onDelete(patient)
          }
        />
      ))}
    </div>
  );
}