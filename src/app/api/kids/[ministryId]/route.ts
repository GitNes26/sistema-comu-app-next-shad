import { NextResponse } from "next/server"
import { getOverview } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → resumen de Kids: salones, servicios abiertos y recientes.
export async function GET(_req: Request, { params }: { params: Promise<{ ministryId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    return NextResponse.json({ ok: true, overview: await getOverview(ctx.actor, ministryId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
