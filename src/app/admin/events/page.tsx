import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { prisma } from "@/lib/db"
import { EventsAdmin } from "@/components/events/events-admin"

export const metadata: Metadata = { title: "Eventos" }

export default async function AdminEventsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const manage = hasPermission(session, "events.manage")
  const view = manage || hasPermission(session, "events.view") || hasPermission(session, "events.checkin")

  // Quien lidera un grupo organiza los eventos de su grupo.
  let leadsGroup = false
  if (!view) {
    const orgId = effectiveOrgId(session)
    leadsGroup = orgId
      ? (await prisma.ministryMember.count({
          where: { organizationId: orgId, isActive: true, role: "leader", member: { userId: session.user.id }, ministry: { isActive: true } },
        })) > 0
      : false
  }
  if (!view && !leadsGroup) redirect("/mi/eventos")

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Eventos</h1>
        <p className="text-sm text-muted-foreground">Internos y externos, con itinerario, boletos, pagos y acomodo.</p>
      </div>
      <EventsAdmin canManageAll={manage} />
    </div>
  )
}
