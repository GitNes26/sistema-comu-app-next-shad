import { NextResponse } from "next/server"
import { getEvent, updateEvent } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → detalle (según quién consulta). PUT → edita la configuración.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    return NextResponse.json({ ok: true, event: await getEvent(ctx.actor, eventId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    return NextResponse.json({ ok: true, ...(await updateEvent(ctx.actor, eventId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
