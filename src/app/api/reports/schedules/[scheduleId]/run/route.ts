import { NextResponse } from "next/server"
import { runScheduleNow } from "@/lib/reports/schedules"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST → envía ahora el reporte del último periodo completo.
export async function POST(_req: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { scheduleId } = await params
    return NextResponse.json(await runScheduleNow(ctx.actor, scheduleId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
