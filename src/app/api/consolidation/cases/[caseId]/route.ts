import { NextResponse } from "next/server"
import { getCase, updateCase } from "@/lib/consolidation/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ caseId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { caseId } = await params
    return NextResponse.json({ ok: true, case: await getCase(ctx.actor, caseId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

// PATCH { status?, assignedMemberId?, outcome?, outcomeNote?, notes? }
export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { caseId } = await params
    return NextResponse.json(await updateCase(ctx.actor, caseId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
