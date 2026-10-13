import { NextResponse } from "next/server"
import { updatePayrollEntry } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PATCH { base?, bonus?, deductions?, notes? }.
export async function PATCH(req: Request, { params }: { params: Promise<{ runId: string; entryId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { runId, entryId } = await params
    return NextResponse.json(await updatePayrollEntry(ctx.actor, runId, entryId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
