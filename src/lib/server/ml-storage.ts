import { getAdminStorageBucket } from "@/services/firebase/admin-server-auth";

export const ML_PUBLISHED_PREFIX = "ml-published";
export const ML_RUNS_PREFIX = "ml-runs";

export function isRemoteMlStorageEnabled(): boolean {
  if (process.env.ML_STORAGE_MODE === "local") return false;
  return process.env.ML_STORAGE_MODE === "remote" || process.env.VERCEL === "1";
}

export async function readRemoteManifest(): Promise<Record<string, unknown> | null> {
  try {
    const bucket = getAdminStorageBucket();
    const pointer = JSON.parse(
      (await bucket.file(`${ML_PUBLISHED_PREFIX}/current.json`).download())[0].toString("utf8"),
    ) as { runId?: string };
    if (!pointer.runId) return null;
    const content = await bucket.file(`${ML_RUNS_PREFIX}/${pointer.runId}/training-manifest.json`).download();
    return JSON.parse(content[0].toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function listRemoteImages(imageVersion: string): Promise<Array<{ path: string; name: string; url: string }>> {
  const bucket = getAdminStorageBucket();
  const pointer = JSON.parse(
    (await bucket.file(`${ML_PUBLISHED_PREFIX}/current.json`).download())[0].toString("utf8"),
  ) as { runId?: string };
  if (!pointer.runId) return [];
  const [files] = await bucket.getFiles({ prefix: `${ML_RUNS_PREFIX}/${pointer.runId}/` });
  const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
  return files
    .map((file) => file.name.replace(`${ML_RUNS_PREFIX}/${pointer.runId}/`, ""))
    .filter((relativePath) => imageExtensions.has(relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase()))
    .sort()
    .map((relativePath) => ({
      path: relativePath,
      name: relativePath.split("/").pop() || relativePath,
      url: `/api/ai-training-assets?path=${encodeURIComponent(relativePath)}&v=${encodeURIComponent(imageVersion)}`,
    }));
}

export async function readRemoteAsset(relativePath: string): Promise<{ content: Buffer; contentType: string } | null> {
  try {
    const bucket = getAdminStorageBucket();
    const pointer = JSON.parse(
      (await bucket.file(`${ML_PUBLISHED_PREFIX}/current.json`).download())[0].toString("utf8"),
    ) as { runId?: string };
    if (!pointer.runId || relativePath.includes("..") || relativePath.startsWith("/")) return null;
    const file = bucket.file(`${ML_RUNS_PREFIX}/${pointer.runId}/${relativePath}`);
    const [content] = await file.download();
    const [metadata] = await file.getMetadata();
    return {
      content,
      contentType: String(metadata.contentType || "application/octet-stream"),
    };
  } catch {
    return null;
  }
}
