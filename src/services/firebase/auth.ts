import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { auth } from "./firebase-config";

export type StorageMode =
  | "persistent"
  | "temporary";

export async function configurePersistence(
  mode: StorageMode = "temporary"
) {
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
  await configurePersistence(storageMode);

  const credential =
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  return credential.user;
}

export async function register(
  email: string,
  password: string,
  storageMode: StorageMode = "temporary"
) {
  await configurePersistence(storageMode);

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

  return credential.user;
}

export async function registerWithGoogle(
  storageMode: StorageMode = "temporary"
) {
  await configurePersistence(storageMode);

  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  const credential =
    await signInWithPopup(
      auth,
      provider
    );

  return credential.user;
}

export async function logout() {
  await signOut(auth);
}