import { NextResponse } from "next/server"
import { startCheckout } from "@/lib/payments/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// POST { provider, amount, kind } → crea el cobro y devuelve la dirección de pago.
export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, ...(await startCheckout(ctx.actor, await readJson(req))) }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
