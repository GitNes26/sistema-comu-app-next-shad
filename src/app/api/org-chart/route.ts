import { NextResponse } from "next/server"
import { getOrgChart } from "@/lib/org/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// Organigrama de la iglesia del usuario (cualquier sesión; solo nombres y puestos).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, chart: await getOrgChart(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
