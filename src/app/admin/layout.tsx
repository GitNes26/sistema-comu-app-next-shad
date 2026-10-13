import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { getAppSettings } from "@/lib/db/app-settings"
import { prisma } from "@/lib/db"
import { AppearanceSync } from "@/components/appearance/appearance-sync"
import { Splash } from "@/components/appearance/splash"
import { AppShell } from "@/components/layout/app-shell"
import { SessionGuard } from "@/components/auth/session-guard"
import { OrganizationContextSync } from "@/components/auth/organization-context-sync"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/auth/login")
  }
  const organizationId = session.user.activeOrganizationId ?? session.user.organizationId ?? null
  const tenant = organizationId ? await getAppSettings(organizationId) : null

  let logoUrl: string | null = null
  let orgName: string | null = null
  let organizationName: string | null = null
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, companyProfile: { select: { tradeName: true, logoUrl: true } } },
    })
    logoUrl = org?.companyProfile?.logoUrl ?? null
    orgName = org?.companyProfile?.tradeName ?? org?.name ?? null
    organizationName = org?.name ?? null
  }

  return (
    <SessionGuard loginPath="/auth/login">
      <>
        <AppearanceSync tenant={tenant} />
        <OrganizationContextSync organizationId={organizationId} organizationName={organizationName} />
        <Splash orgName={orgName} logoUrl={logoUrl} />
        <AppShell
          logoUrl={logoUrl}
          permissions={session?.user?.permissions}
          planDenied={session?.user?.planDenied}
          user={{
            name: session?.user?.name,
            email: session?.user?.email,
            image: session?.user?.image,
            role: session?.user?.role,
            roleName: session?.user?.roleName,
            scope: session?.user?.scope,
            organizationId: session?.user?.organizationId,
            activeOrganizationId: session?.user?.activeOrganizationId,
          }}
        >
          {children}
        </AppShell>
      </>
    </SessionGuard>
  )
}
