import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "ml",
  "outputs",
  "SavedModels",
);
const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(request: Request) {
  const requestedPath = new URL(request.url).searchParams.get("path") || "";
  const resolvedPath = path.resolve(OUTPUT_DIR, requestedPath);
  const relativePath = path.relative(OUTPUT_DIR, resolvedPath);
  const extension = path.extname(resolvedPath).toLowerCase();

  if (
    !relativePath ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath) ||
    !MIME_TYPES[extension]
  ) {
    return NextResponse.json({ error: "Recurso no permitido." }, { status: 400 });
  }

  try {
    const content = await readFile(resolvedPath);
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": MIME_TYPES[extension],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Imagen no encontrada." }, { status: 404 });
  }
}
