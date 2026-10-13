import { NextResponse } from "next/server"
import { getReport } from "@/lib/gatherings/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?month=&kind= → asistencia del mes por categoría y por horario.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const u = new URL(req.url)
    return NextResponse.json({ ok: true, report: await getReport(ctx.actor, u.searchParams.get("month") ?? undefined, u.searchParams.get("kind") ?? undefined, u.searchParams.get("ministryId") ?? undefined) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
