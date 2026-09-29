import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";

import {
  auth,
  db,
} from "@/services/firebase/firebase-config";

export type AdminUserRole = "admin" | "doctor" | "patient";
export type AdminUserStatus = "active" | "inactive";

export interface AdminUser {
  id: string;
  uid: string;
  email?: string;
  displayName: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  createdAt?: unknown;
}

export interface SubscribeUsersOptions {
  onData: (users: AdminUser[]) => void;
  onError?: (error: Error) => void;
}

function mapUser(
  id: string,
  data: DocumentData
): AdminUser {
  return {
    id,
    uid: id,
    email:
      typeof data.email === "string"
        ? data.email
        : undefined,
    displayName:
      typeof data.displayName === "string"
        ? data.displayName
        : "",
    role: data.role as AdminUserRole,
    status: data.status as AdminUserStatus,
    createdAt: data.createdAt,
  };
}

export function subscribeToAdminUsers(
  options: SubscribeUsersOptions
): Unsubscribe {
  const usersQuery = query(
    collection(db, "users")
  );

  return onSnapshot(
    usersQuery,
    (snapshot) => {
      const users = snapshot.docs.map((item) =>
        mapUser(item.id, item.data())
      );

      options.onData(users);
    },
    (error) => {
      options.onError?.(error);
    }
  );
}

export function subscribeToUsersByRole(
  role: AdminUserRole,
  options: SubscribeUsersOptions
): Unsubscribe {
  const usersQuery = query(
    collection(db, "users"),
    where("role", "==", role)
  );

  return onSnapshot(
    usersQuery,
    (snapshot) => {
      const users = snapshot.docs.map((item) =>
        mapUser(item.id, item.data())
      );

      options.onData(users);
    },
    (error) => {
      options.onError?.(error);
    }
  );
}

export function subscribeToActiveUsers(
  options: SubscribeUsersOptions
): Unsubscribe {
  const usersQuery = query(
    collection(db, "users"),
    where("status", "==", "active")
  );

  return onSnapshot(
    usersQuery,
    (snapshot) => {
      const users = snapshot.docs.map((item) =>
        mapUser(item.id, item.data())
      );

      options.onData(users);
    },
    (error) => {
      options.onError?.(error);
    }
  );
}

export function getActiveDoctors(
  options: SubscribeUsersOptions
): Unsubscribe {
  const doctorsQuery = query(
    collection(db, "users"),
    where("role", "==", "doctor"),
    where("status", "==", "active")
  );

  return onSnapshot(
    doctorsQuery,
    (snapshot) => {
      const doctors = snapshot.docs.map((item) =>
        mapUser(item.id, item.data())
      );

      options.onData(doctors);
    },
    (error) => {
      options.onError?.(error);
    }
  );
}

export async function updateUserStatus(
  uid: string,
  status: AdminUserStatus
): Promise<void> {
  await updateUser(uid, { status });
}

export async function updateUserRole(
  uid: string,
  role: AdminUserRole
): Promise<void> {
  await updateUser(uid, { role });
}

export async function updateUser(
  uid: string,
  data: Partial<
    Pick<AdminUser, "displayName" | "email" | "role" | "status">
  >
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No hay una sesiÃ³n administrativa activa.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    cache: "no-store",
  });
  const payload = await response.json() as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "No se pudo actualizar el usuario.");
  }
}

export async function fetchAdminUsersFromAuth(): Promise<AdminUser[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No hay una sesiÃ³n administrativa activa.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/admin/users", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    users?: AdminUser[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "No se pudieron consultar los correos.");
  }

  return Array.isArray(payload.users) ? payload.users : [];
}
