import { NextResponse } from "next/server";

import { adminErrorResponse } from "@/services/firebase/admin-server-auth";
import { getRegistrationSettings } from "@/services/firebase/registration-control";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getRegistrationSettings();
    return NextResponse.json(
      { allowRegistration: settings.allowRegistration },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}
