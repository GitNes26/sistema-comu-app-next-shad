"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, ChevronLeft, ChevronRight, Repeat, Ticket, Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { apiJson } from "@/lib/ministries/client"
import { slotRange } from "@/lib/connect/rules"

// Calendario de la iglesia: eventos (con enlace a su boleto) y reuniones recurrentes
// proyectadas sobre el mes. Un mes a la vez, con el día elegido en detalle.

interface EventRow {
  id: string
  name: string
  kind: string
  startsAt: string
  location: string | null
  venueName: string | null
  price: number
  groupName: string | null
  status: string
  myTicket: { id: string; status: string; seatCode: string | null } | null
}
interface Slot {
  id: string
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string | null
  modality: string
}
interface Item {
  key: string
  type: "event" | "series"
  title: string
  time: string
  detail: string | null
  href: string | null
  online: boolean
  mine: boolean
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export function ChurchCalendar() {
  const today = new Date()
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(ymd(today))
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>(null)

  useEffect(() => {
    apiJson<{ events: EventRow[] }>("/api/events?scope=mine")
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]))
    apiJson<{ slots: Slot[] }>("/api/portal/week")
      .then((d) => setSlots(d.slots))
      .catch(() => setSlots([]))
  }, [])

  // Celdas del mes: de lunes a domingo, con los días de relleno de los meses vecinos.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [cursor])

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>()
    const push = (day: string, item: Item) => map.set(day, [...(map.get(day) ?? []), item])
    for (const e of events ?? []) {
      if (e.status === "cancelled") continue
      const d = new Date(e.startsAt)
      push(ymd(d), {
        key: `e-${e.id}`,
        type: "event",
        title: e.name,
        time: d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }),
        detail: [e.venueName ?? e.location, e.price > 0 ? `$${e.price.toLocaleString("es-MX")}` : "Entrada libre"].filter(Boolean).join(" · "),
        href: `/mi/eventos/${e.id}`,
        online: false,
        mine: Boolean(e.myTicket),
      })
    }
    for (const cell of cells) {
      for (const s of slots ?? []) {
        if (s.dayOfWeek !== cell.getDay()) continue
        push(ymd(cell), {
          key: `s-${s.id}-${ymd(cell)}`,
          type: "series",
          title: s.name,
          time: slotRange(s.startTime, s.endTime),
          detail: null,
          href: null,
          online: s.modality !== "in_person",
          mine: false,
        })
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time))
    return map
  }, [events, slots, cells])

  const monthLabel = cursor.toLocaleDateString("es-MX", { month: "long", year: "numeric" })
  const selectedItems = byDay.get(selected) ?? []
  const selectedDate = new Date(`${selected}T12:00:00`)

  if (events === null || slots === null) return <Skeleton className="h-[32rem] w-full" />

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
          <CalendarDays className="size-6 text-primary" /> Calendario
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="icon-sm" variant="outline" aria-label="Mes anterior" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center font-heading text-sm font-semibold first-letter:uppercase">{monthLabel}</span>
          <Button size="icon-sm" variant="outline" aria-label="Mes siguiente" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
              setSelected(ymd(today))
            }}
          >
            Hoy
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day) => {
              const key = ymd(day)
              const inMonth = day.getMonth() === cursor.getMonth()
              const items = byDay.get(key) ?? []
              const events = items.filter((i) => i.type === "event")
              const isToday = key === ymd(today)
              const isSel = key === selected
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  aria-label={`${day.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}: ${items.length} actividades`}
                  aria-pressed={isSel}
                  className={cn(
                    "flex min-h-16 flex-col items-start gap-1 border-r border-b p-1.5 text-left transition-colors last:border-r-0 sm:min-h-24 [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-muted/30 text-muted-foreground/60",
                    isSel && "bg-primary/8 ring-2 ring-primary/50 ring-inset"
                  )}
                >
                  <span className={cn("grid size-6 place-items-center rounded-full text-xs font-medium tabular-nums", isToday && "bg-primary text-primary-foreground")}>{day.getDate()}</span>
                  <span className="hidden w-full flex-col gap-0.5 sm:flex">
                    {events.slice(0, 2).map((i) => (
                      <span key={i.key} className="truncate rounded bg-primary px-1 py-0.5 text-[0.65rem] leading-tight font-medium text-primary-foreground">
                        {i.title}
                      </span>
                    ))}
                    {items.length - Math.min(events.length, 2) > 0 && (
                      <span className="truncate text-[0.65rem] text-muted-foreground">+{items.length - Math.min(events.length, 2)} más</span>
                    )}
                  </span>
                  {/* Móvil: puntos en lugar de texto */}
                  <span className="flex gap-0.5 sm:hidden">
                    {events.length > 0 && <span className="size-1.5 rounded-full bg-primary" />}
                    {items.length > events.length && <span className="size-1.5 rounded-full bg-muted-foreground/50" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="space-y-3 rounded-2xl border bg-card p-4 lg:sticky lg:top-0 lg:self-start">
          <h2 className="font-heading text-base font-semibold first-letter:uppercase">
            {selectedDate.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay actividades este día.</p>
          ) : (
            <ul className="space-y-2">
              {selectedItems.map((i) => {
                const body = (
                  <span className={cn("flex items-start gap-3 rounded-xl border p-3", i.type === "event" ? "border-primary/30 bg-primary/5" : "bg-muted/30")}>
                    <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", i.type === "event" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {i.type === "event" ? <Ticket className="size-4" /> : <Repeat className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{i.title}</span>
                      <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
                        {i.online && <Wifi className="size-3" />}
                        {i.time}
                      </span>
                      {i.detail && <span className="block text-xs text-muted-foreground">{i.detail}</span>}
                      {i.mine && <span className="mt-1 inline-block rounded-full bg-success/15 px-2 py-0.5 text-[0.65rem] font-medium text-success-ink">Tienes boleto</span>}
                    </span>
                  </span>
                )
                return <li key={i.key}>{i.href ? <Link href={i.href}>{body}</Link> : body}</li>
              })}
            </ul>
          )}
          <p className="flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-primary" /> Evento
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-muted-foreground/50" /> Reunión semanal
            </span>
          </p>
        </aside>
      </div>
    </div>
  )
}
