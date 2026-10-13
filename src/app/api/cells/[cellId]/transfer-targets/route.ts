import { NextResponse } from "next/server"
import { listTransferTargets } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → células a las que se puede traspasar un integrante.
export async function GET(_req: Request, { params }: { params: Promise<{ cellId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId } = await params
    return NextResponse.json({ ok: true, cells: await listTransferTargets(ctx.actor, cellId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
