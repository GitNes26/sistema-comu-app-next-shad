import { NextResponse } from "next/server"
import { resolveAudition } from "@/lib/worship/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

// PATCH { status: "passed" | "failed" | "cancelled", notes?, addToMinistry? }
export async function PATCH(req: Request, { params }: { params: Promise<{ auditionId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { auditionId } = await params
    await resolveAudition(ctx.actor, auditionId, await readJson(req))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
