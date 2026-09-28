export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (
      normalized === "" ||
      normalized === "n/a" ||
      normalized === "na" ||
      normalized === "n/d" ||
      normalized === "nd" ||
      normalized === "null" ||
      normalized === "undefined" ||
      normalized === "-" ||
      normalized === "--"
    ) {
      return false;
    }
  }

  return true;
}

export function normalizeText(value: unknown): string {
  if (!hasValue(value)) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeFieldName(value: unknown): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

export function normalizeRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeFieldName(key);

    if (!normalizedKey) {
      return;
    }

    normalized[normalizedKey] = value;
  });

  return normalized;
}

export function getFirstValue(
  row: Record<string, unknown>,
  aliases: string[]
): unknown {
  for (const alias of aliases) {
    const key = normalizeFieldName(alias);

    if (
      Object.prototype.hasOwnProperty.call(row, key) &&
      hasValue(row[key])
    ) {
      return row[key];
    }
  }

  return null;
}

export function cleanValue(value: unknown): unknown {
  if (!hasValue(value)) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return value;
}

export function getNestedValue(
  object: unknown,
  paths: string | string[]
): unknown {
  if (!object || typeof object !== "object") {
    return null;
  }

  const pathList = Array.isArray(paths) ? paths : [paths];

  for (const path of pathList) {
    const parts = path.split(".");
    let current: unknown = object;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        current = null;
        break;
      }

      current = (current as Record<string, unknown>)[part];
    }

    if (hasValue(current)) {
      return current;
    }
  }

  return null;
}

export function getMetadataValue(
  object: unknown,
  key: string
): unknown {
  return getNestedValue(object, [
    `importMetadata.${key}`,
    `metadata.${key}`,
    key,
  ]);
}

export function normalizeDocumentId(value: unknown): string {
  if (!hasValue(value)) {
    return "";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }

    return String(value).trim();
  }

  return String(value)
    .trim()
    .replace(/\s+/g, "");
}

export function normalizeYesNo(value: unknown): string {
  const normalized = normalizeText(value);

  if (
    [
      "si",
      "s",
      "yes",
      "y",
      "true",
      "1",
      "positivo",
      "positive",
    ].includes(normalized)
  ) {
    return "Sí";
  }

  if (
    [
      "no",
      "n",
      "false",
      "0",
      "negativo",
      "negative",
    ].includes(normalized)
  ) {
    return "No";
  }

  return String(value ?? "").trim();
}

/* ============================================================
   ESTADO CLÍNICO
============================================================ */

export function normalizeImportedStatus(
  value: unknown
): string {
  const normalized = normalizeText(value);

  if (["estable", "stable"].includes(normalized)) {
    return "Estable";
  }

  if (["critico", "critical"].includes(normalized)) {
    return "Crítico";
  }

  if (["inestable", "unstable"].includes(normalized)) {
    return "Inestable";
  }

  if (["riesgo", "risk", "at risk"].includes(normalized)) {
    return "Riesgo";
  }

  if (
    [
      "recien recuperado",
      "recuperado",
      "recovered",
    ].includes(normalized)
  ) {
    return "Recien recuperado";
  }

  return String(value ?? "").trim();
}

/* ============================================================
   GOLD EPOC
============================================================ */

export function normalizeImportedGold(
  value: unknown
): string {
  const normalized = normalizeText(value)
    .replace(/^gold/, "")
    .replace(/^grado/, "")
    .trim();

  const match = normalized.match(/[1-4]/);

  if (match) {
    return match[0];
  }

  return String(value ?? "").trim();
}

/* ============================================================
   TABAQUISMO
============================================================ */

export function normalizeImportedSmokingStatus(
  value: unknown
): string {
  const normalized = normalizeText(value);

  if (
    [
      "activo",
      "actual",
      "actual smoker",
      "current",
      "current smoker",
      "fumador activo",
      "fumador",
    ].includes(normalized)
  ) {
    return "Activo";
  }

  if (
    [
      "exfumador",
      "ex fumador",
      "former",
      "former smoker",
      "cesado",
    ].includes(normalized)
  ) {
    return "Exfumador";
  }

  if (
    [
      "no",
      "no fuma",
      "nunca",
      "never",
      "never smoker",
      "no fumador",
      "nunca fumador",
    ].includes(normalized)
  ) {
    return "No";
  }

  return String(value ?? "").trim();
}

/* ============================================================
   FECHAS
============================================================ */

export function formatDate(value: unknown): string {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toLocaleString("es-CO");
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (
      value as { toDate: () => Date }
    )
      .toDate()
      .toLocaleString("es-CO");
  }

  return String(value);
}

/* ============================================================
   FIREBASE ERRORS
============================================================ */

export function getFirebaseErrorMessage(
  error: unknown
): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error
      ? String(
          (error as { code?: unknown }).code
        )
      : "";

  switch (code) {
    case "permission-denied":
      return "No tienes permisos para realizar esta operación.";

    case "not-found":
      return "El registro solicitado no existe.";

    case "already-exists":
      return "El registro ya existe.";

    case "failed-precondition":
      return "La operación no puede realizarse en el estado actual.";

    case "unavailable":
      return "Firebase no está disponible. Comprueba tu conexión e inténtalo nuevamente.";

    case "deadline-exceeded":
      return "La operación tardó demasiado. Inténtalo nuevamente.";

    case "unauthenticated":
      return "Tu sesión ha expirado. Inicia sesión nuevamente.";

    case "network-request-failed":
      return "No fue posible conectarse con Firebase.";

    default:
      if (
        error instanceof Error &&
        error.message
      ) {
        return error.message;
      }

      return "Ocurrió un error inesperado.";
  }
}

/* ============================================================
   DOCUMENTO DEL PACIENTE
============================================================ */

export function getPatientDocument(
  patient: unknown
): string {
  if (!patient || typeof patient !== "object") {
    return "";
  }

  const data =
    patient as Record<string, unknown>;

  const candidates = [
    data.documentId,
    data.document,
    data.cedula,
    data.identification,
    data.identificationNumber,

    (
      data.personalData as
        | Record<string, unknown>
        | undefined
    )?.documentId,

    (
      data.personal as
        | Record<string, unknown>
        | undefined
    )?.documentId,
  ];

  for (const value of candidates) {
    if (hasValue(value)) {
      return normalizeDocumentId(value);
    }
  }

  return "";
}