import { NextResponse } from "next/server";
import { createOrganization, listOrganizations } from "@/lib/settings/organizations";
import { superadminGuard, settingsErrorResponse } from "../guard";

// Organizaciones (exclusivo superAdmin): listar (GET) y crear (POST).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;

  try {
    const organizations = await listOrganizations();
    return NextResponse.json({ ok: true, organizations });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;

  try {
    const body = (await req.json()) as {
      name: string;
      currency?: string;
      ownerName?: string;
      ownerEmail: string;
      ownerPassword: string;
    };
    const organization = await createOrganization(body);
    return NextResponse.json({ ok: true, organization }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
      { status: 400 }
    );
  }
}