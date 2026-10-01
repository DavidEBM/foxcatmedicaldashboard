import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
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

async function writeFirebaseSnapshot(jobId: string): Promise<{
  path: string;
  count: number;
}> {
  const snapshot = await getAdminFirestore().collection("patients").get();
  const records = snapshot.docs.map((document) => ({
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

  return { path: filePath, count: records.length };
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
  includeFirebasePatients = true,
}: {
  algorithms: MlAlgorithmId[];
  targets: MlTargetId[];
  includeFirebasePatients?: boolean;
}): Promise<MlTrainingJob> {
  if (hasRunningTrainingJob()) {
    throw new Error("Ya existe un entrenamiento en ejecución.");
  }

  const job: MlTrainingJob = {
    id: randomUUID(),
    status: "queued",
    algorithms,
    targets,
    includeFirebasePatients,
    startedAt: new Date().toISOString(),
    logs: "",
  };

  registry.jobs.set(job.id, job);

  let firebaseSnapshotPath: string | null = null;

  try {
    if (includeFirebasePatients) {
      appendLog(job, "[Firebase] Consultando pacientes para entrenamiento...\n");
      const snapshot = await writeFirebaseSnapshot(job.id);
      firebaseSnapshotPath = snapshot.path;
      appendLog(
        job,
        `[Firebase] ${snapshot.count} pacientes capturados.\n`,
      );
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
  ];

  if (firebaseSnapshotPath) {
    args.push("--firebase-dataset", firebaseSnapshotPath);
  }

  let child;
  try {
    const python = resolvePythonCommand();
    child = spawn(python.executable, [...python.args, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONUTF8: "1",
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
    }
    if (firebaseSnapshotPath) void rm(firebaseSnapshotPath, { force: true });
  });

  return job;
}
