import { NextResponse } from "next/server";

import {
  adminErrorResponse,
  getAdminAuth,
  getAdminFirestore,
} from "@/services/firebase/admin-server-auth";
import { getRegistrationSettings } from "@/services/firebase/registration-control";

export const runtime = "nodejs";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let createdUid: string | null = null;

  try {
    const body = await request.json() as Record<string, unknown>;
    const email = readString(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = readString(body.displayName) || email.split("@")[0] || "Paciente";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "El correo electrÃ³nico no es vÃ¡lido." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseÃ±a debe tener al menos 8 caracteres." }, { status: 400 });
    }

    const settings = await getRegistrationSettings();
    if (!settings.allowRegistration) {
      return NextResponse.json(
        { error: "El registro de nuevos usuarios estÃ¡ temporalmente desactivado." },
        { status: 403 },
      );
    }

    const authUser = await getAdminAuth().createUser({ email, password });
    createdUid = authUser.uid;

    try {
      await getAdminFirestore().collection("users").doc(authUser.uid).create({
        role: "patient",
        status: "active",
        displayName: displayName.slice(0, 120),
        email,
        createdAt: new Date(),
      });
    } catch (error) {
      await getAdminAuth().deleteUser(authUser.uid).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ uid: authUser.uid });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

    if (code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Ese correo ya estÃ¡ registrado." }, { status: 409 });
    }

    if (createdUid) {
      await getAdminAuth().deleteUser(createdUid).catch(() => undefined);
    }
    return adminErrorResponse(error);
  }
}
