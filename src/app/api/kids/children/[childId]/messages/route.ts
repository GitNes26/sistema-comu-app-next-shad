import { NextResponse } from "next/server"
import { listMessages, sendMessage } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → conversación (marca como leído lo recibido). POST { body, kind?, sessionId? } → envía.
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { childId } = await params
    return NextResponse.json({ ok: true, messages: await listMessages(ctx.actor, childId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { childId } = await params
    const result = await sendMessage(ctx.actor, childId, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
