import { NextResponse } from "next/server"
import { checkOut } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { token | childId, pickedUpBy? } → registra la salida (exige kids.authorize_exit).
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { sessionId } = await params
    return NextResponse.json({ ok: true, ...(await checkOut(ctx.actor, sessionId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
