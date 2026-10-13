import { NextResponse } from "next/server"
import { listEventStaff, saveStaffRequest } from "@/lib/events/staffing"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ eventId: string }> }

// GET → pedidos de servidores del evento (organizador). POST { ministryId, quantity, notes } → pide o ajusta.
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    return NextResponse.json({ ok: true, requests: await listEventStaff(ctx.actor, eventId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { eventId } = await params
    return NextResponse.json({ ok: true, ...(await saveStaffRequest(ctx.actor, eventId, await readJson(req))) }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
