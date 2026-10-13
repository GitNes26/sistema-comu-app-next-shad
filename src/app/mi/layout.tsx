import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { LayoutDashboard } from "lucide-react"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { getAppSettings } from "@/lib/db/app-settings"
import { prisma } from "@/lib/db"
import { AppearanceSync } from "@/components/appearance/appearance-sync"
import { SessionGuard } from "@/components/auth/session-guard"
import { OrganizationContextSync } from "@/components/auth/organization-context-sync"
import { Logo } from "@/components/layout/logo"
import { NotificationsBell } from "@/components/layout/notifications-bell"
import { PushSubscriber } from "@/components/shared/push-subscriber"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"
import { OrgSwitcher } from "@/components/layout/org-switcher"
import { Button } from "@/components/ui/button"

// Marco de «Mi espacio»: barra superior ligera (sin menú administrativo). Lo usa el
// creyente y también quien opera la iglesia cuando consulta su espacio personal.

export default async function MiLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const organizationId = effectiveOrgId(session)
  if (!organizationId && session.user.scope !== "superadmin") redirect("/auth/onboarding")

  const [tenant, org] = await Promise.all([
    organizationId ? getAppSettings(organizationId) : null,
    organizationId
      ? prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true, companyProfile: { select: { tradeName: true, logoUrl: true } } },
        })
      : null,
  ])
  const logoUrl = org?.companyProfile?.logoUrl ?? null
  const churchName = org?.companyProfile?.tradeName ?? org?.name ?? "COMU-APP"
  const isStaff = session.user.scope !== "portal"

  return (
    <SessionGuard loginPath="/auth/login">
      <>
        <AppearanceSync tenant={tenant} />
        <OrganizationContextSync organizationId={organizationId} organizationName={org?.name ?? null} />
        <div className="min-h-svh bg-background">
          <header className="sticky top-0 z-30 border-b bg-background/92 supports-backdrop-filter:bg-background/75 supports-backdrop-filter:backdrop-blur-lg">
            <div className="mx-auto flex h-[calc(3.5rem+env(safe-area-inset-top))] max-w-3xl items-center gap-2 pt-[env(safe-area-inset-top)] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]">
              <Link href="/mi" className="flex min-w-0 items-center gap-2">
                <Logo size={20} logoUrl={logoUrl} className="rounded-lg" />
                <span className="truncate font-heading text-sm font-semibold">{churchName}</span>
              </Link>
              <div className="ml-auto flex shrink-0 items-center gap-0.5">
                {isStaff && (
                  <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link href="/admin">
                      <LayoutDashboard className="size-4" />
                      Panel
                    </Link>
                  </Button>
                )}
                <OrgSwitcher activeOrganizationId={organizationId} scope={session.user.scope} />
                <ThemeToggle />
                <NotificationsBell />
                <PushSubscriber />
                <UserMenu
                  user={{
                    name: session.user.name,
                    email: session.user.email,
                    image: session.user.image,
                    role: session.user.role,
                    roleName: session.user.roleName,
                    scope: session.user.scope,
                    organizationId: session.user.organizationId,
                    activeOrganizationId: session.user.activeOrganizationId,
                  }}
                />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 sm:px-4">{children}</main>
        </div>
      </>
    </SessionGuard>
  )
}
