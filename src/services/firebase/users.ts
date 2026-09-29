import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "./firebase-config";

export type UserRole =
  | "admin"
  | "doctor"
  | "patient";

export type UserStatus =
  | "active"
  | "inactive";

export interface UserDocument {
  role: UserRole;
  status: UserStatus;
  displayName: string;
  email?: string;
  createdAt?: unknown;
}

export function userRef(uid: string) {
  return doc(db, "users", uid);
}

export async function getUserDocument(
  uid: string
): Promise<UserDocument | null> {
  const snapshot = await getDoc(
    userRef(uid)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as UserDocument;
}

/**
 * Crea el documento users/{uid} para
 * un paciente nuevo.
 *
 * IMPORTANTE:
 * Si el documento ya existe, no lo modifica.
 *
 * Esto evita que un usuario existente con
 * rol doctor o admin sea convertido
 * accidentalmente en patient al utilizar
 * el acceso con Google.
 */
export async function createPatientUser(
  uid: string,
  displayName: string,
  email?: string,
) {
  const existingUser =
    await getDoc(userRef(uid));

  if (existingUser.exists()) {
    return;
  }

  const userData: UserDocument = {
    role: "patient",
    status: "active",
    displayName,
    createdAt: serverTimestamp(),
  };

  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    userData.email = normalizedEmail;
  }

  await setDoc(userRef(uid), userData);
}

/**
 * Actualiza únicamente el nombre visible
 * del usuario.
 */
export async function updateDisplayName(
  uid: string,
  displayName: string
) {
  await setDoc(
    userRef(uid),
    {
      displayName,
    },
    {
      merge: true,
    }
  );
}

/**
 * Obtiene la ruta principal según
 * el rol del usuario.
 */
export function getRoleRoute(
  role: UserRole
): string {
  switch (role) {
    case "patient":
      return "/patient";

    case "doctor":
      return "/doctor";

    case "admin":
      return "/admin";

    default:
      return "/";
  }
}
