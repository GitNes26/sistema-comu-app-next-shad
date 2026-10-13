"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Radio, Settings2, Tv } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { STREAM_PLATFORMS, STREAM_STATUS } from "@/lib/portal/rules"
import type { StreamDto } from "@/lib/portal/server"
import { StreamPlayer } from "./stream-player"
import { cn } from "@/lib/utils"

// Transmisiones de la iglesia incrustadas (YouTube y Facebook): la que está en vivo
// se muestra primero; el resto se elige de la lista.

const fmt = (iso: string) => new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

export function StreamsView({ canManage }: { canManage: boolean }) {
  const [streams, setStreams] = useState<StreamDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ streams: StreamDto[] }>("/api/portal/streams")
      .then((r) => setStreams(r.streams))
      .catch((e) => setError(errorMessage(e, "No se pudieron cargar las transmisiones")))
  }, [])

  if (error) return <EmptyState icon={Tv} title="No se pudo cargar" description={error} />
  if (!streams) return <Skeleton className="aspect-video w-full" />

  const current = streams.find((s) => s.id === selectedId) ?? streams.find((s) => s.status === "live") ?? streams[0] ?? null

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/content">
              <Settings2 className="size-4" />
              Administrar transmisiones
            </Link>
          </Button>
        </div>
      )}
      {!current ? (
        <EmptyState icon={Tv} title="Aún no hay transmisiones" description="Cuando la iglesia transmita, podrás verla aquí." />
      ) : (
        <>
          <section className="space-y-3">
            <StreamPlayer stream={current} />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={current.status === "live" ? "danger" : current.status === "scheduled" ? "warning" : "neutral"}>
                  {current.status === "live" && <Radio className="mr-1 size-3.5" />}
                  {STREAM_STATUS[current.status]}
                </StatusPill>
                <span className="text-xs text-muted-foreground">{STREAM_PLATFORMS[current.platform]}</span>
                {current.scheduledAt && <span className="text-xs text-muted-foreground">· {fmt(current.scheduledAt)}</span>}
              </div>
              <h2 className="font-heading text-lg font-semibold">{current.title}</h2>
              {current.description && <p className="text-sm whitespace-pre-line text-muted-foreground">{current.description}</p>}
            </div>
          </section>

          {streams.length > 1 && (
            <section className="space-y-2">
              <h2 className="font-heading text-base font-semibold">Todas las transmisiones</h2>
              <ul className="divide-y rounded-2xl border bg-card">
                {streams.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(s.id)
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }}
                      aria-current={s.id === current.id}
                      className={cn("flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted", s.id === current.id && "bg-primary/5")}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {STREAM_PLATFORMS[s.platform]}
                          {s.scheduledAt ? ` · ${fmt(s.scheduledAt)}` : ""}
                        </span>
                      </span>
                      <StatusPill tone={s.status === "live" ? "danger" : s.status === "scheduled" ? "warning" : "neutral"} dot={false}>
                        {STREAM_STATUS[s.status]}
                      </StatusPill>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
