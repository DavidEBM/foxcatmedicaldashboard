import {
  TRAINING_MANIFEST_CACHE_KEY,
  TRAINING_MANIFEST_CACHE_VERSION,
  TRAINING_MANIFEST_URL,
} from "@/lib/doctor/ai/manifest/constants";

import {
  normalizeManifest,
} from "@/lib/doctor/ai/manifest/normalization";

import type {
  TrainingManifest,
} from "@/types/ai-training";

let manifestMemoryCache:
  TrainingManifest | null = null;

let manifestPromise:
  Promise<TrainingManifest> | null = null;

  function readLocalManifestCache(): TrainingManifest | null {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        TRAINING_MANIFEST_CACHE_KEY
      );

    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw);

    if (
      !cached ||
      cached.version !==
        TRAINING_MANIFEST_CACHE_VERSION ||
      !cached.manifest
    ) {
      return null;
    }

    return normalizeManifest(
      cached.manifest
    );
  } catch {
    return null;
  }
}

function writeLocalManifestCache(
  manifest: TrainingManifest
): void {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      TRAINING_MANIFEST_CACHE_KEY,
      JSON.stringify({
        version:
          TRAINING_MANIFEST_CACHE_VERSION,
        cachedAt: Date.now(),
        manifest,
      })
    );
  } catch {
    // Cache opcional.
  }
}

async function fetchTrainingManifest(): Promise<TrainingManifest> {
  const response = await fetch(
    `${TRAINING_MANIFEST_URL}?v=${encodeURIComponent(
      TRAINING_MANIFEST_CACHE_VERSION
    )}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `No se pudo cargar el manifiesto IA (${response.status}).`
    );
  }

  const rawManifest =
    await response.json();

  return normalizeManifest(
    rawManifest
  );
}

export async function loadTrainingManifest(
  options: {
    forceRefresh?: boolean;
    useLocalCache?: boolean;
  } = {}
): Promise<TrainingManifest> {
  const {
    forceRefresh = false,
    useLocalCache = true,
  } = options;

  if (
    !forceRefresh &&
    manifestMemoryCache
  ) {
    return manifestMemoryCache;
  }

  if (
    !forceRefresh &&
    useLocalCache
  ) {
    const cached =
      readLocalManifestCache();

    if (cached) {
      manifestMemoryCache = cached;
      return cached;
    }
  }

  if (
    !forceRefresh &&
    manifestPromise
  ) {
    return manifestPromise;
  }

  manifestPromise =
    fetchTrainingManifest()
      .then(manifest => {
        manifestMemoryCache =
          manifest;

        if (useLocalCache) {
          writeLocalManifestCache(
            manifest
          );
        }

        return manifest;
      })
      .finally(() => {
        manifestPromise = null;
      });

  return manifestPromise;
}

export function clearTrainingManifestCache(): void {
  manifestMemoryCache = null;
  manifestPromise = null;

  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.removeItem(
      TRAINING_MANIFEST_CACHE_KEY
    );
  } catch {
    // Ignorar.
  }
}