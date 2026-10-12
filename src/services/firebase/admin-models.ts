import {
  collection,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";

import { db } from "./firebase-config";

export interface AdminModel {
  id: string;
  name?: string;
  modelName?: string;
  version?: string;
  active?: boolean;
  status?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  target?: string;
  sourceMode?: "firebase" | "firebase_dataset" | "dataset";
  eligible?: boolean;
  validationMetrics?: Record<string, unknown>;
  trainedAt?: unknown;
  winner?: boolean;
  [key: string]: unknown;
}

const MODELS_COLLECTION = "aiModels";

export function subscribeToAdminModels(
  onData: (models: AdminModel[]) => void,
  onError: (error: unknown) => void
) {
  return onSnapshot(
    collection(db, MODELS_COLLECTION),
    (snapshot) => {
      const models: AdminModel[] =
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

      onData(models);
    },
    onError
  );
}

export async function toggleAdminModel(params: {
  modelId: string;
  active: boolean;
  adminUid: string;
}) {
  const {
    modelId,
    active,
    adminUid,
  } = params;

  await updateDoc(
    doc(db, MODELS_COLLECTION, modelId),
    {
      active,
      status: active
        ? "active"
        : "inactive",
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    }
  );
}

export async function setActiveTrainingModel(params: {
  modelId: string;
  adminUid: string;
  active: boolean;
}): Promise<void> {
  await updateDoc(doc(db, MODELS_COLLECTION, params.modelId), {
    active: params.active,
    status: params.active ? "active" : "inactive",
    updatedAt: serverTimestamp(),
    updatedBy: params.adminUid,
  });
}