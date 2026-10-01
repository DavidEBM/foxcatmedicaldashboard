import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { isRemoteMlStorageEnabled, readRemoteManifest } from "@/lib/server/ml-storage";

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
        return NextResponse.json(remoteManifest, { headers: { "Cache-Control": "no-store" } });
      }
    }
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    return NextResponse.json(manifest, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "El manifiesto de entrenamiento todavía no está disponible." },
      { status: 404 },
    );
  }
}
