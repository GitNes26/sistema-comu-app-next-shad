import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { loadLogoPng } from "@/lib/documents/branding"
import { getGradebook } from "@/lib/school/server"
import { renderGradebookPdf } from "@/lib/school/gradebook-pdf"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET → lista de asistencia y calificaciones del grupo en PDF (mismo acceso que la planilla).
export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { groupId } = await params
    const book = await getGradebook(ctx.actor, groupId)
    const [org, profile] = await Promise.all([
      prisma.organization.findUnique({ where: { id: ctx.actor.organizationId }, select: { name: true } }),
      prisma.companyProfile.findUnique({ where: { organizationId: ctx.actor.organizationId }, select: { tradeName: true, logoUrl: true } }),
    ])
    const pdf = await renderGradebookPdf(book, {
      organizationName: profile?.tradeName ?? org?.name ?? "Iglesia",
      logo: await loadLogoPng(profile?.logoUrl, 240),
    })
    const slug = `${book.group.courseName}-${book.group.name}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="lista-${slug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
