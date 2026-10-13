import { NextResponse } from "next/server"
import { payPayrollRun } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST → marca la nómina como pagada y genera su gasto.
export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { runId } = await params
    return NextResponse.json(await payPayrollRun(ctx.actor, runId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
