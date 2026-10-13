import { NextResponse } from "next/server"
import { setMemberStage } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { stage, note? } → el líder actualiza el avance en la visión del integrante.
export async function POST(req: Request, { params }: { params: Promise<{ cellId: string; memberId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId, memberId } = await params
    return NextResponse.json(await setMemberStage(ctx.actor, cellId, memberId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
