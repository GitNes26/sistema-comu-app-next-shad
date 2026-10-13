import { NextResponse } from "next/server"
import { staffAction } from "@/lib/events/staffing"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { action: assign | remove | approve | reject | offer | withdraw | confirm | decline, ... }
export async function POST(req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { requestId } = await params
    return NextResponse.json(await staffAction(ctx.actor, requestId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
