"use client"

import { useEffect, useState } from "react"
import { CalendarClock, Mic2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { DAY_LABEL, timeLabel } from "@/lib/cells/rules"
import { GATHERING_KIND_LABEL, type GatheringKindKey } from "@/lib/gatherings/rules"

interface Overview {
  series: { id: string; name: string; kind: GatheringKindKey; dayOfWeek: number; startTime: string }[]
  recent: { id: string; date: string; kind: GatheringKindKey; seriesName: string | null; topic: string | null; speakerName: string | null; imageUrl: string | null }[]
}

const fmtDate = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })

// Vista para cualquier integrante: cuándo son las reuniones y de qué se habló.
export function GatheringsOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ overview: Overview }>("/api/gatherings/overview")
      .then((d) => setData(d.overview))
      .catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <EmptyState icon={Mic2} title="No se pudieron cargar las reuniones" description={error} />
  if (!data) return <Skeleton className="h-48 w-full" />

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-heading text-base font-semibold">Horarios</h2>
        {data.series.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no se publican los horarios.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.series.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CalendarClock className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {DAY_LABEL[s.dayOfWeek]} · {timeLabel(s.startTime)}
                  </span>
                </span>
                {s.kind === "youth" && <StatusPill tone="info" dot={false}>Jóvenes</StatusPill>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-base font-semibold">Temas recientes</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cuando se registren las reuniones verás aquí el tema y quién compartió.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.recent.map((g) => (
              <li key={g.id} className="overflow-hidden rounded-2xl border bg-card">
                {g.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.imageUrl} alt="" className="h-36 w-full object-cover" />
                )}
                <div className="space-y-0.5 p-3">
                  <p className="text-xs text-muted-foreground first-letter:uppercase">
                    {fmtDate(g.date)} · {g.seriesName ?? GATHERING_KIND_LABEL[g.kind]}
                  </p>
                  <p className="text-sm font-semibold">{g.topic ?? "Sin tema registrado"}</p>
                  {g.speakerName && <p className="text-xs text-muted-foreground">Compartió {g.speakerName}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
