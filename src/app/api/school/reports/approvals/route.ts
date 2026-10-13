import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"
import { getApprovalsReport } from "@/lib/school/server"

export const dynamic = "force-dynamic"

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → aprobados por grupo y por libro en el periodo.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const u = new URL(req.url)
    return NextResponse.json({ ok: true, report: await getApprovalsReport(ctx.actor, u.searchParams.get("from") ?? "", u.searchParams.get("to") ?? "") })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
