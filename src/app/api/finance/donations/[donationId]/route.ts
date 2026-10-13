import { NextResponse } from "next/server"
import { decideDonation } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PATCH { decision: confirm | reject, receivedAt? } → tesorería resuelve el aviso.
export async function PATCH(req: Request, { params }: { params: Promise<{ donationId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { donationId } = await params
    return NextResponse.json(await decideDonation(ctx.actor, donationId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
