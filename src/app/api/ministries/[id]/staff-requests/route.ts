import { NextResponse } from "next/server"
import { listMinistryStaffRequests } from "@/lib/events/staffing"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → eventos que piden servidores a este ministerio, con quién ya está asignado.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await listMinistryStaffRequests(ctx.actor, id)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
