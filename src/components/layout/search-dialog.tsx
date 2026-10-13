"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";

import { NavItem, NavSection } from "@/lib/nav";
import { useUiStore } from "@/stores/ui-store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type SearchItem = NavItem & { group: string; href: string };

// Búsqueda global de navegación (Cmd/Ctrl+K).
export function SearchDialog({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const searchOpen = useUiStore((s) => s.searchOpen);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(!useUiStore.getState().searchOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  const items = React.useMemo(() => {
    const out: SearchItem[] = [];
    const walk = (list: NavItem[], group: string) => {
      for (const it of list) {
        if (it.href) out.push({ ...it, group, href: it.href });
        if (it.children) walk(it.children, group);
      }
    };
    for (const s of sections) walk(s.items, s.title ?? "General");
    return out;
  }, [sections]);

  const groups = React.useMemo(
    () => Array.from(new Set(items.map((i) => i.group))),
    [items]
  );

  return (
    <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
      <CommandInput placeholder="Buscar página o acción…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group} heading={group}>
            {items
              .filter((i) => i.group === group)
              .map((i) => (
                <CommandItem
                  key={i.href}
                  value={`${i.label} ${i.href}`}
                  onSelect={() => {
                    router.push(i.href);
                    setSearchOpen(false);
                  }}
                >
                  <i.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{i.label}</span>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
                    <CornerDownLeft className="size-2.5" />
                  </kbd>
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function SearchTrigger() {
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  return (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className="flex h-10 w-full min-w-0 max-w-56 desk:h-8 items-center gap-2 rounded-lg border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70"
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Buscar…</span>
      <kbd className="rounded border bg-background px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
