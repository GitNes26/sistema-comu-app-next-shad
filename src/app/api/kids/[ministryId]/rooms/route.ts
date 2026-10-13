import { NextResponse } from "next/server"
import { saveRoom } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { id?, name, section, minAgeMonths, maxAgeMonths, sortOrder?, isActive? } → crea o edita un salón.
export async function POST(req: Request, { params }: { params: Promise<{ ministryId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    const result = await saveRoom(ctx.actor, ministryId, await readJson(req))
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
