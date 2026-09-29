const COOKIE_CONSENT_NAME = "foxcat_cookie_consent";
const THEME_COOKIE_NAME = "foxcat_doctor_theme";
const LAST_PATIENT_COOKIE_PREFIX = "foxcat_last_patient_";
const WIDGET_VISIBILITY_COOKIE_PREFIX = "foxcat_widget_visibility_";
const REMEMBERED_EMAIL_COOKIE_NAME = "foxcat_remembered_email";
const ACTIVE_SESSION_COOKIE_NAME = "foxcat_active_session";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const ACTIVE_SESSION_MAX_AGE = 60 * 60 * 12;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const encodedName = encodeURIComponent(name);
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${encodedName}=`) || part.startsWith(`${name}=`));

  if (!entry) return null;

  const separatorIndex = entry.indexOf("=");
  if (separatorIndex < 0) return null;

  try {
    return decodeURIComponent(entry.slice(separatorIndex + 1)) || null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;

  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function hasAcceptedCookieConsent(): boolean {
  return getCookie(COOKIE_CONSENT_NAME) === "accepted";
}

export function acceptCookieConsent(): void {
  setCookie(COOKIE_CONSENT_NAME, "accepted");
}

export function readThemePreference(): "light" | "dark" | null {
  if (!hasAcceptedCookieConsent()) return null;

  const value = getCookie(THEME_COOKIE_NAME);
  return value === "light" || value === "dark" ? value : null;
}

export function writeThemePreference(theme: "light" | "dark"): void {
  if (!hasAcceptedCookieConsent()) return;
  setCookie(THEME_COOKIE_NAME, theme);
}

function getLastPatientCookieName(userId: string): string {
  return `${LAST_PATIENT_COOKIE_PREFIX}${userId}`;
}

export function readLastPatientId(userId: string): string | null {
  if (!hasAcceptedCookieConsent()) return null;
  return getCookie(getLastPatientCookieName(userId));
}

export function writeLastPatientId(userId: string, patientId: string): void {
  if (!hasAcceptedCookieConsent()) return;
  setCookie(getLastPatientCookieName(userId), patientId);
}

function getWidgetVisibilityCookieName(userId: string): string {
  return `${WIDGET_VISIBILITY_COOKIE_PREFIX}${userId}`;
}

export function readWidgetVisibility(
  userId: string,
): Record<string, boolean> | null {
  if (!hasAcceptedCookieConsent()) return null;

  const raw = getCookie(getWidgetVisibilityCookieName(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const visibility: Record<string, boolean> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === "boolean" && key.length <= 120) {
        visibility[key] = value;
      }
    });

    return Object.keys(visibility).length ? visibility : null;
  } catch {
    return null;
  }
}

export function writeWidgetVisibility(
  userId: string,
  visibility: Record<string, boolean>,
): void {
  if (!hasAcceptedCookieConsent()) return;
  setCookie(
    getWidgetVisibilityCookieName(userId),
    JSON.stringify(visibility),
  );
}

export function readRememberedEmail(): string | null {
  const value = getCookie(REMEMBERED_EMAIL_COOKIE_NAME);
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? value
    : null;
}

export function writeRememberedEmail(email: string): void {
  setCookie(REMEMBERED_EMAIL_COOKIE_NAME, email.trim().toLowerCase());
}

export function clearRememberedEmail(): void {
  deleteCookie(REMEMBERED_EMAIL_COOKIE_NAME);
}

interface ActiveSessionCookie {
  uid: string;
  email: string;
  updatedAt: number;
  persistent?: boolean;
}

export function readActiveSession(): ActiveSessionCookie | null {
  const raw = getCookie(ACTIVE_SESSION_COOKIE_NAME);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ActiveSessionCookie>;
    if (
      typeof parsed.uid !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    if (Date.now() - parsed.updatedAt > ACTIVE_SESSION_MAX_AGE * 1000) {
      clearActiveSession();
      return null;
    }

    return {
      uid: parsed.uid,
      email: parsed.email,
      updatedAt: parsed.updatedAt,
      persistent: parsed.persistent === true,
    };
  } catch {
    return null;
  }
}

export function writeActiveSession(
  uid: string,
  email: string,
  persistent = false,
): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const existing = readActiveSession();
  const keepPersistent = persistent || existing?.persistent === true;
  const maxAge = keepPersistent ? `; Max-Age=${ACTIVE_SESSION_MAX_AGE}` : "";
  document.cookie = `${encodeURIComponent(ACTIVE_SESSION_COOKIE_NAME)}=${encodeURIComponent(JSON.stringify({ uid, email: email.trim().toLowerCase(), updatedAt: Date.now(), persistent: keepPersistent }))}; Path=/;${maxAge} SameSite=Lax${secure}`;
}

export function clearActiveSession(): void {
  deleteCookie(ACTIVE_SESSION_COOKIE_NAME);
}
