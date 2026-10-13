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
    <ul className="grid gap-3 sm:grid-cols-2">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={`/mi/eventos/${e.id}`} className="press flex h-full flex-col overflow-hidden rounded-2xl border bg-card hover:border-primary/40">
            {e.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.imageUrl} alt="" className="h-32 w-full object-cover" />
            )}
            <span className="flex flex-1 flex-col gap-1 p-3">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{e.name}</span>
                {e.myTicket && <StatusPill tone={e.myTicket.status === "paid" ? "success" : "warning"}>Tu boleto</StatusPill>}
              </span>
              <span className="text-xs text-muted-foreground first-letter:uppercase">{fmtWhen(e.startsAt)}</span>
              <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <span>{e.kind}</span>
                {(e.venueName || e.location) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3" /> {e.venueName ?? e.location}
                  </span>
                )}
                <span>{e.price > 0 ? money(e.price) : "Sin costo"}</span>
              </span>
              {!e.myTicket && !e.canRegister && e.status === "published" && <span className="text-xs text-destructive">Sin lugares disponibles</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
