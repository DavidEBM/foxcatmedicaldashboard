import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  db,
} from "@/services/firebase/config";

import type {
  UserLayout,
} from "@/types/doctor-layout";

export async function getUserLayout(
  userId: string
): Promise<
  Partial<UserLayout> | null
> {
  const snapshot =
    await getDoc(
      doc(
        db,
        "userLayouts",
        userId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as Partial<UserLayout>;
}

export async function saveUserLayout(
  userId: string,
  layout: Partial<UserLayout>
): Promise<void> {
  await setDoc(
    doc(
      db,
      "userLayouts",
      userId
    ),
    {
      ...layout,
      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}
