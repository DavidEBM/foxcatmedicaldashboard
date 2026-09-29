import { FieldValue } from "firebase-admin/firestore";

import { getAdminFirestore } from "./admin-server-auth";

const REGISTRATION_SETTINGS_DOCUMENT = "appSettings/registration";

export interface RegistrationSettings {
  allowRegistration: boolean;
  updatedAt?: unknown;
  updatedBy?: string;
}

export async function getRegistrationSettings(): Promise<RegistrationSettings> {
  const snapshot = await getAdminFirestore()
    .doc(REGISTRATION_SETTINGS_DOCUMENT)
    .get();

  if (!snapshot.exists) {
    return { allowRegistration: true };
  }

  const data = snapshot.data() || {};
  return {
    allowRegistration: data.allowRegistration !== false,
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy,
  };
}

export async function setRegistrationEnabled(
  enabled: boolean,
  adminUid: string,
): Promise<RegistrationSettings> {
  await getAdminFirestore()
    .doc(REGISTRATION_SETTINGS_DOCUMENT)
    .set({
      allowRegistration: enabled,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: adminUid,
    }, { merge: true });

  return { allowRegistration: enabled, updatedBy: adminUid };
}
