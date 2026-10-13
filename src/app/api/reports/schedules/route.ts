import { NextResponse } from "next/server"
import { createSchedule, listSchedules } from "@/lib/reports/schedules"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → envíos programados de la iglesia. POST → crea uno.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, ...(await listSchedules(ctx.actor)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, ...(await createSchedule(ctx.actor, await readJson(req))) }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
