"use client";

import type { AdminUser } from "@/services/firebase/admin-users";

interface AdminProfileProps {
  admin: AdminUser | null;
}

export default function AdminProfile({
  admin,
}: AdminProfileProps) {
  if (!admin) {
    return (
      <div className="profile-summary">
        <p>No hay información del administrador.</p>
      </div>
    );
  }

  const displayName =
    admin.displayName ||
    "Administrador";

  const email =
    admin.email ||
    "—";

  const role =
    admin.role ||
    "admin";

  const status =
    admin.status ||
    "active";

  return (
    <div className="profile-summary">
      <p>
        <strong>Nombre:</strong>{" "}
        {displayName}
      </p>

      <p>
        <strong>Correo:</strong>{" "}
        {email}
      </p>

      <p>
        <strong>Rol:</strong>{" "}
        {role}
      </p>

      <p>
        <strong>Estado:</strong>{" "}
        {status}
      </p>
    </div>
  );
}