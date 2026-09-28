import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/services/firebase/firebase-config";

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
  await updateDoc(doc(db, "users", uid), {
    status,
  });
}

export async function updateUserRole(
  uid: string,
  role: AdminUserRole
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    role,
  });
}

export async function updateUser(
  uid: string,
  data: Partial<
    Pick<AdminUser, "displayName" | "email" | "role" | "status">
  >
): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}