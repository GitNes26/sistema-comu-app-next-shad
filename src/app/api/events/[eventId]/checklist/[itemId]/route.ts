import { NextResponse } from "next/server"
import { updateChecklistItem } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PATCH { isDone } o { remove: true }.
export async function PATCH(req: Request, { params }: { params: Promise<{ eventId: string; itemId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId, itemId } = await params
    return NextResponse.json(await updateChecklistItem(ctx.actor, eventId, itemId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
