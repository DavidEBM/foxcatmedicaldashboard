"use client";

import {
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/services/firebase/config";

import type { Patient } from "@/types/doctor-patients";

interface ClinicalAssessment {
  shortRisk: number;
  weekRisk: number;
  longRisk: number;
  summary: string;
}

interface UsePatientAlertsOptions {
  computeClinicalAssessment: (
    patient: Patient
  ) => ClinicalAssessment;

  formatAppError: (
    error: unknown,
    context: string
  ) => string;

  onStatus?: (
    message: string,
    type: "success" | "error"
  ) => void;
}

export function usePatientAlerts({
  computeClinicalAssessment,
  formatAppError,
  onStatus,
}: UsePatientAlertsOptions) {
  async function createPatientAlert(
    patient: Patient | null
  ) {
    if (!patient) {
      onStatus?.(
        "Selecciona un paciente antes de generar la alerta.",
        "error"
      );
      return;
    }

    const assessment =
      computeClinicalAssessment(patient);

    const alertText =
      `[Alerta IA] ${new Date().toLocaleString(
        "es-CO"
      )}: Riesgo 24h ${assessment.shortRisk}%, ` +
      `7 días ${assessment.weekRisk}%, ` +
      `30 días ${assessment.longRisk}%. ` +
      assessment.summary;

    try {
      await updateDoc(
        doc(db, "patients", patient.id),
        {
          notes: `${
            patient.notes
              ? `${patient.notes}\n\n`
              : ""
          }${alertText}`,

          lastAlertAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      onStatus?.(
        "Se agregó una alerta automatizada en las notas del paciente.",
        "success"
      );
    } catch (error) {
      onStatus?.(
        formatAppError(
          error,
          "creación de la alerta IA"
        ),
        "error"
      );
    }
  }

  return {
    createPatientAlert,
  };
}