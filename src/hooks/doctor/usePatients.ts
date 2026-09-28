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

interface UsePatientsOptions {
  userId: string | null;
  role: "admin" | "doctor" | null;
}

const LAST_PATIENT_COOKIE_PREFIX = "foxcat_last_patient_";
const LAST_PATIENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getLastPatientCookieName(userId: string): string {
  return `${LAST_PATIENT_COOKIE_PREFIX}${encodeURIComponent(userId)}`;
}

function readLastPatientId(userId: string): string | null {
  if (typeof document === "undefined") return null;

  const cookieName = getLastPatientCookieName(userId);
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(cookieName.length + 1)) || null;
  } catch {
    return null;
  }
}

function writeLastPatientId(userId: string, patientId: string): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${getLastPatientCookieName(userId)}=${encodeURIComponent(patientId)}; Path=/; Max-Age=${LAST_PATIENT_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function usePatients({
  userId,
  role,
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

        const rememberedPatientId = readLastPatientId(userId);
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
    }, [userId, role]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    if (
      !userId ||
      loading ||
      !selectedPatientId ||
      !patients.some((patient) => patient.id === selectedPatientId)
    ) {
      return;
    }

    writeLastPatientId(userId, selectedPatientId);
  }, [userId, loading, selectedPatientId, patients]);

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