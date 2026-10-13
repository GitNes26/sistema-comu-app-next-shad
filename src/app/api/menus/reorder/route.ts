import { NextResponse } from "next/server";
import { reorderMenus } from "@/lib/menus/server";
import { menusAdminGuard, menusErrorResponse } from "../guard";

// Reordenar / re-parentar menús (drag & drop).

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await menusAdminGuard();
  if ("response" in guard) return guard.response;

  try {
    const { items } = await req.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ ok: false, error: "items inválido" }, { status: 400 });
    }
    const result = await reorderMenus(items);
    return NextResponse.json(result);
  } catch (err) {
    return menusErrorResponse(err);
  }
}
