import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/services/firebase/config";

import type { Patient } from "@/types/doctor-patients";
import { normalizePatient } from "@/lib/doctor/patients/normalize-patient";

const PATIENTS_COLLECTION = "patients";

export async function getAllPatients(): Promise<Patient[]> {
  const snapshot = await getDocs(
    collection(db, PATIENTS_COLLECTION),
  );

  return snapshot.docs.map((item) =>
    normalizePatient(item.data(), item.id),
  );
}

export async function getPatientsByIds(
  patientIds: string[],
): Promise<Patient[]> {
  const uniqueIds = [...new Set(patientIds.filter(Boolean))];
  const snapshots = await Promise.all(
    uniqueIds.map((patientId) =>
      getDoc(doc(db, PATIENTS_COLLECTION, patientId)),
    ),
  );

  return snapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) =>
      normalizePatient(snapshot.data(), snapshot.id),
    );
}

export async function createPatient(
  payload: Record<string, unknown>,
  doctorId: string
): Promise<string> {
  const reference = await addDoc(
    collection(
      db,
      PATIENTS_COLLECTION
    ),
    {
      ...payload,
      assignedDoctorIds: [doctorId],
      assignedDoctors: [{ uid: doctorId }],
      createdAt: serverTimestamp(),
      createdBy: doctorId,
    }
  );

  return reference.id;
}

export async function updatePatient(
  patientId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await updateDoc(
    doc(
      db,
      PATIENTS_COLLECTION,
      patientId
    ),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    }
  );
}