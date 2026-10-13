"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { isNavActive, type NavItem } from "@/lib/nav";
import { useUiStore } from "@/stores/ui-store";
import { SPRING_SNAPPY } from "@/lib/animation-tokens";

export interface NavLinkProps {
  item: NavItem;
  onNavigate?: () => void;
  className?: string;
  showActiveBar?: boolean;
}

// Enlace de navegación con estado activo animado y badge.
export function NavLink({
  item,
  onNavigate,
  className,
  showActiveBar = true,
}: NavLinkProps) {
  const pathname = usePathname();
  const setNavOpen = useUiStore((s) => s.setNavOpen);
  const active = isNavActive(item, pathname);
  const Icon = item.icon;

  const content = (
    <>
      {showActiveBar && active && (
        <motion.span
          layoutId="nav-active-bar"
          transition={SPRING_SNAPPY}
          className="absolute left-0 h-5 w-1 rounded-r bg-sidebar-primary"
        />
      )}
      <Icon
        className={cn(
          "size-[1.05rem] shrink-0 text-sidebar-foreground/60 transition-colors group-hover:text-sidebar-accent-foreground",
          active && "text-sidebar-primary"
        )}
      />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-xs font-medium leading-none tabular",
            item.badgeVariant === "destructive"
              ? "bg-destructive text-destructive-foreground"
              : item.badgeVariant === "secondary"
                ? "bg-secondary text-secondary-foreground"
                : item.badgeVariant === "outline"
                  ? "border text-muted-foreground"
                  : "bg-primary text-primary-foreground"
          )}
        >
          {item.badge}
        </span>
      )}
    </>
  );

  const classNameMerged = cn(
    "group relative flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground/80 desk:h-8 desk:rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
    className
  );

  if (!item.href) {
    return <div className={classNameMerged}>{content}</div>;
  }

  return (
    <Link
      href={item.href}
      onClick={() => {
        setNavOpen(false);
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      className={classNameMerged}
    >
      {content}
    </Link>
  );
}
