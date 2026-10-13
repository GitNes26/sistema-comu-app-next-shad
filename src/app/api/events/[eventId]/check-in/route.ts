import { NextResponse } from "next/server"
import { checkInTicket } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { code | ticketId, allowUnpaid? } → registra la entrada.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    const result = await checkInTicket(ctx.actor, eventId, await readJson(req))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
