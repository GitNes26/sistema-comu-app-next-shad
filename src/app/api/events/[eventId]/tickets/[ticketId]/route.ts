import { NextResponse } from "next/server"
import { cancelTicket, updateTicket } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PATCH → cambia lugar, precio o notas. DELETE → cancela el boleto (libera el lugar).
export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string; ticketId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId, ticketId } = await params
    return NextResponse.json(await updateTicket(ctx.actor, eventId, ticketId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ eventId: string; ticketId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId, ticketId } = await params
    return NextResponse.json(await cancelTicket(ctx.actor, eventId, ticketId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
