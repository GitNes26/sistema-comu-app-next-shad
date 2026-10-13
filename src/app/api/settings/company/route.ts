import { NextResponse } from "next/server";
import { getCompanyProfile, upsertCompanyProfile } from "@/lib/settings/server";
import { settingsManageGuard, settingsErrorResponse } from "../guard";

// Datos de la iglesia.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const profile = await getCompanyProfile(guard.organizationId);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const profile = await upsertCompanyProfile(guard.organizationId, input);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
