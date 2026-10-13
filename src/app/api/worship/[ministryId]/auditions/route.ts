import { NextResponse } from "next/server"
import { listAuditions, scheduleAudition } from "@/lib/worship/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ ministryId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    return NextResponse.json({ ok: true, auditions: await listAuditions(ctx.actor, ministryId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    const result = await scheduleAudition(ctx.actor, ministryId, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
