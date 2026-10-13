import { NextResponse } from "next/server";
import { getMyProfile, updateMyProfile } from "@/lib/settings/server";
import { settingsSession, settingsErrorResponse } from "../guard";

// Perfil del usuario autenticado.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await settingsSession();
  if ("response" in guard) return guard.response;

  try {
    const profile = await getMyProfile(guard.session.user.id);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await settingsSession();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const profile = await updateMyProfile(guard.session.user.id, input);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
