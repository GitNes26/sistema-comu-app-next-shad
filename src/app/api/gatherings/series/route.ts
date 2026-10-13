import { NextResponse } from "next/server"
import { listSeries, saveSeries } from "@/lib/gatherings/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → horarios. POST → crea un horario.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, series: await listSeries(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const result = await saveSeries(ctx.actor, null, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
