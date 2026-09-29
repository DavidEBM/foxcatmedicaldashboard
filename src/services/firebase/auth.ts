import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { auth } from "./firebase-config";
import {
  clearActiveSession,
  readActiveSession,
  writeActiveSession,
} from "@/lib/doctor/cookie-preferences";

export type StorageMode = "persistent" | "temporary";

function throwIfAnotherSessionIsActive(email?: string): void {
  const currentUser = auth.currentUser;
  const activeSession = readActiveSession();
  const normalizedEmail = email?.trim().toLowerCase();

  if (currentUser) {
    const currentEmail = currentUser.email?.trim().toLowerCase();
    const sameAccount = Boolean(
      normalizedEmail && currentEmail && normalizedEmail === currentEmail,
    );
    const error = new Error(
      sameAccount
        ? "Esta cuenta ya tiene una sesiÃ³n activa en este navegador."
        : "Ya hay otra cuenta activa en este navegador.",
    ) as Error & { code?: string };
    error.code = "auth/account-already-signed-in";
    throw error;
  }

  if (
    activeSession &&
    (!normalizedEmail || activeSession.email !== normalizedEmail)
  ) {
    const error = new Error("Ya hay otra cuenta activa en este navegador.") as Error & { code?: string };
    error.code = "auth/account-already-signed-in";
    throw error;
  }
}

export async function configurePersistence(
  mode: StorageMode = "temporary"
): Promise<void> {
  await setPersistence(
    auth,
    mode === "persistent"
      ? browserLocalPersistence
      : browserSessionPersistence
  );
}

export async function login(
  email: string,
  password: string,
  storageMode: StorageMode = "temporary"
) {
  const cleanEmail = email.trim();

  if (!cleanEmail) {
    throw new Error("El correo electrónico es obligatorio.");
  }

  if (!password) {
    throw new Error("La contraseña es obligatoria.");
  }

  throwIfAnotherSessionIsActive(cleanEmail);

  await configurePersistence(storageMode);

  const credential = await signInWithEmailAndPassword(
    auth,
    cleanEmail,
    password
  );

  writeActiveSession(credential.user.uid, cleanEmail, storageMode === "persistent");

  return credential.user;
}

export async function register(
  email: string,
  password: string,
  storageMode: StorageMode = "temporary"
) {
  const cleanEmail = email.trim();

  throwIfAnotherSessionIsActive(cleanEmail);

  if (!cleanEmail) {
    throw new Error("El correo electrónico es obligatorio.");
  }

  if (!password) {
    throw new Error("La contraseña es obligatoria.");
  }

  await configurePersistence(storageMode);

  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cleanEmail, password }),
    cache: "no-store",
  });
  const payload = await response.json() as { error?: string };

  if (!response.ok) {
    const error = new Error(payload.error || "No fue posible crear la cuenta.") as Error & { code?: string };
    error.code = response.status === 403
      ? "auth/registration-disabled"
      : response.status === 409
        ? "auth/email-already-in-use"
        : "auth/registration-failed";
    throw error;
  }

  const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
  writeActiveSession(credential.user.uid, cleanEmail, storageMode === "persistent");
  return credential.user;
}

export async function registerWithGoogle(
  storageMode: StorageMode = "temporary"
) {
  throwIfAnotherSessionIsActive();
  await configurePersistence(storageMode);

  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  const credential = await signInWithPopup(
    auth,
    provider
  );

  writeActiveSession(credential.user.uid, credential.user.email || "", storageMode === "persistent");

  return credential.user;
}

export async function completeGoogleRegistration(user: { getIdToken: () => Promise<string> }) {
  const token = await user.getIdToken();
  const response = await fetch("/api/auth/google-registration", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json() as { error?: string };

  if (!response.ok) {
    await signOut(auth).catch(() => undefined);
    clearActiveSession();
    const error = new Error(payload.error || "No fue posible completar el registro.") as Error & { code?: string };
    error.code = response.status === 403
      ? "auth/registration-disabled"
      : "auth/registration-failed";
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } finally {
    clearActiveSession();
  }
}
