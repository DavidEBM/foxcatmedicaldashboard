import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MlAlgorithmId, MlTargetId } from "@/lib/ml/training-config";
import { resolvePythonCommand } from "@/lib/server/python-runtime";
import { getAdminFirestore } from "@/services/firebase/admin-server-auth";

export type MlTrainingStatus = "queued" | "running" | "succeeded" | "failed";

export interface MlTrainingJob {
  id: string;
  status: MlTrainingStatus;
  algorithms: MlAlgorithmId[];
  targets: MlTargetId[];
  includeFirebasePatients: boolean;
  sourceMode: "firebase" | "firebase_dataset" | "dataset";
  datasetPath: string;
  datasetName: string;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  logs: string;
  error?: string;
}

interface MlTrainingRegistry {
  jobs: Map<string, MlTrainingJob>;
}

const globalForMl = globalThis as typeof globalThis & {
  __foxcatMlTraining?: MlTrainingRegistry;
};

const registry = globalForMl.__foxcatMlTraining ?? {
  jobs: new Map<string, MlTrainingJob>(),
};

globalForMl.__foxcatMlTraining = registry;

function appendLog(job: MlTrainingJob, chunk: Buffer | string) {
  const next = `${job.logs}${chunk.toString()}`;
  job.logs = next.length > 24000 ? next.slice(-24000) : next;
}

function firestoreMetrics(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = [
    "accuracy",
    "f1",
    "mcc",
    "kappa",
    "auc",
    "precision",
    "recallSensitivity",
    "balancedAccuracy",
  ];
  return Object.fromEntries(allowed.flatMap((key) => {
    const numeric = Number((value as Record<string, unknown>)[key]);
    return Number.isFinite(numeric) ? [[key, numeric]] : [];
  }));
}

