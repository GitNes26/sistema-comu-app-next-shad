import { NextResponse } from "next/server"
import { saveVenue } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PUT → edita el área y su plano.
export async function PUT(req: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { venueId } = await params
    return NextResponse.json({ ok: true, ...(await saveVenue(ctx.actor, venueId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
