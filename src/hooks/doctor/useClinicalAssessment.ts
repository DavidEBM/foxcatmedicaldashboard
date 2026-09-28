"use client";

import { useMemo } from "react";

import type { Patient } from "@/types/doctor-patients";
import type {
  ClinicalAssessment,
  TrainingProfile,
  TrainingManifest,
} from "@/types/doctor-clinical";

import { computeClinicalAssessment } from "@/lib/doctor/clinical/assessment";

interface UseClinicalAssessmentOptions {
  patient: Patient | null;
  trainingProfile: TrainingProfile;
  trainingManifest?: TrainingManifest | null;
}

export function useClinicalAssessment({
  patient,
  trainingProfile,
  trainingManifest,
}: UseClinicalAssessmentOptions): ClinicalAssessment | null {
  return useMemo(() => {
    if (!patient) {
      return null;
    }

    return computeClinicalAssessment(
      patient,
      trainingProfile,
      trainingManifest ?? null,
    );
  }, [
    patient,
    trainingProfile,
    trainingManifest,
  ]);
}