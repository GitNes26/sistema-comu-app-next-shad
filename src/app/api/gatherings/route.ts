import { NextResponse } from "next/server"
import { listGatherings, saveGathering } from "@/lib/gatherings/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?month=YYYY-MM&kind= → reuniones del mes con su asistencia. POST → registra una reunión.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const u = new URL(req.url)
    const result = await listGatherings(ctx.actor, { month: u.searchParams.get("month") ?? undefined, kind: u.searchParams.get("kind") ?? undefined, ministryId: u.searchParams.get("ministryId") ?? undefined })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const result = await saveGathering(ctx.actor, null, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
