"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  loadTrainingManifest,
  clearTrainingManifestCache,
} from "@/services/ai/training-manifest.service";

import type {
  TrainingManifest,
} from "@/types/ai-training";

export function useTrainingManifest() {
  const [manifest, setManifest] =
    useState<TrainingManifest | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async (
      forceRefresh = false
    ) => {
      setLoading(true);
      setError(null);

      try {
        const result =
          await loadTrainingManifest({
            forceRefresh,
          });

        setManifest(result);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo cargar el manifiesto IA."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // The loader synchronizes the external API-backed manifest state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const refresh = useCallback(
    () => load(true),
    [load]
  );

  const clearCache = useCallback(() => {
    clearTrainingManifestCache();
    setManifest(null);
  }, []);

  return {
    manifest,
    loading,
    error,
    refresh,
    clearCache,
  };
}
