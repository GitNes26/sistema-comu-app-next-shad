import { NextResponse } from "next/server"
import { updateChild } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PUT → corrige datos del niño (personal o tutor).
export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { childId } = await params
    return NextResponse.json({ ok: true, ...(await updateChild(ctx.actor, childId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
