import { NextResponse } from "next/server"
import { createMeeting } from "@/lib/ministries/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    const result = await createMeeting(ctx.actor, id, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
