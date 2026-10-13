import { NextResponse } from "next/server"
import { changeRequestStatus } from "@/lib/ministries/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

// PATCH { status, note? }: aprobar/rechazar/entregar (permiso global) o cancelar (quien la pidió).
export async function PATCH(req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { requestId } = await params
    const body = await readJson(req)
    await changeRequestStatus(ctx.actor, requestId, body.status, body.note)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
