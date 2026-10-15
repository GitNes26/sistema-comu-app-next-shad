"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  CalendarDays,
  ChevronRight,
  Home,
  Newspaper,
  Radio,
  Ticket,
  Tv,
  UserRound,
  GraduationCap,
  HandCoins,
  HeartHandshake,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/base"
import { apiJson } from "@/lib/ministries/client"
import { POST_KINDS } from "@/lib/portal/rules"
import type { PortalHomeDto } from "@/lib/portal/server"

// Lo que pasa hoy en la iglesia, para el inicio del creyente: transmisión en vivo,
// su agenda, publicaciones recientes y accesos rápidos.

const SHORTCUTS = [
  { href: "/mi/escuela", label: "Mi escuela", icon: GraduationCap },
  { href: "/mi/ministerios", label: "Servir", icon: HeartHandshake },
  { href: "/mi/eventos", label: "Eventos", icon: Ticket },
  { href: "/mi/donativos", label: "Donativos", icon: HandCoins },
  { href: "/mi/transmisiones", label: "En vivo", icon: Tv },
  { href: "/mi/perfil", label: "Mi perfil", icon: UserRound },
]

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

export function PortalHighlights({
  compact = false,
}: { compact?: boolean } = {}) {
  const [home, setHome] = useState<PortalHomeDto | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    apiJson<{ home: PortalHomeDto }>("/api/portal/home")
      .then((r) => setHome(r.home))
      .catch(() => setFailed(true))
  }, [])

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {home?.live && (
        <Link
          href="/mi/transmisiones"
          className="press flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
            <Radio className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold tracking-wide text-destructive uppercase">
              En vivo ahora
            </span>
            <span className="block truncate font-medium">
              {home.live.title}
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      {!compact && (
        <nav
          aria-label="Accesos rápidos"
          className="grid grid-cols-3 gap-2 sm:grid-cols-6"
        >
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="press flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 py-3 text-center text-xs font-medium hover:border-primary/40"
            >
              <s.icon className="size-5 text-primary" />
              {s.label}
            </Link>
          ))}
        </nav>
      )}

      {!home && !failed && (
        <Skeleton className={compact ? "h-24 w-full" : "h-32 w-full"} />
      )}

      {home && home.pendingJoinRequests > 0 && (
        <Link
          href="/mi/ministerios"
          className="press flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm"
        >
          <HeartHandshake className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{home.pendingJoinRequests}</span>{" "}
            solicitud{home.pendingJoinRequests === 1 ? "" : "es"} para servir en
            tus ministerios
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      {home && home.agenda.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-primary" />
              Mi agenda
            </CardTitle>
            <CardDescription>Tus próximos eventos y tu célula.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-xl border">
              {home.agenda.slice(0, compact ? 3 : 8).map((a) => (
                <li key={`${a.kind}-${a.id}`}>
                  <Link
                    href={a.href}
                    className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm hover:bg-muted"
                  >
                    {a.kind === "event" ? (
                      <Ticket className="size-4 shrink-0 text-muted-foreground" />
                    ) : a.kind === "serve" ? (
                      <HeartHandshake className="size-4 shrink-0 text-primary" />
                    ) : (
                      <Home className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {a.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.at ? fmt(a.at) : a.detail}
                        {a.at && a.detail ? ` · ${a.detail}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {home && home.posts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="size-4 text-primary" />
              Novedades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="divide-y rounded-xl border">
              {home.posts.slice(0, compact ? 3 : 5).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/mi/contenido#${p.id}`}
                    className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {p.title}
                    </span>
                    <StatusPill tone="neutral" dot={false}>
                      {POST_KINDS[p.kind]}
                    </StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/mi/contenido"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ver todas <ChevronRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {home?.nextStream && !home.live && (
        <Link
          href="/mi/transmisiones"
          className="press flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm"
        >
          <Tv className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">
              Próxima transmisión
            </span>
            <span className="block truncate font-medium">
              {home.nextStream.title}
            </span>
            {home.nextStream.scheduledAt && (
              <span className="block text-xs text-muted-foreground">
                {fmt(home.nextStream.scheduledAt)}
              </span>
            )}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}
    </div>
  )
}
