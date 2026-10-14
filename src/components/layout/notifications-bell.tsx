"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import {
  Baby,
  Bell,
  BellRing,
  CheckCheck,
  CircleDollarSign,
  GraduationCap,
  HandHeart,
  HeartHandshake,
  Megaphone,
  Radio,
  Sparkles,
  Ticket,
  Wallet,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  useNotificationStore,
  type AppNotification,
} from "@/stores/notifications-store"
import { useNotificationSse } from "@/hooks/use-notifications"
import { LiveBadge } from "@/components/shared/live-badge"
import { SPRING_BOUNCE } from "@/lib/animation-tokens"
import { noticeGroup, type NoticeGroup } from "@/lib/notifications/kinds"

const ICONS: Record<NoticeGroup, React.ReactNode> = {
  event: <Ticket className="size-3.5" />,
  payment: <CircleDollarSign className="size-3.5" />,
  school: <GraduationCap className="size-3.5" />,
  ministry: <HeartHandshake className="size-3.5" />,
  kids: <Baby className="size-3.5" />,
  prayer: <HandHeart className="size-3.5" />,
  care: <Sparkles className="size-3.5" />,
  content: <Megaphone className="size-3.5" />,
  stream: <Radio className="size-3.5" />,
  finance: <Wallet className="size-3.5" />,
  system: <Bell className="size-3.5" />,
}

// Campana de notificaciones: badge animado + popover + SSE.
export function NotificationsBell({ className }: { className?: string } = {}) {
  useNotificationSse(true, "notifications-bell")

  const items = useNotificationStore((s) => s.items)
  const unread = useNotificationStore((s) => s.unread)
  const connected = useNotificationStore((s) => s.connected)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ""}`}
          className={cn("relative", className)}
        >
          <AnimatePresence>
            {unread > 0 ? (
              <motion.span
                key="ring"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <BellRing className="size-5" />
              </motion.span>
            ) : (
              <motion.span
                key="bell"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <Bell className="size-5" />
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={SPRING_BOUNCE}
                className="pointer-events-none absolute -top-1.5 -right-2"
              >
                <Badge className="h-4 min-w-4 rounded-full px-1 py-0 text-[0.6rem] leading-none font-bold tabular-nums ring-2 ring-background">
                  {unread > 9 ? "9+" : unread}
                </Badge>
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notificaciones</span>
            <LiveBadge compact className="text-[0.65rem]" />
          </div>
          {unread > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={markAllRead}
            >
              <CheckCheck className="size-3.5" />
              Leer todo
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto overscroll-contain">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Sparkles className="size-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                Sin notificaciones
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onMark={markRead}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t px-3 py-2 text-center text-[0.65rem] text-muted-foreground">
          {connected
            ? "Conectado al servidor de eventos."
            : "Sin conexión SSE: reintentando…"}
        </div>
        <div className="border-t px-3 py-1.5 text-center">
          <Link
            href="/mi/notificaciones"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-accent"
          >
            <Bell className="size-3.5" />
            Ver todas las notificaciones
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NotificationRow({
  n,
  onMark,
  onNavigate,
}: {
  n: AppNotification
  onMark: (id: string) => void
  onNavigate?: () => void
}) {
  const content = (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          n.read
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary"
        )}
      >
        {ICONS[noticeGroup(n.kind)]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{n.title}</span>
          {!n.read && (
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
          )}
        </span>
        {n.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            {n.description}
          </span>
        )}
        <time className="mt-0.5 block text-[0.65rem] text-muted-foreground/70">
          {formatDistanceToNow(new Date(n.createdAt), {
            addSuffix: true,
            locale: es,
          })}
        </time>
      </span>
    </>
  )

  const rowClass = cn(
    "flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/60",
    !n.read && "bg-primary/[0.03]"
  )

  if (n.href) {
    return (
      <li>
        <Link
          href={n.href}
          className={rowClass}
          onClick={() => {
            onMark(n.id)
            onNavigate?.()
          }}
        >
          {content}
        </Link>
      </li>
    )
  }

  return (
    <li className={rowClass} onClick={() => onMark(n.id)}>
      {content}
    </li>
  )
}
