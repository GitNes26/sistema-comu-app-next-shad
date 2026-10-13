"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  ClipboardList,
  Loader2,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { useNotificationStore } from "@/stores/notifications-store";
import { useNotificationSse } from "@/hooks/use-notifications";
import { LiveBadge } from "@/components/shared/live-badge";

// Centro de notificaciones (lista completa, leer individual y batch).

interface Row {
  id: string;
  kind: string;
  severity: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const ICONS: Record<string, React.ReactNode> = {
  "sale-complete": <ShoppingCart className="size-4" />,
  sale: <ShoppingCart className="size-4" />,
  "low-stock": <AlertTriangle className="size-4" />,
  "order-received": <ClipboardList className="size-4" />,
  "order-ready": <ClipboardList className="size-4" />,
  order: <ClipboardList className="size-4" />,
};

export function NotificationsCenter({ icon }: { icon?: React.ReactNode }) {
  useNotificationSse();

  const router = useRouter();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const storeMarkRead = useNotificationStore((s) => s.markRead);
  const storeMarkAll = useNotificationStore((s) => s.markAllRead);
  const liveItems = useNotificationStore((s) => s.items);

  const load = useCallback(
    async (targetPage = 1, keep = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(targetPage), pageSize: "50" });
        if (tab === "unread") params.set("filter", "unread");
        const res = await fetch(`/api/notifications?${params.toString()}`);
        const data = (await res.json()) as { rows: Row[]; total: number };
        setRows((prev) => (keep ? [...prev, ...data.rows] : data.rows));
        setTotal(data.total);
      } catch {
        // silencioso: el SSE ya trae lo reciente
      } finally {
        setLoading(false);
      }
    },
    [tab]
  );

  useEffect(() => {
    setPage(1);
    load(1, false);
  }, [load]);

  // Cuando llegan notificaciones en vivo por SSE, refresca si hay página 1.
  useEffect(() => {
    if (liveItems.length > 0 && page === 1) {
      load(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveItems.length]);

  const markRead = (r: Row) => {
    if (r.read) return;
    storeMarkRead(r.id);
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, read: true } : x)));
  };

  const markAll = async () => {
    storeMarkAll();
    setRows((prev) => prev.map((x) => ({ ...x, read: true })));
    await fetch("/api/notifications/read-all", { method: "POST" }).catch((err) => {
      console.error("[notifications] mark all read failed:", err);
    });
  };

  const unreadCount = rows.filter((r) => !r.read).length;

  return (
    <>
      <PageHeader
        icon={icon}
        title="Notificaciones"
        description="Centro de notificaciones de tu organización."
        actions={
          <div className="flex items-center gap-2">
            <LiveBadge />
            {unreadCount > 0 && (
              <Button size="sm" onClick={markAll}>
                <CheckCheck className="size-4" />
                Marcar todo leído
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">
            <span className="flex items-center gap-1.5">
              <Bell className="size-4" /> Todas ({total})
            </span>
          </TabsTrigger>
          <TabsTrigger value="unread">
            <span className="flex items-center gap-1.5">
              <BellRing className="size-4" /> No leídas ({unreadCount})
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="mt-4">
        <CardContent className="pt-5">
          {loading && rows.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Sparkles className="size-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                {tab === "unread" ? "No tienes notificaciones sin leer." : "Sin notificaciones todavía."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <ul className="divide-y rounded-lg border">
                {rows.map((r) => (
                  <NotificationRow
                    key={r.id}
                    r={r}
                    onClick={() => {
                      if (r.link) router.push(r.link);
                      else markRead(r);
                    }}
                    onMark={() => markRead(r)}
                  />
                ))}
              </ul>
              {total > rows.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={loading}
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    load(next, true);
                  }}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                  Cargar más
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function NotificationRow({
  r,
  onClick,
  onMark,
}: {
  r: Row;
  onClick: () => void;
  onMark: () => void;
}) {
  return (
    <li
      className={cn(
        "flex cursor-pointer items-start gap-3 px-3 py-3 transition-colors hover:bg-accent/50",
        !r.read && "bg-primary/[0.03]"
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
          r.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
        )}
      >
        {ICONS[r.kind] ?? <Bell className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-sm font-medium">{r.title}</span>
          {!r.read && <Badge className="h-4 px-1.5 text-[0.6rem]">Nuevo</Badge>}
        </span>
        {r.body && <span className="mt-0.5 block text-xs text-muted-foreground">{r.body}</span>}
        <time className="mt-0.5 block text-[0.65rem] text-muted-foreground/70">
          {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: es })}
        </time>
      </span>
      {!r.read && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="size-10 shrink-0 desk:size-7"
          onClick={(e) => {
            e.stopPropagation();
            onMark();
          }}
        >
          <CheckCheck className="size-3.5" />
        </Button>
      )}
    </li>
  );
}