import { NextResponse } from "next/server"
import { decideTransfer } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PATCH { decision: approve | reject | cancel }.
export async function PATCH(req: Request, { params }: { params: Promise<{ transferId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { transferId } = await params
    return NextResponse.json(await decideTransfer(ctx.actor, transferId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
