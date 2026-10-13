import { NextResponse } from "next/server"
import { lookupChild } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { token | childId } → quién es el niño y su estado en el servicio.
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { sessionId } = await params
    return NextResponse.json({ ok: true, lookup: await lookupChild(ctx.actor, sessionId, await readJson(req)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
