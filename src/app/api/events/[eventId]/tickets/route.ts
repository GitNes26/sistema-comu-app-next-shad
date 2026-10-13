import { NextResponse } from "next/server"
import { createTicket } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST → el personal emite un boleto (creyente o invitado).
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    const result = await createTicket(ctx.actor, eventId, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
