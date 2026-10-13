"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { isNavActive, type NavSection } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { SearchDialog, SearchTrigger } from "@/components/layout/search-dialog";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { PushSubscriber } from "@/components/shared/push-subscriber";
import { RoleBadge } from "@/components/shared/role-badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu, type UserMenuUser } from "@/components/layout/user-menu";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { useUiStore } from "@/stores/ui-store";
import { usePushSound } from "@/hooks/use-push-sound";

export interface AppHeaderProps {
  sections: NavSection[];
  user: UserMenuUser;
  logoUrl?: string | null;
}

// Header sticky: menú, buscador, notificaciones y usuario.
export function AppHeader({ sections, user, logoUrl }: AppHeaderProps) {
  const pathname = usePathname();
  const toggleNav = useUiStore((s) => s.toggleNav);
  const navOpen = useUiStore((s) => s.navOpen);
  usePushSound();

  const activeLabel = React.useMemo(() => {
    for (const section of sections) {
      const found = section.items.find((item) => isNavActive(item, pathname));
      if (found) return found.label;
    }
    return "Panel";
  }, [sections, pathname]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/92 supports-backdrop-filter:bg-background/75 supports-backdrop-filter:backdrop-blur-lg">
      <div className="flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 pt-[env(safe-area-inset-top)] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1rem,env(safe-area-inset-left))]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={navOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={navOpen}
          onClick={toggleNav}
          className="lg:hidden"
        >
          <Menu className="size-4" />
        </Button>

        <Logo size={18} logoUrl={logoUrl} className="hidden rounded-lg sm:block lg:hidden" />

        <span className="hidden h-4 w-px bg-border lg:block" aria-hidden />

        <span
          className={cn(
            "min-w-0 truncate text-sm font-semibold",
            "flex-1 sm:flex-none lg:w-40"
          )}
        >
          {activeLabel}
        </span>

        <div className="hidden flex-1 justify-center md:flex">
          <SearchTrigger />
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {user.scope === "superadmin" || user.scope === "app" ? (
            <OrgSwitcher
              activeOrganizationId={user.activeOrganizationId ?? null}
              scope={user.scope ?? null}
            />
          ) : null}
          <RoleBadge
            roleName={user.roleName}
            role={user.role}
            className="hidden lg:inline-flex"
          />
          <ThemeToggle />
          <NotificationsBell />
          <PushSubscriber />
          <UserMenu user={user} />
        </div>
      </div>

      <SearchDialog sections={sections} />
    </header>
  );
}