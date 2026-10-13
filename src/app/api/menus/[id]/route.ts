import { NextResponse } from "next/server";
import { updateMenu, deleteMenu } from "@/lib/menus/server";
import { menusAdminGuard, menusErrorResponse } from "../guard";

// Editar (PATCH) y borrar (DELETE) un menú.

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await menusAdminGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const input = await req.json();
    const node = await updateMenu(id, input);
    return NextResponse.json({ ok: true, menu: node });
  } catch (err) {
    return menusErrorResponse(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await menusAdminGuard();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const result = await deleteMenu(id);
    return NextResponse.json(result);
  } catch (err) {
    return menusErrorResponse(err);
  }
}
