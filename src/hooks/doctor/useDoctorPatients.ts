"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import {
  useEffect,
  useState,
} from "react";

import { db } from "@/services/firebase/config";

import type { Patient } from "@/types/doctor-patients";

interface UseDoctorPatientsResult {
  patients: Patient[];
  selectedPatientId: string | null;
  setSelectedPatientId: (
    patientId: string | null
  ) => void;
  loading: boolean;
  error: Error | null;
}

export function useDoctorPatients(
  doctorId: string | null,
  normalizePatient: (
    data: Record<string, unknown>,
    id: string
  ) => Patient
): UseDoctorPatientsResult {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<Error | null>(null);

  useEffect(() => {
    if (!doctorId) {
      setPatients([]);
      setSelectedPatientId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const patientsQuery = query(
      collection(db, "patients"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      patientsQuery,
      (snapshot) => {
        const nextPatients = snapshot.docs
          .filter((item) => {
            const patient =
              item.data();

            const assignedDoctorIds =
              Array.isArray(
                patient.assignedDoctorIds
              )
                ? patient.assignedDoctorIds
                : [];

            return assignedDoctorIds.includes(
              doctorId
            );
          })
          .map((item) =>
            normalizePatient(
              item.data(),
              item.id
            )
          );

        setPatients(nextPatients);

        setSelectedPatientId((current) => {
          if (
            current &&
            nextPatients.some(
              (patient) =>
                patient.id === current
            )
          ) {
            return current;
          }

          return (
            nextPatients[0]?.id ?? null
          );
        });

        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [doctorId, normalizePatient]);

  return {
    patients,
    selectedPatientId,
    setSelectedPatientId,
    loading,
    error,
  };
}