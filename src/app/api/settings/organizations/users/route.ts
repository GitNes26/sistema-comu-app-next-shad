import { NextResponse } from "next/server";
import { createUser, listAllUsers } from "@/lib/settings/organizations";
import { superadminGuard, settingsErrorResponse } from "../../guard";

// Usuarios globales (exclusivo superAdmin): listar (GET) y crear (POST).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;

  try {
    const users = await listAllUsers();
    return NextResponse.json({ ok: true, users });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;

  try {
    const body = (await req.json()) as { email: string; fullName: string; password: string };
    const user = await createUser(body);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
      { status: 400 }
    );
  }
}