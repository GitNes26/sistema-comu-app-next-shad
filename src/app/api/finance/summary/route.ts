import { NextResponse } from "next/server"
import { getSummary } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?month=YYYY-MM → ingresos, gastos y saldo del mes.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, summary: await getSummary(ctx.actor, new URL(req.url).searchParams.get("month") ?? undefined) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
