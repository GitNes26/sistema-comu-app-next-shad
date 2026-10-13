import { NextResponse } from "next/server"
import { listGateways, saveGateway } from "@/lib/payments/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → estado de las pasarelas (nunca devuelve llaves). PUT → guarda llaves y activa.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, gateways: await listGateways(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json(await saveGateway(ctx.actor, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
