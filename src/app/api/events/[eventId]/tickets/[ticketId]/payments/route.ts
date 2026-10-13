import { NextResponse } from "next/server"
import { addPayment } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { amount, method, reference?, note? } → registra un abono.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string; ticketId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId, ticketId } = await params
    return NextResponse.json(await addPayment(ctx.actor, eventId, ticketId, await readJson(req)), { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
