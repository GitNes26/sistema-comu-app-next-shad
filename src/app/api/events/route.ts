import { NextResponse } from "next/server"
import { createEvent, listEvents } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?scope=all|mine&upcoming=1 → eventos. POST → crea un evento.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const u = new URL(req.url)
    const events = await listEvents(ctx.actor, { scope: u.searchParams.get("scope") === "all" ? "all" : "mine", upcoming: u.searchParams.get("upcoming") === "1" })
    return NextResponse.json({ ok: true, events })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const result = await createEvent(ctx.actor, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
