"use client";

import type { Patient } from "@/types/doctor-patients";
import { usePatientExport } from "@/hooks/doctor/usePatientExport";

interface PatientExportActionsProps {
  selectedPatient: Patient | null;
  patients: Patient[];
  onStatus?: (
    message: string,
    type: "success" | "error"
  ) => void;
}

export function PatientExportActions({
  selectedPatient,
  patients,
  onStatus,
}: PatientExportActionsProps) {
  const {
    exporting,
    exportSelectedPatient,
    exportAllPatients,
  } = usePatientExport({
    onStatus,
  });

  return (
    <div className="patient-export-actions">
      <button
        type="button"
        onClick={() =>
          exportSelectedPatient(selectedPatient)
        }
        disabled={exporting || !selectedPatient}
      >
        {exporting
          ? "Exportando..."
          : "Exportar historia clínica"}
      </button>

      <button
        type="button"
        onClick={() => exportAllPatients(patients)}
        disabled={exporting || !patients.length}
      >
        {exporting
          ? "Exportando..."
          : "Exportar pacientes"}
      </button>
    </div>
  );
}