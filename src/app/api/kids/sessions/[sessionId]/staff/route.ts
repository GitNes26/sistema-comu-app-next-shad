import { NextResponse } from "next/server"
import { assignRoomStaff } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { roomId, memberId, role, remove? } → maestro o apoyo del salón en este servicio.
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { sessionId } = await params
    return NextResponse.json(await assignRoomStaff(ctx.actor, sessionId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
