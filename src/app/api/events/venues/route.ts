import { NextResponse } from "next/server"
import { listVenues, saveVenue } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → áreas con su plano. POST → crea un área.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, venues: await listVenues(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const result = await saveVenue(ctx.actor, null, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
