import { NextResponse } from "next/server"
import { listMinistryServices } from "@/lib/gatherings/service"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → reuniones generales recientes en que el ministerio estuvo en servicio, con su asistencia.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await listMinistryServices(ctx.actor, id)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
