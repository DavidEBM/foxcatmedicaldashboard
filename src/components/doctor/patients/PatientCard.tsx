import type { Patient } from "@/types/doctor-patients";

interface PatientCardProps {
  patient: Patient;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export default function PatientCard({
  patient,
  selected,
  onSelect,
  onDelete,
}: PatientCardProps) {
  return (
    <article
      className={`patient-card ${
        selected ? "selected" : ""
      }`}
      onClick={onSelect}
    >
      <img
        src={
          patient.photoUrl ||
          "/images/patient-placeholder.png"
        }
        alt={`Foto de ${patient.name}`}
        className="patient-card-photo"
      />

      <div className="patient-card-copy">
        <strong>{patient.name}</strong>

        <span>
          {patient.condition}
        </span>

        <small>
          {patient.locationCity ||
            "Sin ubicación"}{" "}
          · {patient.ward} -{" "}
          {patient.room}
        </small>
      </div>

      <div className="patient-card-actions">
        <span
          className={`soft-pill status-${patient.statusClass}`}
        >
          {patient.status}
        </span>

        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            onSelect();
          }}
        >
          Ver
        </button>

        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            onDelete();
          }}
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}