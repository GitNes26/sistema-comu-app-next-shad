import { NextResponse } from "next/server"
import { finishEvent } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST → finaliza el evento. En el Lanzamiento entrega el diploma a quien completó la escuela.
export async function POST(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    return NextResponse.json(await finishEvent(ctx.actor, eventId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
