import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { loadLogoPng } from "@/lib/documents/branding"
import { getFollowUpSheet, parseSheetMonth } from "@/lib/cells/followup"
import { renderFollowUpPdf } from "@/lib/cells/followup-pdf"
import { listSheetCellIds } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_CELLS = 60

// GET ?month=YYYY-MM&cellId=…&networkId=…&format=json|pdf
// Con `cellId`: la hoja de esa célula. Sin él: la de todas las células a las que tienes acceso
// (opcionalmente de una red), una hoja por página.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const q = new URL(req.url).searchParams
    const month = q.get("month")
    const { year, monthIndex } = parseSheetMonth(month)
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`
    const cellId = q.get("cellId")
    const ids = cellId ? [cellId] : (await listSheetCellIds(ctx.actor, q.get("networkId"))).slice(0, MAX_CELLS)
    const sheets = []
    for (const id of ids) sheets.push(await getFollowUpSheet(ctx.actor, id, monthKey))

    if (q.get("format") === "pdf") {
      const [org, profile] = await Promise.all([
        prisma.organization.findUnique({ where: { id: ctx.actor.organizationId }, select: { name: true } }),
        prisma.companyProfile.findUnique({ where: { organizationId: ctx.actor.organizationId }, select: { tradeName: true, logoUrl: true } }),
      ])
      const pdf = await renderFollowUpPdf(sheets, {
        organizationName: profile?.tradeName ?? org?.name ?? "Iglesia",
        logo: await loadLogoPng(profile?.logoUrl, 240),
      })
      const slug = sheets.length === 1 ? sheets[0].cell.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "todas"
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="seguimiento-${slug}-${monthKey}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      })
    }
    return NextResponse.json({ ok: true, month: monthKey, sheets })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
