import { NextResponse } from "next/server"
import { checkIn } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { token | childId, roomId?, checklist?, note? } → registra la entrada.
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { sessionId } = await params
    const result = await checkIn(ctx.actor, sessionId, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
