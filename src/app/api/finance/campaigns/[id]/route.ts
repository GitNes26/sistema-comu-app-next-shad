import { NextResponse } from "next/server"
import { saveCampaign, setCampaignStatus } from "@/lib/finance/campaigns"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PUT → edita la campaña. PATCH { status } → abre, pausa o cierra.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await saveCampaign(ctx.actor, id, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    const body = await readJson(req)
    return NextResponse.json(await setCampaignStatus(ctx.actor, id, body.status))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
