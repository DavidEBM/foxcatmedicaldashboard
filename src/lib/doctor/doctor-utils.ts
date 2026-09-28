import type {
  DoctorIdentity,
  RegionProfile,
  TrainingProfile,
  DoctorProfile,
} from "@/types/doctor-utils";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_ALTITUDE_METERS = 2_500;

export const QUESTIONNAIRES_STORAGE_KEY =
  "foxcat_questionnaires";

export const WIDGET_DRAG_SCROLL_EDGE_PX = 80;

export const WIDGET_DRAG_SCROLL_MAX_STEP = 18;

/* -------------------------------------------------------------------------- */
/* Generic helpers                                                            */
/* -------------------------------------------------------------------------- */

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getRawField(
  raw: Record<string, unknown> | null | undefined,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    const value = raw?.[key];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}

/* -------------------------------------------------------------------------- */
/* File / Avatar helpers                                                      */
/* -------------------------------------------------------------------------- */

export function readFileAsDataUrl(
  file: File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(
        new Error(
          "No se pudo leer el archivo de imagen."
        )
      );
    };

    reader.readAsDataURL(file);
  });
}

export function createAvatarDataUri(
  label: string,
  colorA = "#f2c8d7",
  colorB = "#c4d7f2"
): string {
  const safeLabel = (label || "?")
    .slice(0, 2)
    .toUpperCase();

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient
          id="g"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stop-color="${colorA}" />
          <stop offset="100%" stop-color="${colorB}" />
        </linearGradient>
      </defs>

      <rect
        width="120"
        height="120"
        rx="30"
        fill="url(#g)"
      />

      <text
        x="50%"
        y="55%"
        text-anchor="middle"
        font-size="42"
        font-family="Arial, sans-serif"
        fill="#4f6078"
      >
        ${escapeHtml(safeLabel)}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    svg.replace(/\n\s+/g, "").trim()
  )}`;
}

/* -------------------------------------------------------------------------- */
/* Doctor identity                                                            */
/* -------------------------------------------------------------------------- */

export interface AuthUserLike {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

export function getDoctorIdentity(
  user: AuthUserLike | null | undefined,
  doctorProfile: DoctorProfile
): DoctorIdentity {
  const fallbackName =
    user?.email?.split("@")[0] ||
    "Medico Foxcat";

  const displayName =
    doctorProfile.displayName ||
    user?.displayName ||
    fallbackName;

  const photoUrl =
    doctorProfile.photoUrl ||
    user?.photoURL ||
    "";

  return {
    displayName,
    photoUrl,
  };
}

/* -------------------------------------------------------------------------- */
/* Region / location                                                          */
/* -------------------------------------------------------------------------- */

export function normalizeRegionName(
  value: unknown
): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (!raw) return "Barcelona";

  if (raw.includes("bogot")) {
    return "Bogota";
  }

  if (raw.includes("pasto")) {
    return "Pasto-Narino";
  }

  if (raw.includes("medell")) {
    return "Medellin";
  }

  if (raw.includes("cali")) {
    return "Cali";
  }

  if (raw.includes("ipiales")) {
    return "Ipiales";
  }

  if (raw.includes("barcelona")) {
    return "Barcelona";
  }

  return "Barcelona";
}

export function normalizeLocationRiskLevel(
  value: unknown
): number {
  const match = String(value || "").match(
    /risk\s*(\d+)/i
  );

  return match ? Number(match[1]) : 0;
}

export function getLocationElevationMeters(
  locationCity: string,
  trainingProfile: TrainingProfile | null | undefined,
  regionProfiles: Record<string, RegionProfile>
): number {
  const normalized =
    normalizeRegionName(locationCity);

  const manifestElevations =
    trainingProfile?.locationElevations || {};

  const manifestKey = Object.keys(
    manifestElevations
  ).find(
    (key) =>
      normalizeRegionName(key) === normalized
  );

  if (manifestKey) {
    return (
      Number(
        manifestElevations[manifestKey] || 0
      ) || DEFAULT_ALTITUDE_METERS
    );
  }

  const region =
    regionProfiles[normalized];

  return Number(
    region?.altitude ||
      DEFAULT_ALTITUDE_METERS
  );
}

export function getRegionProfile(
  locationCity: string,
  trainingProfile: TrainingProfile | null | undefined,
  regionProfiles: Record<string, RegionProfile>
): RegionProfile {
  const normalized =
    normalizeRegionName(locationCity);

  const baseRegion =
    regionProfiles[normalized] ||
    regionProfiles.Barcelona;

  const altitude =
    getLocationElevationMeters(
      locationCity,
      trainingProfile,
      regionProfiles
    );

  const altitudeDelta =
    altitude -
    Number(
      baseRegion.altitude ||
        DEFAULT_ALTITUDE_METERS
    );

  return {
    ...baseRegion,

    altitude,

    oxygenAdjustment: Math.max(
      0,
      Number(
        baseRegion.oxygenAdjustment || 0
      ) +
        Math.max(
          0,
          altitudeDelta / 1200
        )
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Numeric / clinical normalization                                           */
/* -------------------------------------------------------------------------- */

export function parseNumericOrKeyword(
  value: unknown,
  fallback = 0
): number {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!raw) {
    return Number(fallback || 0);
  }

  if (
    raw === "higher" ||
    raw === "high"
  ) {
    return 108;
  }

  if (raw === "normal") {
    return 82;
  }

  if (
    raw === "lower" ||
    raw === "low"
  ) {
    return 58;
  }

  const numeric = Number(raw);

  return Number.isFinite(numeric)
    ? numeric
    : Number(fallback || 0);
}

export interface BloodPressure {
  systolic: number;
  diastolic: number;
}

export function mapBloodPressureCategory(
  value: unknown
): BloodPressure {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "");

  if (raw === "crisis") {
    return {
      systolic: 185,
      diastolic: 118,
    };
  }

  if (raw === "stage2") {
    return {
      systolic: 168,
      diastolic: 102,
    };
  }

  if (raw === "higher") {
    return {
      systolic: 156,
      diastolic: 96,
    };
  }

  if (raw === "stage1") {
    return {
      systolic: 146,
      diastolic: 92,
    };
  }

  if (raw === "elevate") {
    return {
      systolic: 132,
      diastolic: 86,
    };
  }

  return {
    systolic: 120,
    diastolic: 78,
  };
}

export function normalizeOxygenValue(
  value: unknown
): number {
  const numeric = Number(value || 0);

  if (!numeric) {
    return 0;
  }

  return numeric <= 1
    ? Math.round(numeric * 100)
    : numeric;
}

export function normalizeBooleanText(
  value: unknown
): string {
  const text = String(value || "")
    .trim()
    .toLowerCase();

  if (!text) {
    return "";
  }

  if (
    ["si", "sí", "yes", "true", "1"].includes(
      text
    )
  ) {
    return "Si";
  }

  if (
    ["no", "non", "false", "0"].includes(
      text
    )
  ) {
    return "No";
  }

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}

export function normalizeSmokingStatus(
  value: unknown
): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (!raw) {
    return "";
  }

  if (
    [
      "4",
      "alta carga",
      "heavy",
    ].includes(raw)
  ) {
    return "Alta carga";
  }

  if (
    [
      "3",
      "activo",
      "current",
      "fumador",
    ].includes(raw)
  ) {
    return "Activo";
  }

  if (
    [
      "2",
      "exfumador",
      "former",
    ].includes(raw)
  ) {
    return "Exfumador";
  }

  if (
    [
      "1",
      "nunca",
      "never",
    ].includes(raw)
  ) {
    return "Nunca";
  }

  return String(value).trim();
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

export type StatusClass =
  | "critical"
  | "warning"
  | "stable";

export function getStatusClass(
  status = "Estable"
): StatusClass {
  const normalized =
    status.toLowerCase();

  if (normalized === "critico") {
    return "critical";
  }

  if (normalized === "riesgo") {
    return "warning";
  }

  return "stable";
}

/* -------------------------------------------------------------------------- */
/* Firebase / application errors                                              */
/* -------------------------------------------------------------------------- */

export function formatAppError(
  error: unknown,
  context = "operacion"
): string {
  const firebaseError =
    error as {
      code?: string;
      message?: string;
    };

  const code = String(
    firebaseError?.code || ""
  ).toLowerCase();

  const message = String(
    firebaseError?.message ||
      "Error no identificado."
  );

  if (
    code.includes("permission-denied") ||
    message.includes(
      "Missing or insufficient permissions"
    )
  ) {
    return `Firebase rechazo la ${context} por permisos insuficientes. Verifica que el usuario haya iniciado sesion y que las reglas de Firestore desplegadas permitan esa accion.`;
  }

  if (
    code.includes("unauthorized-domain")
  ) {
    return "Firebase Auth rechazo el dominio actual. Agrega este dominio a Authorized domains en Authentication.";
  }

  if (
    code.includes("operation-not-allowed")
  ) {
    return "Firebase Auth no tiene habilitado Email/Password para este proyecto.";
  }

  if (
    code.includes("requires-recent-login")
  ) {
    return "Firebase requiere una autenticacion reciente para completar esta accion.";
  }

  return message;
}

