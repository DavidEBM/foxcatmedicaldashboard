import { readFileSync } from "node:fs";
import path from "node:path";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

const DEFAULT_ADMIN_CREDENTIALS_PATH = path.join(
  "src",
  "services",
  "firebase",
  "testtesis-cc77e-firebase-adminsdk-fbsvc-496daa00b6.json",
);

interface ServiceAccountFile {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

function parseServiceAccount(value?: string): ServiceAccountFile | null {
  const source = value?.trim().replace(/^(['"])([\s\S]*)\1$/, "$2").trim();
  if (!source || !source.startsWith("{")) return null;

  try {
    return JSON.parse(source) as ServiceAccountFile;
  } catch {
    return null;
  }
}

function readServiceAccountFile(): ServiceAccountFile | null {
  // Vercel puede recibir todo el JSON como una sola variable. Se admite
  // FIREBASE_ADMIN_CREDENTIALS por compatibilidad, además del nombre explícito.
  const configuredJson =
    process.env.FIREBASE_ADMIN_CREDENTIALS_JSON ||
    process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT ||
    process.env.FIREBASE_ADMIN_CREDENTIALS;
  const fromEnvironment = parseServiceAccount(configuredJson);
  if (fromEnvironment) return fromEnvironment;

  const configuredPath = process.env.FIREBASE_ADMIN_CREDENTIALS || DEFAULT_ADMIN_CREDENTIALS_PATH;

  try {
    const absolutePath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(
          /* turbopackIgnore: true */ process.cwd(),
          configuredPath,
        );
    return JSON.parse(
      readFileSync(absolutePath, "utf8"),
    ) as ServiceAccountFile;
  } catch {
    return null;
  }
}

function normalizePrivateKey(value?: string): string | undefined {
  const normalized = value
    ?.trim()
    .replace(/^(['"])([\s\S]*)\1$/, "$2")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r");

  if (
    !normalized ||
    !normalized.includes("BEGIN PRIVATE KEY") ||
    !normalized.includes("END PRIVATE KEY") ||
    normalized.includes("...")
  ) {
    return undefined;
  }

  return normalized;
}

function normalizeText(value?: string): string | undefined {
  const normalized = value?.trim().replace(/^(['"])([\s\S]*)\1$/, "$2").trim();
  return normalized || undefined;
}

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccountFile = readServiceAccountFile();

  const projectId = normalizeText(
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      serviceAccountFile?.project_id ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );
  const clientEmail = normalizeText(
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
      process.env.FIREBASE_CLIENT_EMAIL ||
      serviceAccountFile?.client_email,
  );
  const privateKey =
    normalizePrivateKey(
      process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY,
    ) ||
    normalizePrivateKey(serviceAccountFile?.private_key);

  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    throw new AdminApiError(
      "El servidor no tiene configuradas las credenciales administrativas de Firebase.",
      503,
    );
  }

  try {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch {
    throw new AdminApiError(
      "No se pudo inicializar el SDK administrativo de Firebase.",
      503,
    );
  }
}

export async function requireAdmin(request: Request): Promise<{ uid: string }> {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new AdminApiError("La sesión administrativa es obligatoria.", 401);
  }

  let decodedToken: { uid: string };

  try {
    decodedToken = await getAuth(getAdminApp()).verifyIdToken(token);
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError("La sesión administrativa no es válida.", 401);
  }

  try {
    const snapshot = await getFirestore(getAdminApp())
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const data = snapshot.data();

    if (data?.role !== "admin" || data?.status !== "active") {
      throw new AdminApiError("La cuenta no tiene permisos de administrador.", 403);
    }
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError(
      "No se pudo verificar el perfil administrativo.",
      503,
    );
  }

  return { uid: decodedToken.uid };
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

/** Verifica un token de Firebase sin conceder privilegios administrativos. */
export async function requireAuthenticated(request: Request): Promise<{ uid: string }> {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new AdminApiError("La sesiÃ³n es obligatoria.", 401);
  }

  try {
    return await getAuth(getAdminApp()).verifyIdToken(token);
  } catch {
    throw new AdminApiError("La sesiÃ³n no es vÃ¡lida.", 401);
  }
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function adminErrorResponse(error: unknown) {
  const status = error instanceof AdminApiError ? error.status : 500;
  const message = error instanceof Error
    ? error.message
    : "No se pudo completar la operación administrativa.";

  return Response.json({ error: message }, { status });
}
