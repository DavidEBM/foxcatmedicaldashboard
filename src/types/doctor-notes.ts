export interface PatientNote {
  id: string;

  patientId: string;

  doctorId: string;

  doctorName: string;

  content: string;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavePatientNoteInput {
  patientId: string;
  doctorId: string;
  doctorName: string;
  content: string;
}
