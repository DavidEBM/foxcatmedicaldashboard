import { NextResponse } from "next/server";

import {
  adminErrorResponse,
  requireAdmin,
} from "@/services/firebase/admin-server-auth";
import {
  getRegistrationSettings,
  setRegistrationEnabled,
} from "@/services/firebase/registration-control";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const settings = await getRegistrationSettings();
    return NextResponse.json({ allowRegistration: settings.allowRegistration });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { uid } = await requireAdmin(request);
    const body = await request.json() as { allowRegistration?: unknown };

    if (typeof body.allowRegistration !== "boolean") {
      return NextResponse.json(
        { error: "El estado del registro debe ser booleano." },
        { status: 400 },
      );
    }

    const settings = await setRegistrationEnabled(body.allowRegistration, uid);
    return NextResponse.json({ allowRegistration: settings.allowRegistration });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
