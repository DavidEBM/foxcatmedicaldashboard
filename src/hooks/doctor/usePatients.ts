"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Patient } from "@/types/doctor-patients";
import {
  getAllPatients,
  getPatientsByIds,
} from "@/services/firebase/patient.service";
import {
  getAssignedPatientIds,
} from "@/services/firebase/patient-assignment.service";
import {
  readLastPatientId,
  writeLastPatientId,
} from "@/lib/doctor/cookie-preferences";

interface UsePatientsOptions {
  userId: string | null;
  role: "admin" | "doctor" | null;
  cookieConsent?: boolean;
}

export function usePatients({
  userId,
  role,
  cookieConsent = false,
}: UsePatientsOptions) {
  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [selectedPatientId, setSelectedPatientId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const requestIdRef = useRef(0);

  const loadPatients =
    useCallback(async () => {
      const requestId = ++requestIdRef.current;

      if (!userId || !role) {
        setPatients([]);
        setSelectedPatientId(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let result: Patient[];

        if (role === "admin") {
          result = await getAllPatients();
        } else {
          const ids =
            await getAssignedPatientIds(
              userId
            );

          result =
            await getPatientsByIds(ids);
        }

        if (requestId !== requestIdRef.current) return;

        const rememberedPatientId = cookieConsent
          ? readLastPatientId(userId)
          : null;
        const nextPatientId = rememberedPatientId && result.some(
          (patient) => patient.id === rememberedPatientId,
        )
          ? rememberedPatientId
          : result[0]?.id ?? null;

        setPatients(result);
        setSelectedPatientId(nextPatientId);
      } catch (cause) {
        if (requestId !== requestIdRef.current) return;

        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudieron cargar los pacientes."
        );

        setPatients([]);
        setSelectedPatientId(null);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, [cookieConsent, role, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPatients();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadPatients]);

  useEffect(() => {
    if (
      !cookieConsent ||
      !userId ||
      loading ||
      !selectedPatientId ||
      !patients.some((patient) => patient.id === selectedPatientId)
    ) {
      return;
    }

    writeLastPatientId(userId, selectedPatientId);
  }, [cookieConsent, userId, loading, selectedPatientId, patients]);

  const selectedPatient = useMemo(
    () =>
      patients.find(
        patient =>
          patient.id === selectedPatientId
      ) ?? null,
    [patients, selectedPatientId]
  );

  return {
    patients,
    selectedPatient,
    selectedPatientId,
    setSelectedPatientId,
    patientCount: patients.length,
    loading,
    error,
    reload: loadPatients,
  };
}
