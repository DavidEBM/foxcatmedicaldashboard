"use client";

import { usePatientNotes } from "@/hooks/doctor/usePatientNotes";
import { useState } from "react";

interface PatientNotesProps {
  patientId: string;
  doctorId: string;
  doctorName: string;
}

export default function PatientNotes({
  patientId,
  doctorId,
  doctorName,
}: PatientNotesProps) {
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const {
    notes,
    content,
    setContent,
    loading,
    saving,
    saveNote,
  } = usePatientNotes({
    patientId,
    doctorId,
    doctorName,
  });

  async function handleSave() {
    try {
      setStatus(null);
      await saveNote();
      setStatus({ type: "success", message: "La nota se guardó correctamente." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "No se pudo guardar la nota.",
      });
    }
  }

  if (loading) {
    return (
      <div className="empty-state">
        Cargando notas...
      </div>
    );
  }

  return (
    <section className="patient-notes">
      <div className="patient-notes-editor">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              Nota clínica
            </span>

            <h3>
              Nota de {doctorName}
            </h3>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(event) =>
            setContent(
              event.target.value
            )
          }
          placeholder="Escribe tu nota sobre el paciente..."
          rows={8}
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? "Guardando..."
            : "Guardar mi nota"}
        </button>

        {status && (
          <p className={`patient-note-status is-${status.type}`} role={status.type === "error" ? "alert" : "status"}>
            {status.message}
          </p>
        )}
      </div>

      <div className="patient-notes-history">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              Historial
            </span>

            <h3>
              Notas del equipo médico
            </h3>
          </div>
        </div>

        {notes.length === 0 ? (
          <div className="empty-state">
            Este paciente todavía no
            tiene notas médicas.
          </div>
        ) : (
          <div className="notes-list">
            {notes.map((note) => (
              <article
                key={note.id}
                className="note-card"
              >
                <div className="note-card-header">
                  <strong>
                    {note.doctorName}
                  </strong>

                  {note.doctorId ===
                    doctorId && (
                    <span className="note-owner">
                      Mi nota
                    </span>
                  )}
                </div>

                <p>
                  {note.content}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
