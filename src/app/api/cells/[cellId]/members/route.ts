import { NextResponse } from "next/server"
import { addCellMember, searchCellCandidates } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?q= → creyentes sin célula. POST { memberId, role } → agrega un integrante.
export async function GET(req: Request, { params }: { params: Promise<{ cellId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId } = await params
    const q = new URL(req.url).searchParams.get("q") ?? ""
    return NextResponse.json({ ok: true, candidates: await searchCellCandidates(ctx.actor, cellId, q) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ cellId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId } = await params
    return NextResponse.json(await addCellMember(ctx.actor, cellId, await readJson(req)), { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
