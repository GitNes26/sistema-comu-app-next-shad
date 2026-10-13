import { NextResponse } from "next/server"
import { deleteItineraryItem, saveItineraryItem } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { id?, title, startsAt, durationMin, kind, speakerName?, location?, notes? }. DELETE ?id=.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    const body = await readJson(req)
    const id = typeof body.id === "string" && body.id ? body.id : null
    const result = await saveItineraryItem(ctx.actor, eventId, id, body)
    return NextResponse.json({ ok: true, ...result }, { status: id ? 200 : 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    const id = new URL(req.url).searchParams.get("id") ?? ""
    return NextResponse.json(await deleteItineraryItem(ctx.actor, eventId, id))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
