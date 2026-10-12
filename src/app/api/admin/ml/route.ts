import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { ML_ALGORITHMS, ML_TARGETS } from "@/lib/ml/training-config";
import { getLatestTrainingJob } from "@/lib/server/ml-training";
import {
  adminErrorResponse,
  requireAdmin,
} from "@/services/firebase/admin-server-auth";
import { isRemoteMlStorageEnabled, listRemoteImages, readRemoteManifest } from "@/lib/server/ml-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "ml",
  "outputs",
  "SavedModels",
);
const DATASETS_DIR = path.resolve(process.cwd(), "ml", "datasets");
const DATASET_EXTENSIONS = new Set([".csv", ".xlsx", ".xls", ".parquet"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

async function collectImages(
  directory: string,
  imageVersion: string,
  relativeDirectory = "",
  sourceMode?: string,
): Promise<Array<{ path: string; name: string; url: string; sourceMode?: string }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const images: Array<{ path: string; name: string; url: string }> = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!relativeDirectory && entry.name === "history") continue;
      images.push(...await collectImages(absolutePath, imageVersion, relativePath, sourceMode));
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
      ...(sourceMode ? { sourceMode } : {}),
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

async function listTrainingHistory(): Promise<Array<Record<string, unknown> & { id: string }>> {
  const historyDirectory = path.join(OUTPUT_DIR, "history");
  const entries = await readdir(historyDirectory, { withFileTypes: true }).catch(() => []);
  const history = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      try {
        const manifest = JSON.parse(
          await readFile(path.join(historyDirectory, entry.name, "training-manifest.json"), "utf8"),
        ) as Record<string, unknown>;
        return { id: entry.name, ...manifest };
      } catch {
        return null;
      }
    }));
  return history
    .filter((item): item is Record<string, unknown> & { id: string } => item !== null)
    .sort((left, right) => String(right.generatedAt ?? "").localeCompare(String(left.generatedAt ?? "")));
}

async function listDatasets(): Promise<Array<{ path: string; name: string }>> {
  const entries = await readdir(DATASETS_DIR, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && DATASET_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({ path: path.join("ml", "datasets", entry.name), name: entry.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const remoteStorage = isRemoteMlStorageEnabled();
    const manifest = remoteStorage
      ? (await readRemoteManifest()) ?? await readManifest()
      : await readManifest();
    const refreshToken = new URL(request.url).searchParams.get("refresh") ?? "latest";
    const imageVersion = `${manifest?.generatedAt ?? "missing"}-${refreshToken}`;
    const remoteImages = remoteStorage
      ? await listRemoteImages(imageVersion).catch(() => [])
      : [];
    let images = remoteStorage && remoteImages.length
      ? remoteImages
      : await collectImages(OUTPUT_DIR, imageVersion).catch(() => []);
    if (!remoteStorage) {
      const history = await listTrainingHistory();
      const historyImages = await Promise.all(history.map((entry) => (
        collectImages(
          path.join(OUTPUT_DIR, "history", entry.id),
          imageVersion,
          path.join("history", entry.id),
          String((entry.dataSources as { sourceMode?: string } | undefined)?.sourceMode ?? ""),
        ).catch(() => [])
      )));
      images = [...images, ...historyImages.flat()];
    }

    return NextResponse.json(
      {
        algorithms: ML_ALGORITHMS,
        targets: ML_TARGETS,
        manifest,
        images,
        datasets: await listDatasets(),
        trainingHistory: await listTrainingHistory(),
        latestRun: getLatestTrainingJob(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
