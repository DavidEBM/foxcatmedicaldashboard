"use client";

import {
  useCallback,
  useState,
} from "react";

import type {
  AiPredictionValidation,
  AiValidationVerdict,
  SaveAiPredictionValidationInput,
} from "@/types/doctor-ai-validation";

import {
  saveAiPredictionValidation,
} from "@/services/firebase/ai-validation.service";

interface UseAiPredictionValidationOptions {
  doctorUid: string | null;
}

export function useAiPredictionValidation({
  doctorUid,
}: UseAiPredictionValidationOptions) {
  const [
    savingPredictionKey,
    setSavingPredictionKey,
  ] = useState<string | null>(null);

  const [
    lastValidation,
    setLastValidation,
  ] =
    useState<AiPredictionValidation | null>(
      null,
    );

  const validatePrediction =
    useCallback(
      async (
        input: Omit<
          SaveAiPredictionValidationInput,
          "verdict"
        >,
        verdict: AiValidationVerdict,
      ) => {
        if (!doctorUid) {
          throw new Error(
            "No existe una sesión de médico activa.",
          );
        }

        setSavingPredictionKey(
          input.prediction.key,
        );

        try {
          const validation =
            await saveAiPredictionValidation(
              {
                ...input,
                verdict,
              },
              doctorUid,
            );

          setLastValidation(validation);

          return validation;
        } finally {
          setSavingPredictionKey(null);
        }
      },
      [doctorUid],
    );

  return {
    savingPredictionKey,
    lastValidation,
    validatePrediction,
  };
}