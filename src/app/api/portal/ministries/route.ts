import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { listJoinCatalog, requestJoin } from "@/lib/portal/server"

export const dynamic = "force-dynamic"

// GET → ministerios y mi estado en cada uno. POST { ministryId, message? } → pide servir ahí.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, ministries: await listJoinCatalog(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const body = await readJson(req)
    return NextResponse.json({ ok: true, ...(await requestJoin(ctx.actor, String(body.ministryId ?? ""), body.message)) }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
