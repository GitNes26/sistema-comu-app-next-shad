import { NextResponse } from "next/server"
import { saveSeries } from "@/lib/gatherings/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PUT → edita un horario.
export async function PUT(req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { seriesId } = await params
    return NextResponse.json({ ok: true, ...(await saveSeries(ctx.actor, seriesId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
