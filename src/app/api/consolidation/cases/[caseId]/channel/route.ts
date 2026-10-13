import { NextResponse } from "next/server"
import { channelCaseToCell } from "@/lib/consolidation/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { cellId } → integra a la persona a la célula y canaliza el caso.
export async function POST(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { caseId } = await params
    const body = await readJson(req)
    return NextResponse.json(await channelCaseToCell(ctx.actor, caseId, body.cellId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
