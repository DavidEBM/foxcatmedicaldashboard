"use client";

import type { Patient } from "@/types/doctor-patients";
import PatientForm from "./PatientForm";

interface PatientCrudModalProps {
  open: boolean;
  mode: "create" | "edit";
  patient?: Patient | null;
  cities: string[];
  doctorId: string;

  onClose: () => void;

  onStatus?: (
    message: string,
    type: "success" | "error"
  ) => void;
}

export default function PatientCrudModal({
  open,
  mode,
  patient,
  cities,
  doctorId,
  onClose,
  onStatus,
}: PatientCrudModalProps) {
  if (!open) {
    return null;
  }

  const title =
    mode === "edit"
      ? "Editar paciente"
      : "Crear paciente";

  return (
    <div
      className="patient-crud-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-crud-title"
    >
      <div className="patient-crud-modal-content">
        <header>
          <h2 id="patient-crud-title">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <PatientForm
          mode={mode}
          patient={patient}
          cities={cities}
          doctorId={doctorId}
          onCancel={onClose}
          onSuccess={onClose}
          onStatus={onStatus}
        />
      </div>
    </div>
  );
}