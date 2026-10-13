import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { prisma } from "@/lib/db"

// Identidad de la iglesia activa (nombre y logo) para encabezar documentos impresos.
export async function GET() {
  const session = await getServerSession(authOptions)
  const organizationId = effectiveOrgId(session)
  if (!session?.user || !organizationId) return NextResponse.json({ ok: false }, { status: 401 })
  const [org, company] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.companyProfile.findUnique({ where: { organizationId }, select: { tradeName: true, legalName: true, logoUrl: true } }),
  ])
  return NextResponse.json({
    ok: true,
    name: company?.tradeName ?? company?.legalName ?? org?.name ?? "",
    logoUrl: company?.logoUrl ?? null,
  })
}
