import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { prisma } from "@/lib/db"
import { SchoolAdmin } from "@/components/school/school-admin"

export const metadata: Metadata = { title: "Escuela ministerial" }

export default async function AdminSchoolPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  let allowed = hasPermission(session, "school.view") || hasPermission(session, "school.manage")
  if (!allowed) {
    // El director o subdirector administra su programa sin permiso global.
    const orgId = effectiveOrgId(session)
    allowed = orgId
      ? (await prisma.school.count({
          where: {
            organizationId: orgId,
            OR: [{ director: { userId: session.user.id } }, { subdirector: { userId: session.user.id } }],
          },
        })) > 0
      : false
  }
  if (!allowed) redirect("/mi/escuela")
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Escuela ministerial</h1>
        <p className="text-sm text-muted-foreground">Programas, libros, grupos, inscripciones y calificaciones.</p>
      </div>
      <SchoolAdmin />
    </div>
  )
}
