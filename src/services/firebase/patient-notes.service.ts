import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  orderBy,
} from "firebase/firestore";

import {
  db,
} from "@/services/firebase/config";

import type {
  PatientNote,
  SavePatientNoteInput,
} from "@/types/doctor-notes";

const NOTES_COLLECTION =
  "patientNotes";

/* -------------------------------------------------------------------------- */
/* Obtener todas las notas del paciente                                      */
/* -------------------------------------------------------------------------- */

export async function getPatientNotes(
  patientId: string
): Promise<PatientNote[]> {
  const notesQuery = query(
    collection(
      db,
      NOTES_COLLECTION
    ),
    where(
      "patientId",
      "==",
      patientId
    ),
    orderBy(
      "updatedAt",
      "desc"
    )
  );

  const snapshot =
    await getDocs(notesQuery);

  return snapshot.docs.map(
    (note) => ({
      id: note.id,
      ...note.data(),
    }) as PatientNote
  );
}

/* -------------------------------------------------------------------------- */
/* Obtener la nota del médico actual                                          */
/* -------------------------------------------------------------------------- */

export async function getDoctorPatientNote(
  patientId: string,
  doctorId: string
): Promise<PatientNote | null> {
  const notesQuery = query(
    collection(
      db,
      NOTES_COLLECTION
    ),
    where(
      "patientId",
      "==",
      patientId
    ),
    where(
      "doctorId",
      "==",
      doctorId
    )
  );

  const snapshot =
    await getDocs(notesQuery);

  if (snapshot.empty) {
    return null;
  }

  const note =
    snapshot.docs[0];

  return {
    id: note.id,
    ...note.data(),
  } as PatientNote;
}

/* -------------------------------------------------------------------------- */
/* Crear nota                                                                 */
/* -------------------------------------------------------------------------- */

export async function createPatientNote(
  input: SavePatientNoteInput
): Promise<PatientNote> {
  const noteData = {
    patientId:
      input.patientId,

    doctorId:
      input.doctorId,

    doctorName:
      input.doctorName,

    content:
      input.content.trim(),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  const reference =
    await addDoc(
      collection(
        db,
        NOTES_COLLECTION
      ),
      noteData
    );

  return {
    id: reference.id,
    ...noteData,
  } as PatientNote;
}

/* -------------------------------------------------------------------------- */
/* Actualizar nota                                                            */
/* -------------------------------------------------------------------------- */

export async function updatePatientNote(
  noteId: string,
  content: string
): Promise<void> {
  await updateDoc(
    doc(
      db,
      NOTES_COLLECTION,
      noteId
    ),
    {
      content:
        content.trim(),

      updatedAt:
        serverTimestamp(),
    }
  );
}
