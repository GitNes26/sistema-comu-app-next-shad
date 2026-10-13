import { NextResponse } from "next/server"
import { listDonations, reportMyDonation } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?status= → donativos (tesorería). POST { amount, kind, reference } → aviso de transferencia propia.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, donations: await listDonations(ctx.actor, new URL(req.url).searchParams.get("status") ?? undefined) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const result = await reportMyDonation(ctx.actor, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
