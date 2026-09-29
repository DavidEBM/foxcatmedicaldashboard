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
    const includeFirebasePatients = body.includeFirebasePatients !== false;
    const job = await startTrainingJob({
      algorithms,
      targets,
      includeFirebasePatients,
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
