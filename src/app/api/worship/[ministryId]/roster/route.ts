import { NextResponse } from "next/server"
import { addRosterEntry, getRoster } from "@/lib/worship/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ ministryId: string }> }

// GET ?month=YYYY-MM → rol del mes. POST → asigna a un servidor a un servicio.
export async function GET(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    const raw = new URL(req.url).searchParams.get("month")
    const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 7)
    return NextResponse.json({ ok: true, roster: await getRoster(ctx.actor, ministryId, month) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    const result = await addRosterEntry(ctx.actor, ministryId, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
