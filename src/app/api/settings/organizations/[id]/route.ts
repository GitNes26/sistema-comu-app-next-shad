import { NextResponse } from "next/server";
import { updateOrganization } from "@/lib/settings/organizations";
import { superadminGuard } from "../../guard";

// Actualiza una iglesia o la bloquea/desbloquea (solo superadmin).
// No se elimina: el historial de la iglesia se conserva; el bloqueo suspende el acceso.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await superadminGuard();
  if ("response" in guard) return guard.response;
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    currency?: string;
    isBlocked?: boolean;
    blockedReason?: string | null;
  };
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  try {
    const updated = await updateOrganization(id, {
      name: body.name?.trim(),
      currency: body.currency?.trim(),
      isBlocked: typeof body.isBlocked === "boolean" ? body.isBlocked : undefined,
      blockedReason: body.blockedReason ?? null,
    });
    return NextResponse.json({ organization: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo actualizar" },
      { status: 400 }
    );
  }
}
