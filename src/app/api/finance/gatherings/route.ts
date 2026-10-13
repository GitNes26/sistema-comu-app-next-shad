import { NextResponse } from "next/server"
import { listGatheringsForCut } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → reuniones recientes para registrar su corte.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, gatherings: await listGatheringsForCut(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
