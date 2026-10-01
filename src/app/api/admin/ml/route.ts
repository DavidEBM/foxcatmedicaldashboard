import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { ML_ALGORITHMS, ML_TARGETS } from "@/lib/ml/training-config";
import { getLatestTrainingJob } from "@/lib/server/ml-training";
import {
  adminErrorResponse,
  requireAdmin,
} from "@/services/firebase/admin-server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "ml",
  "outputs",
  "SavedModels",
);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

async function collectImages(
  directory: string,
  imageVersion: string,
  relativeDirectory = "",
): Promise<Array<{ path: string; name: string; url: string }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const images: Array<{ path: string; name: string; url: string }> = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      images.push(...await collectImages(absolutePath, imageVersion, relativePath));
      continue;
    }

    if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    const normalizedPath = relativePath.split(path.sep).join("/");
    images.push({
      path: normalizedPath,
      name: entry.name,
      url: `/api/ai-training-assets?path=${encodeURIComponent(normalizedPath)}&v=${encodeURIComponent(imageVersion)}`,
    });
  }

  return images.sort((a, b) => a.path.localeCompare(b.path));
}

async function readManifest(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(
      path.join(OUTPUT_DIR, "training-manifest.json"),
      "utf8",
    );
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const manifest = await readManifest();
    const refreshToken = new URL(request.url).searchParams.get("refresh") ?? Date.now().toString();
    const imageVersion = `${manifest?.generatedAt ?? "missing"}-${refreshToken}`;
    const images = await collectImages(OUTPUT_DIR, imageVersion).catch(() => []);

    return NextResponse.json(
      {
        algorithms: ML_ALGORITHMS,
        targets: ML_TARGETS,
        manifest,
        images,
        latestRun: getLatestTrainingJob(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
