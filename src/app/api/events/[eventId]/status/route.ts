import { NextResponse } from "next/server"
import { setEventStatus } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { status: draft | published | closed | cancelled }.
export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    return NextResponse.json(await setEventStatus(ctx.actor, eventId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
