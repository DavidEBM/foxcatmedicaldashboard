import { stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  ML_ALGORITHMS,
  ML_TARGETS,
  type MlAlgorithmId,
  type MlTargetId,
} from "@/lib/ml/training-config";
import {
  getTrainingJob,
  startTrainingJob,
} from "@/lib/server/ml-training";
import {
  adminErrorResponse,
  requireAdmin,
} from "@/services/firebase/admin-server-auth";

export const runtime = "nodejs";

const algorithmIds = new Set<string>(ML_ALGORITHMS.map((item) => item.id));
const targetIds = new Set<string>(ML_TARGETS.map((item) => item.id));
const sourceModes = new Set(["firebase", "firebase_dataset", "dataset"]);
const DATASET_EXTENSIONS = new Set([".csv", ".xlsx", ".xls", ".parquet"]);
const DATASETS_DIRECTORY = path.resolve(process.cwd(), "ml", "datasets");

function validSelection(
  values: unknown,
  allowed: Set<string>,
  label: string,
): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`Selecciona al menos un elemento en ${label}.`);
  }

  const result = Array.from(new Set(values.map((value) => String(value))));
  const invalid = result.filter((value) => !allowed.has(value));

  if (invalid.length) {
    throw new Error(`${label} no permitidos: ${invalid.join(", ")}.`);
  }

  return result;
}

async function resolveDatasetPath(value: unknown): Promise<string> {
  const submitted = typeof value === "string" && value.trim()
    ? value.trim()
    : "ml\\datasets\\dataset_final_armonizado.csv";
  const normalized = submitted.replace(/\//g, "\\");
  const prefix = "ml\\datasets\\";
  if (!normalized.toLowerCase().startsWith(prefix) || normalized.length <= prefix.length) {
    throw new Error("El dataset debe estar dentro de la carpeta ml/datasets.");
  }

  const fileName = normalized.slice(prefix.length);
  if (fileName.includes("\\") || fileName === "." || fileName === "..") {
    throw new Error("Solo se permiten archivos directamente dentro de ml/datasets.");
  }
  if (!DATASET_EXTENSIONS.has(path.extname(fileName).toLowerCase())) {
    throw new Error("El formato del dataset local no está soportado.");
  }

  try {
    const details = await stat(path.join(DATASETS_DIRECTORY, fileName));
    if (!details.isFile()) throw new Error("La ruta no es un archivo.");
  } catch {
    throw new Error(`No existe el dataset local seleccionado: ${fileName}.`);
  }

  return path.join("ml", "datasets", fileName);
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const algorithms = validSelection(
      body.algorithms,
      algorithmIds,
      "Algoritmos",
    ) as MlAlgorithmId[];
    const targets = validSelection(
      body.targets,
      targetIds,
      "Targets",
    ) as MlTargetId[];
    const sourceMode = String(
      body.sourceMode
      ?? (body.includeFirebasePatients === false ? "dataset" : "firebase_dataset"),
    );
    if (!sourceModes.has(sourceMode)) {
      throw new Error("Origen de datos no permitido.");
    }
    const datasetPath = sourceMode === "firebase"
      ? "ml\\datasets\\dataset_final_armonizado.csv"
      : await resolveDatasetPath(body.datasetPath);
    const job = await startTrainingJob({
      algorithms,
      targets,
      sourceMode: sourceMode as "firebase" | "firebase_dataset" | "dataset",
      datasetPath,
    });

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const id = new URL(request.url).searchParams.get("runId");
    const job = getTrainingJob(id);

    if (!job) {
      return NextResponse.json(
        { error: "No existe ese entrenamiento." },
        { status: 404 },
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
