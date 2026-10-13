import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { decideJoinRequest } from "@/lib/portal/server"

export const dynamic = "force-dynamic"

// POST { decision: approve | reject }.
export async function POST(req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { requestId } = await params
    const body = await readJson(req)
    return NextResponse.json(await decideJoinRequest(ctx.actor, requestId, body.decision))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
