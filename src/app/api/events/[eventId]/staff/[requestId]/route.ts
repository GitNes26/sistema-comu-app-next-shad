import { NextResponse } from "next/server"
import { deleteStaffRequest } from "@/lib/events/staffing"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ eventId: string; requestId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId, requestId } = await params
    return NextResponse.json(await deleteStaffRequest(ctx.actor, eventId, requestId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
