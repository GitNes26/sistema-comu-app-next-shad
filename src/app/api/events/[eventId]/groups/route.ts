import { NextResponse } from "next/server"
import { listEventGroups } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → personas con boleto agrupadas por su célula.
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    return NextResponse.json({ ok: true, groups: await listEventGroups(ctx.actor, eventId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
