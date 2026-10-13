import { NextResponse } from "next/server"
import { nearestCellsForCase } from "@/lib/consolidation/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?typeId= → células activas más cercanas al domicilio de la persona.
export async function GET(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { caseId } = await params
    const typeId = new URL(req.url).searchParams.get("typeId")
    return NextResponse.json({ ok: true, nearby: await nearestCellsForCase(ctx.actor, caseId, typeId || null) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
