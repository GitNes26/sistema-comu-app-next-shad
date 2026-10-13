import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"
import { listJoinRequests } from "@/lib/portal/server"

export const dynamic = "force-dynamic"

// GET → solicitudes por decidir de los ministerios que lidera (o todos, con permiso global).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, requests: await listJoinRequests(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
