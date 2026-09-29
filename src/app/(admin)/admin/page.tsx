"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  auth,
} from "@/services/firebase/firebase-config";

import {
  getUserDocument,
} from "@/services/firebase/users";

import {
  type AdminUser,
} from "@/services/firebase/admin-users";
import { writeActiveSession } from "@/lib/doctor/cookie-preferences";

import AdminDashboard from "@/components/admin/AdminDashboard";

import "./admin.css";

export default function AdminPage() {
  const [currentAdmin, setCurrentAdmin] =
    useState<AdminUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            if (mounted) {
              window.location.replace("/");
            }

            return;
          }

          writeActiveSession(user.uid, user.email || "");

          try {
            const userDocument =
              await getUserDocument(user.uid);

            if (!mounted) {
              return;
            }

            if (
              !userDocument ||
              userDocument.role !== "admin" ||
              userDocument.status !== "active"
            ) {
              window.location.replace("/");
              return;
            }

            const admin: AdminUser = {
              id: user.uid,
              uid: user.uid,

              email: user.email || undefined,

              displayName:
                userDocument.displayName ||
                user.displayName ||
                "",

              role: "admin",
              status: "active",

              createdAt:
                userDocument.createdAt,
            };

            setCurrentAdmin(admin);
          } catch (error) {
            console.error(
              "Error verificando administrador:",
              error
            );

            if (mounted) {
              window.location.replace("/");
            }
          } finally {
            if (mounted) {
              setLoading(false);
            }
          }
        }
      );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentAdmin) return;

    const refreshActiveSession = () => {
      const user = auth.currentUser;
      if (user?.uid === currentAdmin.uid) {
        writeActiveSession(currentAdmin.uid, user.email || "");
      }
    };

    refreshActiveSession();
    const interval = window.setInterval(refreshActiveSession, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [currentAdmin]);

  if (loading) {
    return (
      <main className="admin-page admin-loading-page">
        <div className="admin-loading-card">
          <div
            className="admin-loading-spinner"
            aria-hidden="true"
          />

          <p>
            Verificando acceso administrativo...
          </p>
        </div>
      </main>
    );
  }

  if (!currentAdmin) {
    return null;
  }

  return (
    <main className="admin-page">
      <AdminDashboard
        currentAdmin={currentAdmin}
      />
    </main>
  );
}
