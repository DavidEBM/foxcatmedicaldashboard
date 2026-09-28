"use client";

import {
  useCallback,
  useState,
} from "react";

import type {
  TrainingManifest,
  TrainingProfile,
} from "@/types/doctor-dashboard";

interface UseClinicalTrainingOptions {
  loadTrainingManifest: (options?: {
    forceRefresh?: boolean;
  }) => Promise<TrainingManifest | null>;

  summarizeActiveModel: (
    manifest: TrainingManifest
  ) => string;

  fallbackTrainingProfile: TrainingProfile;

  onStatus?: (
    message: string,
    type: "success" | "error" | "info"
  ) => void;
}

export function useClinicalTraining({
  loadTrainingManifest,
  summarizeActiveModel,
  fallbackTrainingProfile,
  onStatus,
}: UseClinicalTrainingOptions) {
  const [trainingProfile, setTrainingProfile] =
    useState<TrainingProfile>(
      fallbackTrainingProfile
    );

  const [trainingManifest, setTrainingManifest] =
    useState<TrainingManifest | null>(null);

  const [loading, setLoading] =
    useState(false);

  const loadClinicalTrainingProfile =
    useCallback(async () => {
      setLoading(true);

      try {
        const manifest =
          await loadTrainingManifest({
            forceRefresh: true,
          });

        const training =
          manifest?.trainingProfile;

        const activeModel =
          manifest?.activeModel;

        if (!training || !activeModel) {
          throw new Error(
            "El manifiesto IA no trae modelo activo."
          );
        }

        const nextProfile: TrainingProfile = {
          ...fallbackTrainingProfile,
          ...training,
          ready: true,

          selectedModelName:
            activeModel.name,

          selectedModelPrecision:
            activeModel.combinedPrecision,

          triagePrecision:
            activeModel.triage
              ?.precision_weighted ??
            training.triagePrecision,

          hospitalizationPrecision:
            activeModel.hospitalization
              ?.precision_weighted ??
            training.hospitalizationPrecision,

          minimumPrecisionTarget:
            manifest.minimumPrecisionTarget ??
            training.minimumPrecisionTarget ??
            90,

          calibrationMode:
            training.calibrationMode ??
            "Entrenamiento supervisado offline con manifiesto reutilizable",
        };

        setTrainingProfile(
          nextProfile
        );

        setTrainingManifest(manifest);

        onStatus?.(
          `Motor IA activo: ${activeModel.name}.`,
          "success"
        );
      } catch (error) {
        console.error(error);

        setTrainingProfile({
          ...fallbackTrainingProfile,
        });

        setTrainingManifest(null);

        onStatus?.(
          "Modelos IA locales no disponibles. El dashboard continúa con el perfil base.",
          "info"
        );
      } finally {
        setLoading(false);
      }
    }, [
      loadTrainingManifest,
      summarizeActiveModel,
      fallbackTrainingProfile,
      onStatus,
    ]);

  return {
    trainingProfile,
    trainingManifest,
    loading,
    loadClinicalTrainingProfile,
  };
}