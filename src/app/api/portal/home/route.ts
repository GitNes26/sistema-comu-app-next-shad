import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"
import { getPortalHome } from "@/lib/portal/server"

export const dynamic = "force-dynamic"

// GET → inicio del portal: transmisión, publicaciones recientes y agenda propia.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, home: await getPortalHome(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
