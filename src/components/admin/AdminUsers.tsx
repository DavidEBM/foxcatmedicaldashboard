"use client";

import { useEffect, useState } from "react";

import {
  subscribeToAdminUsers,
  updateUser,
  type AdminUser,
  type AdminUserRole,
  type AdminUserStatus,
} from "@/services/firebase/admin-users";

interface AdminUsersProps {
  currentAdmin: AdminUser | null;
}

function getFirebaseErrorMessage(
  error: unknown
): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    const message = (
      error as { message?: unknown }
    ).message;

    if (
      typeof message === "string" &&
      message.trim()
    ) {
      return message;
    }
  }

  return "Ocurrió un error inesperado.";
}

export default function AdminUsers({
  currentAdmin,
}: AdminUsersProps) {
  const [users, setUsers] = useState<AdminUser[]>(
    []
  );

  const [status, setStatus] = useState(
    "Consultando usuarios..."
  );

  const [loading, setLoading] = useState(true);

  const [savingUid, setSavingUid] = useState<
    string | null
  >(null);

  useEffect(() => {
    const unsubscribe =
      subscribeToAdminUsers({
        onData: (loadedUsers) => {
          setUsers(loadedUsers);
          setLoading(false);
          setStatus(
            `${loadedUsers.length} usuarios encontrados.`
          );
        },

        onError: (error) => {
          console.error(
            "Error cargando usuarios:",
            error
          );

          setLoading(false);
          setStatus(
            getFirebaseErrorMessage(error)
          );
        },
      });

    return () => {
      unsubscribe();
    };
  }, []);

  async function handleUpdateUser(
    user: AdminUser
  ) {
    if (!currentAdmin) {
      return;
    }

    const currentAdminId =
      currentAdmin.uid || currentAdmin.id;

    if (user.id === currentAdminId) {
      return;
    }

    const role: AdminUserRole =
      user.role || "patient";

    const userStatus: AdminUserStatus =
      user.status || "active";

    const confirmed = window.confirm(
      `¿Confirmas actualizar esta cuenta?\n\n` +
        `Rol: ${role}\n` +
        `Estado: ${userStatus}`
    );

    if (!confirmed) {
      return;
    }

    try {
      setSavingUid(user.id);

      await updateUser(user.id, {
        role,
        status: userStatus,
      });

      setStatus(
        "Usuario actualizado correctamente."
      );
    } catch (error) {
      console.error(
        "Error actualizando usuario:",
        error
      );

      setStatus(
        getFirebaseErrorMessage(error)
      );

      // Recargar el estado real desde Firestore
      // si la operación falló.
      try {
        const unsubscribe =
          subscribeToAdminUsers({
            onData: (loadedUsers) => {
              setUsers(loadedUsers);
              unsubscribe();
            },
          });
      } catch {
        // El listener principal continúa activo.
      }
    } finally {
      setSavingUid(null);
    }
  }

  function updateLocalUser(
    uid: string,
    field: "role" | "status",
    value: string
  ) {
    setUsers((currentUsers) =>
      currentUsers.map((user) => {
        if (user.id !== uid) {
          return user;
        }

        if (field === "role") {
          return {
            ...user,
            role: value as AdminUserRole,
          };
        }

        return {
          ...user,
          status: value as AdminUserStatus,
        };
      })
    );
  }

  const sortedUsers = [...users].sort(
    (a, b) => {
      const nameA = String(
        a.displayName ||
          a.email ||
          ""
      ).toLowerCase();

      const nameB = String(
        b.displayName ||
          b.email ||
          ""
      ).toLowerCase();

      return nameA.localeCompare(
        nameB,
        "es",
        {
          sensitivity: "base",
        }
      );
    }
  );

  return (
    <section
      className="admin-module"
      id="usersSection"
    >
      <div className="admin-module-header">
        <div>
          <h2>Usuarios</h2>

          <p>
            Administración de cuentas y permisos.
          </p>
        </div>
      </div>

      <div
        className="admin-status"
        data-state={
          loading ? "info" : "success"
        }
      >
        {status}
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="empty-users"
                >
                  Cargando usuarios...
                </td>
              </tr>
            ) : sortedUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="empty-users"
                >
                  No existen usuarios registrados.
                </td>
              </tr>
            ) : (
              sortedUsers.map((user) => {
                const isCurrentAdmin =
                  user.id ===
                    currentAdmin?.uid ||
                  user.id ===
                    currentAdmin?.id;

                const role =
                  user.role || "patient";

                const userStatus =
                  user.status || "active";

                const isSaving =
                  savingUid === user.id;

                return (
                  <tr key={user.id}>
                    <td>
                      <strong>
                        {user.displayName ||
                          "Sin nombre"}
                      </strong>

                      <small>
                        UID: {user.id}
                      </small>
                    </td>

                    <td>
                      {user.email || "—"}
                    </td>

                    <td>
                      <select
                        value={role}
                        disabled={
                          isCurrentAdmin ||
                          isSaving
                        }
                        onChange={(event) =>
                          updateLocalUser(
                            user.id,
                            "role",
                            event.target.value
                          )
                        }
                      >
                        <option value="patient">
                          Paciente
                        </option>

                        <option value="doctor">
                          Médico
                        </option>

                        <option value="admin">
                          Administrador
                        </option>
                      </select>
                    </td>

                    <td>
                      <select
                        value={userStatus}
                        disabled={
                          isCurrentAdmin ||
                          isSaving
                        }
                        onChange={(event) =>
                          updateLocalUser(
                            user.id,
                            "status",
                            event.target.value
                          )
                        }
                      >
                        <option value="active">
                          Activo
                        </option>

                        <option value="inactive">
                          Inactivo
                        </option>
                      </select>
                    </td>

                    <td>
                      {isCurrentAdmin ? (
                        <span className="soft-badge">
                          Cuenta actual
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={isSaving}
                          onClick={() =>
                            handleUpdateUser(
                              user
                            )
                          }
                        >
                          {isSaving
                            ? "Guardando..."
                            : "Guardar"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}