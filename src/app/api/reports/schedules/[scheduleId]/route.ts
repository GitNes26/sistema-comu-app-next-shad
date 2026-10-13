import { NextResponse } from "next/server"
import { deleteSchedule, updateSchedule } from "@/lib/reports/schedules"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ scheduleId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { scheduleId } = await params
    return NextResponse.json(await updateSchedule(ctx.actor, scheduleId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { scheduleId } = await params
    return NextResponse.json(await deleteSchedule(ctx.actor, scheduleId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
