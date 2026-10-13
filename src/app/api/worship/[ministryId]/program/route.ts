import { NextResponse } from "next/server"
import { getProgram, saveProgram } from "@/lib/worship/server"
import { weekStartOf, toYmd } from "@/lib/worship/rules"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ ministryId: string }> }

function weekParam(url: string) {
  const raw = new URL(url).searchParams.get("week")
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toYmd(weekStartOf(new Date()))
}

// GET ?week=YYYY-MM-DD → programa de esa semana (lunes a domingo) + historial.
export async function GET(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    return NextResponse.json({ ok: true, program: await getProgram(ctx.actor, ministryId, weekParam(req.url)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

// PUT ?week= { title, notes, songs: [{ songId, keyUsed?, notes? }] } → guarda el programa.
export async function PUT(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    await saveProgram(ctx.actor, ministryId, weekParam(req.url), await readJson(req))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
