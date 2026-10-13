import { NextResponse } from "next/server"
import { searchPeople } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?q= → creyentes que aún no tienen boleto (para emitirlo).
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    const q = new URL(req.url).searchParams.get("q") ?? ""
    return NextResponse.json({ ok: true, people: await searchPeople(ctx.actor, eventId, q) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
