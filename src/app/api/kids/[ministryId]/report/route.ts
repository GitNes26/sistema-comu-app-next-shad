import { NextResponse } from "next/server"
import { getReport } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?month=YYYY-MM → asistencia del mes por servicio y salón.
export async function GET(req: Request, { params }: { params: Promise<{ ministryId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    const month = new URL(req.url).searchParams.get("month") ?? ""
    return NextResponse.json({ ok: true, report: await getReport(ctx.actor, ministryId, month) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
