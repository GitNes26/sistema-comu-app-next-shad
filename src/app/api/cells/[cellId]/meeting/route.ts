import { NextResponse } from "next/server"
import { getMeeting } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?date=YYYY-MM-DD → reunión de esa fecha (o la plantilla para registrarla).
export async function GET(req: Request, { params }: { params: Promise<{ cellId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId } = await params
    const date = new URL(req.url).searchParams.get("date") ?? ""
    return NextResponse.json({ ok: true, meeting: await getMeeting(ctx.actor, cellId, date) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
