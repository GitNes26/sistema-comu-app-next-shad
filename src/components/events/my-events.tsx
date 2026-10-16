"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, MapPin, Ticket } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { EventRowDto } from "@/lib/events/server"
import { money } from "./events-admin"

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })

// Eventos para cualquier integrante: los de su público, con su boleto si ya lo tiene.
export function MyEvents() {
  const [events, setEvents] = useState<EventRowDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ events: EventRowDto[] }>("/api/events?scope=mine&upcoming=1")
      .then((d) => setEvents(d.events))
      .catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <EmptyState icon={Ticket} title="No se pudieron cargar los eventos" description={error} />
  if (!events) return <Skeleton className="h-40 w-full" />
  if (events.length === 0) return <EmptyState icon={CalendarDays} title="Sin eventos próximos" description="Cuando se publique un evento para ti, aparecerá aquí." />

  return (
    <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {events.map((e) => {
        const d = new Date(e.startsAt)
        return (
          <li key={e.id}>
            <Link href={`/mi/eventos/${e.id}`} className="press group flex h-full gap-3 overflow-hidden rounded-2xl border bg-card p-3 transition-colors hover:border-primary/40">
              <span className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 py-2 text-primary">
                <span className="font-heading text-2xl leading-none font-semibold tabular-nums">{d.getDate()}</span>
                <span className="text-[0.7rem] font-semibold tracking-wide uppercase">{d.toLocaleDateString("es-MX", { month: "short" }).replace(".", "")}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 text-sm font-semibold">{e.name}</span>
                  {e.myTicket && <StatusPill tone={e.myTicket.status === "paid" ? "success" : "warning"}>Tu boleto</StatusPill>}
                </span>
                <span className="text-xs text-muted-foreground first-letter:uppercase">{fmtWhen(e.startsAt)}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{e.kind}</span>
                  {(e.venueName || e.location) && (
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="size-3 shrink-0" /> <span className="truncate">{e.venueName ?? e.location}</span>
                    </span>
                  )}
                  <span>{e.price > 0 ? money(e.price) : "Sin costo"}</span>
                </span>
                {!e.myTicket && !e.canRegister && e.status === "published" && <span className="text-xs text-destructive">Sin lugares disponibles</span>}
                {!e.myTicket && e.canRegister && <span className="mt-auto text-xs font-medium text-primary">Apartar mi boleto →</span>}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
