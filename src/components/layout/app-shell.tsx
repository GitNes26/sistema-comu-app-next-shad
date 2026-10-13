"use client";

import * as React from "react";

import {
  BOTTOM_NAV,
  NAV_SECTIONS,
  filterNavSectionsByUserAndFeature,
  isNavHrefEnabled,
} from "@/lib/nav";
import type { PermissionKey } from "@/lib/auth/permission-keys";
import { useMenus } from "@/hooks/use-menus";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { NavigationDrawer } from "@/components/layout/navigation-drawer";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { RouteTransition } from "@/components/layout/route-transition";
import type { UserMenuUser } from "@/components/layout/user-menu"

export interface AppShellProps {
  user: UserMenuUser;
  permissions?: PermissionKey[];
  /** Permisos que el plan de la iglesia no incluye. */
  planDenied?: PermissionKey[];
  logoUrl?: string | null;
  children: React.ReactNode;
}

// Un solo shell adaptativo.
// El menú viene de la BD (useMenus) y cae al fallback hardcodeado mientras carga.
export function AppShell({ user, permissions, planDenied, logoUrl, children }: AppShellProps) {
  const { sections: dbSections, bottomItems } = useMenus();

  const fallbackSections = React.useMemo(
    () => filterNavSectionsByUserAndFeature({ user: { role: user.role, permissions, planDenied } }, NAV_SECTIONS),
    [user.role, permissions, planDenied]
  );
  // El árbol de BD también se filtra por funcionalidades habilitadas (href → feature).
  const sections = React.useMemo(() => {
    if (!dbSections) return fallbackSections;
    return dbSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.href || isNavHrefEnabled(item.href)),
      }))
      .filter((section) => section.items.length > 0);
  }, [dbSections, fallbackSections]);

  const bottomNav = React.useMemo(
    () => (bottomItems ?? BOTTOM_NAV).filter((item) => !item.href || isNavHrefEnabled(item.href)),
    [bottomItems]
  );

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r bg-sidebar lg:block">
        <AppSidebar
          sections={sections}
          logoUrl={logoUrl}
          orgScope={user.scope ?? null}
          orgActiveId={user.activeOrganizationId ?? null}
        />
      </aside>

      <div className="flex min-h-svh w-full flex-col lg:pl-[var(--sidebar-width)]">
        <AppHeader sections={sections} user={user} logoUrl={logoUrl} />

        <main className="flex-1 px-3 pb-24 pt-4 sm:px-4 md:px-6 md:pb-8 md:pt-6">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>

      <NavigationDrawer
        sections={sections}
        orgScope={user.scope ?? null}
        orgActiveId={user.activeOrganizationId ?? null}
      />
      <BottomTabBar
        items={bottomNav}
        permissions={permissions}
        role={user.role}
      />
    </div>
  );
}
