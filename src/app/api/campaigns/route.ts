import { NextResponse } from "next/server"
import { listOpenCampaigns } from "@/lib/finance/campaigns"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// Campañas que hoy reciben aportaciones (cualquier sesión; sin nombres de donadores).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, campaigns: await listOpenCampaigns(ctx.actor.organizationId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
