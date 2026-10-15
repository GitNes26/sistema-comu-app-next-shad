import { NextResponse } from "next/server"
import { listAllCampaigns, saveCampaign } from "@/lib/finance/campaigns"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// Campañas de donativos (tesorería): GET todas con su avance; POST crea una.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, campaigns: await listAllCampaigns(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const r = await saveCampaign(ctx.actor, null, await readJson(req))
    return NextResponse.json({ ok: true, ...r }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
