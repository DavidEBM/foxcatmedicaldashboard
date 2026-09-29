"use client";

import { useCallback, useEffect, useState } from "react";

import { auth } from "@/services/firebase/firebase-config";

interface AdminRegistrationControlProps {
  currentAdmin: { uid: string };
}

export default function AdminRegistrationControl({
  currentAdmin,
}: AdminRegistrationControlProps) {
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Consultando configuración...");

  const request = useCallback(async (method: "GET" | "PUT", enabled?: boolean) => {
    const user = auth.currentUser;
    if (!user || user.uid !== currentAdmin.uid) {
      throw new Error("La sesión administrativa no está disponible.");
    }

    const token = await user.getIdToken();
    const response = await fetch("/api/admin/registration", {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === "PUT" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "PUT" ? JSON.stringify({ allowRegistration: enabled }) : undefined,
      cache: "no-store",
    });
    const payload = await response.json() as { allowRegistration?: boolean; error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "No se pudo consultar la configuración.");
    }

    return payload;
  }, [currentAdmin.uid]);

  useEffect(() => {
    let mounted = true;
    void request("GET")
      .then((payload) => {
        if (!mounted) return;
        setAllowRegistration(payload.allowRegistration !== false);
        setStatus("Configuración cargada correctamente.");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "No se pudo cargar la configuración.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [request]);

  async function handleToggle() {
    const nextValue = !allowRegistration;
    const action = nextValue ? "activar" : "desactivar";
    if (!window.confirm(`¿Confirmas ${action} el registro de nuevos usuarios?`)) return;

    try {
      setSaving(true);
      const payload = await request("PUT", nextValue);
      setAllowRegistration(payload.allowRegistration !== false);
      setStatus(nextValue
        ? "El registro de nuevos usuarios está activo."
        : "El registro de nuevos usuarios está temporalmente desactivado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo actualizar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-module" id="registrationSection">
      <div className="admin-module-header">
        <div>
          <span className="admin-eyebrow">CONTROL DE ACCESO</span>
          <h2>Registro de nuevos usuarios</h2>
          <p>Permite o bloquea temporalmente la creación de cuentas de pacientes.</p>
        </div>
      </div>

      <div className="admin-registration-control">
        <div>
          <strong>{allowRegistration ? "Registro habilitado" : "Registro desactivado"}</strong>
          <p>
            {allowRegistration
              ? "Las nuevas cuentas pueden registrarse con correo o Google."
              : "Las cuentas existentes pueden seguir iniciando sesión; no se crean perfiles nuevos."}
          </p>
        </div>
        <button
          type="button"
          className={allowRegistration ? "ghost-button admin-registration-toggle is-danger" : "btn admin-registration-toggle"}
          onClick={handleToggle}
          disabled={loading || saving}
        >
          {saving ? "Guardando..." : allowRegistration ? "Desactivar registro" : "Activar registro"}
        </button>
      </div>

      <div className="admin-status" data-state={allowRegistration ? "success" : "error"} role="status">
        {status}
      </div>
    </section>
  );
}
