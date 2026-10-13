"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import packageJson from "../../../package.json";

import { cn } from "@/lib/utils";
import { isNavActive, type NavItem, type NavSection } from "@/lib/nav";
import { NavLink } from "@/components/layout/nav-link";
import { Logo } from "@/components/layout/logo";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface AppSidebarProps {
  sections: NavSection[];
  logoUrl?: string | null;
  /** Contexto de org para el OrgSwitcher del footer (sidebar y drawer). */
  orgScope?: string | null;
  orgActiveId?: string | null;
}

// Sidebar agrupada por secciones colapsables + items multinivel.
function NavNode({ item, depth }: { item: NavItem; depth: number }) {
  const pathname = usePathname();
  const children = item.children?.filter(Boolean) ?? [];
  const key = item.href ?? item.label;

  if (children.length === 0) {
    return (
      <motion.div
        key={key}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15 }}
      >
        <NavLink item={item} className={cn(depth > 0 && "pl-7")} />
      </motion.div>
    );
  }

  const active = isNavActive(item, pathname);
  return (
    <div key={key} className="space-y-0.5">
      <div className="flex items-center gap-0.5">
        <NavLink item={item} className="min-w-0 flex-1" />
        <CollapsibleTrigger
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            active && "text-sidebar-primary"
          )}
        >
          <ChevronDown className="size-3.5 transition-transform group-data-[state=open]/item:rotate-180" />
        </CollapsibleTrigger>
      </div>
      <Collapsible className="group/item">
        <CollapsibleContent>
          <div className="ml-4 space-y-0.5 border-l border-sidebar-border/50 pl-1">
            {children.map((c) => (
              <NavNode key={c.href ?? c.label} item={c} depth={depth + 1} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function AppSidebar({
  sections,
  logoUrl,
  orgScope,
  orgActiveId,
  onOrgSwitched,
}: AppSidebarProps & { onOrgSwitched?: () => void }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState(true);

  React.useEffect(() => {
    const update = () => {
      const w = getComputedStyle(document.documentElement)
        .getPropertyValue("--sidebar-width")
        .trim();
      setExpanded(!w || parseInt(w, 10) > 80);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Logo size={20} logoUrl={logoUrl} className="rounded-lg" />
        {expanded && (
          <span className="text-sm font-semibold tracking-tight">COMU-APP</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {sections.map((section, si) => {
          const openedByDefault =
            section.items.some((item) => isNavActive(item, pathname)) ||
            si === 0;
          return (
            <Collapsible
              key={section.title ?? `section-${si}`}
              defaultOpen={openedByDefault}
              className="group/collapsible"
            >
              <CollapsibleTrigger className="flex h-9 w-full items-center justify-between rounded-md px-2 text-xs font-semibold text-sidebar-foreground/55 desk:h-7 transition-colors hover:text-sidebar-foreground">
                <span>{section.title}</span>
                {expanded && (
                  <ChevronDown className="size-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-0.5 pb-1 pt-0.5">
                  {section.items.map((item) => (
                    <NavNode key={item.href ?? item.label} item={item} depth={0} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      {/* Pie: selector de organización (convención móvil) + versión. */}
      <div className="shrink-0 space-y-2 border-t p-3">
        {orgScope === "superadmin" || orgScope === "app" ? (
          <OrgSwitcher
            variant="sidebar"
            activeOrganizationId={orgActiveId ?? null}
            scope={orgScope}
            onSwitched={onOrgSwitched}
          />
        ) : null}
        <p className={cn("text-xs text-sidebar-foreground/50", !expanded && "hidden")}>
          COMU-APP v{packageJson.version}
        </p>
      </div>
    </div>
  );
}
