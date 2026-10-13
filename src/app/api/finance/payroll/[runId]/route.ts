import { NextResponse } from "next/server"
import { deletePayrollRun, getPayrollRun } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → detalle. DELETE → elimina una nómina en borrador.
export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { runId } = await params
    return NextResponse.json({ ok: true, run: await getPayrollRun(ctx.actor, runId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { runId } = await params
    return NextResponse.json(await deletePayrollRun(ctx.actor, runId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
