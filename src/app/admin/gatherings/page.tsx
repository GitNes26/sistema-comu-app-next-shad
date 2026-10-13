import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { prisma } from "@/lib/db"
import { GatheringsAdmin } from "@/components/gatherings/gatherings-admin"

export const metadata: Metadata = { title: "Reuniones" }

export default async function AdminGatheringsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const globalManage = hasPermission(session, "gatherings.manage")
  const globalView = globalManage || hasPermission(session, "gatherings.view")

  // Quien lidera un grupo (Jóvenes, Varones…) gestiona las reuniones de su grupo.
  let leadsGroup = false
  if (!globalManage) {
    const orgId = effectiveOrgId(session)
    leadsGroup = orgId
      ? (await prisma.ministryMember.count({
          where: {
            organizationId: orgId,
            isActive: true,
            role: { in: ["leader", "assistant"] },
            member: { userId: session.user.id },
            ministry: { isActive: true, kind: { in: ["youth", "group"] } },
          },
        })) > 0
      : false
  }
  if (!globalView && !leadsGroup) redirect("/mi/reuniones")

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Reuniones</h1>
        <p className="text-sm text-muted-foreground">
          Servicios generales y de cada grupo (Jóvenes, Varones, Mujeres): tema, quién compartió y asistencia por categoría.
        </p>
      </div>
      <GatheringsAdmin canManage={globalManage || leadsGroup} />
    </div>
  )
}
