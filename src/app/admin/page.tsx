import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { LayoutDashboard } from "lucide-react";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getPanelSummary } from "@/lib/panel/server";
import { PageHeader } from "@/components/layout/page-header";
import { AdminDashboard } from "@/components/admin/dashboard/dashboard";
import { PanelBackdrop, QuickAccess } from "@/components/admin/dashboard/panel-home";

export const metadata: Metadata = { title: "Panel" };

// Panel: cifras de la iglesia para quien puede ver estadísticos; accesos
// directos del rol para quien no. El logo de la iglesia va de fondo tenue.
// Las cifras se calculan en servidor y se acotan a la iglesia de la sesión.

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const organizationId = effectiveOrgId(session);
  const logoUrl = organizationId
    ? ((await prisma.companyProfile.findUnique({ where: { organizationId }, select: { logoUrl: true } }))?.logoUrl ?? null)
    : null;
  const canStats = Boolean(organizationId) && hasPermission(session, "panel.stats");
  const summary = canStats && organizationId ? await getPanelSummary(organizationId) : null;

  return (
    <div className="relative isolate min-h-[70dvh]">
      <PanelBackdrop logoUrl={logoUrl} />
      <PageHeader
        icon={<LayoutDashboard className="size-5" />}
        title="Panel"
        description={summary ? "El estado de tu iglesia de un vistazo." : "Tus accesos directos."}
      />
      {summary ? (
        <AdminDashboard
          summary={summary}
          canViewMembers={hasPermission(session, "members.view")}
          canViewReports={hasPermission(session, "reports.view")}
        />
      ) : (
        <QuickAccess roleName={session?.user?.roleName ?? null} />
      )}
    </div>
  );
}
