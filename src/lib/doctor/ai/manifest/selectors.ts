import type {
  TrainingManifest,
} from "@/types/ai-training";

export function getActiveModel(
  manifest: TrainingManifest | null
) {
  return manifest?.activeModel ?? null;
}

export function getCandidateModels(
  manifest: TrainingManifest | null
) {
  return manifest?.candidateModels ?? [];
}

export function getSpecializedOutcomes(
  manifest: TrainingManifest | null
) {
  return (
    manifest?.specializedOutcomes ?? {}
  );
}

export function getSpecializedOutcome(
  manifest: TrainingManifest | null,
  outcomeKey: string
) {
  if (!outcomeKey) {
    return null;
  }

  return (
    manifest?.specializedOutcomes?.[
      outcomeKey
    ] ?? null
  );
}

export function getTrainingProfile(
  manifest: TrainingManifest | null
) {
  return manifest?.trainingProfile ?? null;
}

export function getModelArtifact(
  manifest: TrainingManifest | null,
  artifactKey: string
) {
  if (!artifactKey) {
    return null;
  }

  return (
    manifest?.artifacts?.[
      artifactKey
    ] ?? null
  );
}