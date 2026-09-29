import { NextResponse } from "next/server";

import {
  adminErrorResponse,
  getAdminAuth,
  getAdminFirestore,
  requireAuthenticated,
} from "@/services/firebase/admin-server-auth";
import { getRegistrationSettings } from "@/services/firebase/registration-control";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await requireAuthenticated(request);
    const userRef = getAdminFirestore().collection("users").doc(uid);
    const existingProfile = await userRef.get();

    if (existingProfile.exists) {
      return NextResponse.json({ created: false });
    }

    const settings = await getRegistrationSettings();
    if (!settings.allowRegistration) {
      return NextResponse.json(
        { error: "El registro de nuevos usuarios estÃ¡ temporalmente desactivado." },
        { status: 403 },
      );
    }

    const authUser = await getAdminAuth().getUser(uid);
    await userRef.create({
      role: "patient",
      status: "active",
      displayName: authUser.displayName || authUser.email?.split("@")[0] || "Paciente",
      email: authUser.email?.toLowerCase(),
      createdAt: new Date(),
    });

    return NextResponse.json({ created: true });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
