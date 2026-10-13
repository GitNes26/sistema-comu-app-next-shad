import { NextResponse } from "next/server"
import { listMinistryCatalog } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → ministerios y grupos (para elegir el grupo organizador y el público del evento).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, ministries: await listMinistryCatalog(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
