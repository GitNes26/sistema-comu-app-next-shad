import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { loadLogoPng } from "@/lib/documents/branding"
import { renderReportPdf } from "@/lib/reports/pdf"
import { isCompareMode, reportToCsv, resolvePeriod } from "@/lib/reports/rules"
import { buildReportComparative } from "@/lib/reports/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|pdf|csv&compare=none|previous|year
export async function GET(req: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { reportId } = await params
    const q = new URL(req.url).searchParams
    const period = resolvePeriod(q.get("from"), q.get("to"))
    const cmp = q.get("compare")
    const doc = await buildReportComparative(ctx.actor, reportId, period, isCompareMode(cmp) ? cmp : "none")
    const format = q.get("format")
    const file = `reporte-${reportId}-${period.from}_${period.to}`
    if (format === "pdf") {
      const [org, profile] = await Promise.all([
        prisma.organization.findUnique({ where: { id: ctx.actor.organizationId }, select: { name: true } }),
        prisma.companyProfile.findUnique({ where: { organizationId: ctx.actor.organizationId }, select: { tradeName: true, logoUrl: true } }),
      ])
      const pdf = await renderReportPdf(doc, {
        organizationName: profile?.tradeName ?? org?.name ?? "Iglesia",
        logo: await loadLogoPng(profile?.logoUrl, 240),
      })
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${file}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      })
    }
    if (format === "csv") {
      return new NextResponse(reportToCsv(doc), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${file}.csv"`,
          "Cache-Control": "private, no-store",
        },
      })
    }
    return NextResponse.json({ ok: true, report: doc, period })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
