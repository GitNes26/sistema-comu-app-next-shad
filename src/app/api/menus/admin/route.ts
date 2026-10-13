import { NextResponse } from "next/server";
import { listAllMenus } from "@/lib/menus/server";
import { menusAdminGuard, menusErrorResponse } from "../guard";

// Lista completa de menús (sin filtrar) para el editor.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await menusAdminGuard();
  if ("response" in guard) return guard.response;

  try {
    const menus = await listAllMenus();
    return NextResponse.json({ ok: true, menus });
  } catch (err) {
    return menusErrorResponse(err);
  }
}
