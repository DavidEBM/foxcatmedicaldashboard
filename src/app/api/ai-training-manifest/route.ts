import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { isRemoteMlStorageEnabled, readRemoteManifest } from "@/lib/server/ml-storage";
import { getAdminFirestore } from "@/services/firebase/admin-server-auth";

async function applyActiveModels(manifest: Record<string, unknown>) {
  const sourceMode = (manifest.dataSources as Record<string, unknown> | undefined)?.sourceMode;
  if (!sourceMode) return manifest;
  const snapshot = await getAdminFirestore().collection("aiModels")
    .where("active", "==", true)
    .get();
  const models = { ...((manifest.models as Record<string, Record<string, unknown>> | undefined) ?? {}) };
  for (const item of snapshot.docs) {
    const active = item.data();
    if (active.sourceMode !== sourceMode || !active.target || !models[active.target]) continue;
    models[active.target] = {
      ...models[active.target],
      selectedModel: active.modelName ?? active.name,
      activeModel: {
        name: active.modelName ?? active.name,
        sourceMode,
        artifact: active.artifact ?? null,
      },
    };
  }
  return { ...manifest, models };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const manifestPath = path.resolve(
    process.cwd(),
    "ml",
    "outputs",
    "SavedModels",
    "training-manifest.json",
  );

  try {
    if (isRemoteMlStorageEnabled()) {
      const remoteManifest = await readRemoteManifest();
      if (remoteManifest) {
        return NextResponse.json(await applyActiveModels(remoteManifest), { headers: { "Cache-Control": "no-store" } });
      }
    }
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
    return NextResponse.json(await applyActiveModels(manifest), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "El manifiesto de entrenamiento todavía no está disponible." },
      { status: 404 },
    );
  }
}
