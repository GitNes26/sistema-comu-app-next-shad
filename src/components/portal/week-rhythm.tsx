"use client"

import { useEffect, useState } from "react"
import { CalendarDays, Wifi } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiJson } from "@/lib/ministries/client"
import { MODALITY, slotRange, type Modality } from "@/lib/connect/rules"

// «Tu semana en la iglesia»: las reuniones recurrentes ordenadas por día; hoy resaltado.

interface Slot {
  id: string
  name: string
  dayOfWeek: number
  startTime: string
  endTime: string | null
  modality: string
  description: string | null
}
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const isModality = (v: string): v is Modality => v in MODALITY

export function WeekRhythm({ compact = false }: { compact?: boolean } = {}) {
  const [slots, setSlots] = useState<Slot[] | null>(null)
  useEffect(() => {
    apiJson<{ slots: Slot[] }>("/api/portal/week")
      .then((d) => setSlots(d.slots))
      .catch(() => setSlots([]))
  }, [])

  if (!slots || slots.length === 0) return null
  const today = new Date().getDay()
  const all = DAYS.map((label, d) => ({
    label,
    d,
    items: slots.filter((s) => s.dayOfWeek === d),
  })).filter((x) => x.items.length)
  // Compacto: solo lo que viene (hoy y los próximos días); el resto, al desplegar.
  const upcoming = [...all].sort(
    (a, b) => ((a.d - today + 7) % 7) - ((b.d - today + 7) % 7)
  )
  const days = compact ? upcoming.slice(0, 2) : all
  const rest = compact ? upcoming.slice(2) : []

  return (
    <section aria-label="Tu semana" className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
        <CalendarDays className="size-5 text-primary" /> Tu semana en casa
      </h2>
      <ol
        className={cn(
          "mt-3 grid gap-2",
          !compact && "sm:grid-cols-2 xl:grid-cols-3"
        )}
      >
        {days.map((day) => (
          <li
            key={day.d}
            className={cn(
              "rounded-xl p-3",
              day.d === today
                ? "bg-primary/8 ring-1 ring-primary/30"
                : "bg-muted/40"
            )}
          >
            <p
              className={cn(
                "text-xs font-semibold tracking-wide uppercase",
                day.d === today ? "text-primary" : "text-muted-foreground"
              )}
            >
              {day.label}
              {day.d === today && " · hoy"}
            </p>
            <ul className="mt-1 space-y-1">
              {day.items.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{s.name}</span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
                    {s.modality !== "in_person" && (
                      <Wifi
                        className="size-3"
                        aria-label={
                          MODALITY[
                            isModality(s.modality) ? s.modality : "in_person"
                          ]
                        }
                      />
                    )}
                    {slotRange(s.startTime, s.endTime)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {rest.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-primary">
            Ver el resto de la semana
          </summary>
          <ol className="mt-2 grid gap-2">
            {rest.map((day) => (
              <li key={day.d} className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {day.label}
                </p>
                <ul className="mt-1 space-y-1">
                  {day.items.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {s.name}
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {slotRange(s.startTime, s.endTime)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}
