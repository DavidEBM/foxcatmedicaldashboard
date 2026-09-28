"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  PatientNote,
} from "@/types/doctor-notes";

import {
  createPatientNote,
  getDoctorPatientNote,
  getPatientNotes,
  updatePatientNote,
} from "@/services/firebase/patient-notes.service";

interface UsePatientNotesOptions {
  patientId?: string | null;
  doctorId?: string | null;
  doctorName?: string;
}

export function usePatientNotes({
  patientId,
  doctorId,
  doctorName = "",
}: UsePatientNotesOptions) {
  const [notes, setNotes] =
    useState<PatientNote[]>([]);

  const [
    ownNote,
    setOwnNote,
  ] = useState<PatientNote | null>(
    null
  );

  const [content, setContent] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const loadNotes =
    useCallback(async () => {
      if (!patientId) {
        setNotes([]);
        setOwnNote(null);
        setContent("");
        return;
      }

      try {
        setLoading(true);

        const [
          patientNotes,
          doctorNote,
        ] = await Promise.all([
          getPatientNotes(
            patientId
          ),

          doctorId
            ? getDoctorPatientNote(
                patientId,
                doctorId
              )
            : Promise.resolve(null),
        ]);

        setNotes(
          patientNotes
        );

        setOwnNote(
          doctorNote
        );

        setContent(
          doctorNote?.content || ""
        );
      } finally {
        setLoading(false);
      }
    }, [
      patientId,
      doctorId,
    ]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const saveNote =
    useCallback(async () => {
      if (
        !patientId ||
        !doctorId
      ) {
        throw new Error(
          "Paciente o médico no identificado."
        );
      }

      const normalizedContent =
        content.trim();

      if (!normalizedContent) {
        throw new Error(
          "La nota no puede estar vacía."
        );
      }

      try {
        setSaving(true);

        if (ownNote) {
          await updatePatientNote(
            ownNote.id,
            normalizedContent
          );
        } else {
          const created =
            await createPatientNote({
              patientId,
              doctorId,
              doctorName,
              content:
                normalizedContent,
            });

          setOwnNote(
            created
          );
        }

        await loadNotes();
      } finally {
        setSaving(false);
      }
    }, [
      patientId,
      doctorId,
      doctorName,
      content,
      ownNote,
      loadNotes,
    ]);

  return {
    notes,
    ownNote,
    content,

    setContent,

    loading,
    saving,

    saveNote,
    reload: loadNotes,
  };
}

