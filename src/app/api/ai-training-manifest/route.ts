import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const manifestPath = path.resolve(
    process.cwd(),
    "ml",
    "outputs",
    "SavedModels",
    "training-manifest.json",
  );

  try {
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
