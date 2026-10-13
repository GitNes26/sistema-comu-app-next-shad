"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { NavSection } from "@/lib/nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { useUiStore } from "@/stores/ui-store";
import { SPRING_SOFT, TRANSITION_FADE_FAST } from "@/lib/animation-tokens";

// NavigationDrawer: slide-in con overlay (tablet y móvil < 1024px).
export function NavigationDrawer({
  sections,
  orgScope,
  orgActiveId,
}: {
  sections: NavSection[];
  /** Contexto de org para el OrgSwitcher del sidebar (el header lo oculta). */
  orgScope?: string | null;
  orgActiveId?: string | null;
}) {
  const navOpen = useUiStore((s) => s.navOpen);
  const setNavOpen = useUiStore((s) => s.setNavOpen);

  React.useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen, setNavOpen]);

  return (
    <AnimatePresence>
      {navOpen && (
        <div className="lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <motion.button
            type="button"
            aria-label="Cerrar menú"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={TRANSITION_FADE_FAST}
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={SPRING_SOFT}
            className="fixed inset-y-0 left-0 z-50 w-[min(88vw,320px)] border-r bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Cerrar"
              className="absolute right-2 top-3 z-10 flex size-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="size-4" />
            </button>
            <div className="h-full">
              <AppSidebar
                sections={sections}
                orgScope={orgScope}
                orgActiveId={orgActiveId}
                onOrgSwitched={() => setNavOpen(false)}
              />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}