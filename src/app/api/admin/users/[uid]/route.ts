import { NextResponse } from "next/server";

import {
  adminErrorResponse,
  getAdminAuth,
  getAdminFirestore,
  requireAdmin,
} from "@/services/firebase/admin-server-auth";

const ROLES = new Set(["admin", "doctor", "patient"]);
const STATUSES = new Set(["active", "inactive"]);

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  try {
    const { uid: adminUid } = await requireAdmin(request);
    const { uid } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const updates: Record<string, string> = {};

    if (body.role !== undefined) {
      if (typeof body.role !== "string" || !ROLES.has(body.role)) {
        return NextResponse.json({ error: "El rol no es válido." }, { status: 400 });
      }
      updates.role = body.role;
    }

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !STATUSES.has(body.status)) {
        return NextResponse.json({ error: "El estado no es válido." }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.displayName !== undefined) {
      if (typeof body.displayName !== "string" || body.displayName.trim().length > 120) {
        return NextResponse.json({ error: "El nombre no es válido." }, { status: 400 });
      }
      updates.displayName = body.displayName.trim();
    }

    if (body.email !== undefined) {
      if (typeof body.email !== "string" || body.email.trim().length > 254) {
        return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });
      }
      updates.email = body.email.trim().toLowerCase();
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No hay cambios para guardar." }, { status: 400 });
    }

    if (uid === adminUid && (updates.role || updates.status)) {
      return NextResponse.json({ error: "No puedes modificar tu propio rol o estado." }, { status: 400 });
    }

    const profileRef = getAdminFirestore().collection("users").doc(uid);
    const profile = await profileRef.get();
    if (!profile.exists) {
      return NextResponse.json({ error: "El perfil de usuario no existe." }, { status: 404 });
    }

    const previousStatus = profile.data()?.status;
    const nextStatus = updates.status;

    if (nextStatus && nextStatus !== previousStatus) {
      await getAdminAuth().updateUser(uid, { disabled: nextStatus === "inactive" });
    }

    try {
      await profileRef.update({ ...updates, updatedAt: new Date(), updatedBy: adminUid });
    } catch (error) {
      if (nextStatus && nextStatus !== previousStatus) {
        await getAdminAuth().updateUser(uid, { disabled: previousStatus === "inactive" }).catch(() => undefined);
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