async function registerTrainingWinners(job: MlTrainingJob): Promise<void> {
  const manifest = JSON.parse(
    await readFile(path.resolve(process.cwd(), "ml", "outputs", "SavedModels", "training-manifest.json"), "utf8"),
  ) as { models?: Record<string, Record<string, unknown>>; dataSources?: Record<string, unknown> };
  const sourceMode = job.sourceMode;
  const firestore = getAdminFirestore();
  for (const [target, report] of Object.entries(manifest.models ?? {})) {
    if (report.publishedThisRun !== true || report.runSelectedModel === null || report.runSelectedModel === undefined) {
      continue;
    }
    const selectedModel = String(report.selectedModel ?? "").trim();
    if (!selectedModel) continue;
    const candidate = Array.isArray(report.algorithmsTested)
      ? report.algorithmsTested.find((item) => (
        item && typeof item === "object" && String((item as Record<string, unknown>).model) === selectedModel
      )) as Record<string, unknown> | undefined
      : undefined;
    const modelId = `${sourceMode}__${target}__${selectedModel}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    await firestore.collection("aiModels").doc(modelId).set({
      name: selectedModel,
      modelName: selectedModel,
      target,
      sourceMode,
      winner: true,
      eligible: candidate?.validationThresholdMet === true
        || candidate?.thresholdMet === true
        || report.thresholdMet === true,
      validationMetrics: firestoreMetrics(
        candidate?.validationMetrics ?? report.publishedValidationMetrics,
      ),
      trainedAt: new Date().toISOString(),
      datasetPath: job.datasetPath,
      datasetName: job.datasetName,
      active: false,
      status: "inactive",
      updatedAt: new Date(),
    }, { merge: true });
  }

}

async function archiveTrainingOutput(job: MlTrainingJob): Promise<void> {
  const outputDirectory = path.resolve(process.cwd(), "ml", "outputs", "SavedModels");
  const manifestPath = path.join(outputDirectory, "training-manifest.json");
  try {
    await readFile(manifestPath, "utf8");
  } catch {
    return;
  }

  const archiveDirectory = path.join(outputDirectory, "history", job.id);
  await mkdir(archiveDirectory, { recursive: true });
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.name !== "history")
    .map((entry) => cp(
      path.join(outputDirectory, entry.name),
      path.join(archiveDirectory, entry.name),
      { recursive: true },
    )));
}

function serializeFirestoreValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);

  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, nested]) => [key, serializeFirestoreValue(nested)]),
    );
  }

  return value;
}

async function writeFirebaseSnapshotWithFilter(
  jobId: string,
  importedOnly: boolean,
): Promise<{
  path: string;
  capturedCount: number;
  includedCount: number;
  importedCount: number;
  webCount: number;
}> {
  const snapshot = await getAdminFirestore().collection("patients").get();
  const isImported = (document: { data: () => Record<string, unknown> }) => {
    const metadata = document.data().importMetadata;
    return metadata
      && typeof metadata === "object"
      && !Array.isArray(metadata)
      && Object.values(metadata as Record<string, unknown>).some((value) => (
        value !== null && String(value).trim().length > 0
      ));
  };
  const importedCount = snapshot.docs.filter(isImported).length;
  const webCount = snapshot.docs.length - importedCount;
  const documents = importedOnly
    ? snapshot.docs.filter(isImported)
    : snapshot.docs;
  const records = documents.map((document) => ({
    ...(serializeFirestoreValue(document.data()) as Record<string, unknown>),
    __firestoreId: document.id,
  }));
  const directory = path.resolve(process.cwd(), "ml", "datasets", "runtime");
  const filePath = path.join(directory, `firebase-patients-${jobId}.json`);

  await mkdir(directory, { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify({ patients: records }, null, 2),
    "utf8",
  );

  return {
    path: filePath,
    capturedCount: snapshot.docs.length,
    includedCount: records.length,
    importedCount,
    webCount,
  };
}

export function getTrainingJob(id: string | null): MlTrainingJob | null {
  if (!id) return null;
  return registry.jobs.get(id) ?? null;
}

export function getLatestTrainingJob(): MlTrainingJob | null {
  return Array.from(registry.jobs.values())
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
}

export function hasRunningTrainingJob(): boolean {
  return Array.from(registry.jobs.values()).some(
    (job) => job.status === "queued" || job.status === "running",
  );
}

export async function startTrainingJob({
  algorithms,
  targets,
  sourceMode = "firebase_dataset",
  datasetPath = "ml/datasets/dataset_final_armonizado.csv",
}: {
  algorithms: MlAlgorithmId[];
  targets: MlTargetId[];
  sourceMode?: "firebase" | "firebase_dataset" | "dataset";
  datasetPath?: string;
}): Promise<MlTrainingJob> {
  if (hasRunningTrainingJob()) {
    throw new Error("Ya existe un entrenamiento en ejecución.");
  }

  const job: MlTrainingJob = {
    id: randomUUID(),
    status: "queued",
    algorithms,
    targets,
    includeFirebasePatients: sourceMode !== "dataset",
    sourceMode,
    datasetPath,
    datasetName: path.basename(datasetPath),
    startedAt: new Date().toISOString(),
    logs: "",
  };

  registry.jobs.set(job.id, job);

  let firebaseSnapshotPath: string | null = null;

  try {
    await archiveTrainingOutput(job);
    if (sourceMode !== "dataset") {
      const firebaseStartedAt = performance.now();
      appendLog(job, "[Firebase] Consultando pacientes para entrenamiento...\n");
      const snapshot = await writeFirebaseSnapshotWithFilter(job.id, false);
      firebaseSnapshotPath = snapshot.path;
      appendLog(
        job,
        `[Firebase] ${snapshot.capturedCount} pacientes capturados `
          + `(dataset importado=${snapshot.importedCount} | `
          + `creados en Firebase/web=${snapshot.webCount} | `
          + `incluidos en este entrenamiento=${snapshot.includedCount}).\n`
          + `[Firebase] Captura y snapshot: `
          + `${((performance.now() - firebaseStartedAt) / 1000).toFixed(2)} s.\n`,
      );
    } else {
      appendLog(job, `[Dataset local] Archivo seleccionado: ${datasetPath}\n`);
    }
  } catch (error) {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.error = error instanceof Error
      ? error.message
      : "No se pudo capturar pacientes de Firebase.";
    appendLog(job, `\n[error] ${job.error}\n`);
    return job;
  }

  const args = [
    "-m",
    "ml.run_training",
    "--output-dir",
    "ml/outputs/SavedModels",
    "--algorithms",
    ...algorithms,
    "--targets",
    ...targets,
    "--source-mode",
    sourceMode,
    "--dataset",
    datasetPath,
  ];

  if (firebaseSnapshotPath) {
    args.push("--firebase-dataset", firebaseSnapshotPath);
  }

  let child;
  try {
    const python = resolvePythonCommand();
    appendLog(job, `[Proceso] Iniciando entrenamiento con ${python.executable}...\n`);
    child = spawn(python.executable, [...python.args, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8",
        PYTHONUNBUFFERED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.error = error instanceof Error ? error.message : "No se pudo iniciar Python.";
    appendLog(job, `\n[error] ${job.error}\n`);
    if (firebaseSnapshotPath) void rm(firebaseSnapshotPath, { force: true });
    return job;
  }

  job.status = "running";

  child.stdout.on("data", (chunk) => appendLog(job, chunk));
  child.stderr.on("data", (chunk) => appendLog(job, chunk));

  child.on("error", (error) => {
    job.status = "failed";
    job.error = error.message;
    job.finishedAt = new Date().toISOString();
    appendLog(job, `\n[error] ${error.message}\n`);
    if (firebaseSnapshotPath) void rm(firebaseSnapshotPath, { force: true });
  });

  child.on("close", (code) => {
    if (job.finishedAt) return;
    job.exitCode = code;
    job.status = code === 0 ? "succeeded" : "failed";
    job.finishedAt = new Date().toISOString();
    if (code !== 0) {
      job.error = `El proceso de entrenamiento terminó con código ${code}.`;
      appendLog(job, `\n[error] Código de salida: ${code ?? "desconocido"}\n`);
    } else {
      void registerTrainingWinners(job).catch((error) => {
        appendLog(job, `\n[advertencia] No se pudo registrar el ganador en Modelos de IA: ${error instanceof Error ? error.message : String(error)}\n`);
      });
    }
    if (firebaseSnapshotPath) void rm(firebaseSnapshotPath, { force: true });
  });

  return job;
}
