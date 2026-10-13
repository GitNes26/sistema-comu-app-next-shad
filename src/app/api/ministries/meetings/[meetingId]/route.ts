import { NextResponse } from "next/server"
import { deleteMeeting, getAttendanceSheet, saveAttendance } from "@/lib/ministries/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ meetingId: string }> }

// GET → hoja de asistencia. PUT { records: [{ memberId, status, note? }] } → pasa lista.
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { meetingId } = await params
    return NextResponse.json({ ok: true, sheet: await getAttendanceSheet(ctx.actor, meetingId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { meetingId } = await params
    const body = await readJson(req)
    const result = await saveAttendance(
      ctx.actor,
      meetingId,
      Array.isArray(body.records) ? (body.records as { memberId?: unknown; status?: unknown; note?: unknown }[]) : []
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { meetingId } = await params
    await deleteMeeting(ctx.actor, meetingId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
