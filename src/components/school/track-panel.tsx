"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Award, Check, Circle, Lock, PlayCircle, XCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { apiJson } from "@/lib/ministries/client"
import type { TrackDto, TrackStepDto } from "@/lib/school/server"

// «Mi trayecto»: los años del programa de Teología en una sola franja compacta. Cada año es
// un nodo (aprobado, cursando o por cursar); al tocar uno se ve su detalle debajo, y la
// credencial que otorga. Lo obtenido se resume en una línea.

const STATE: Record<TrackStepDto["status"], { label: string; icon: typeof Check }> = {
  completed: { label: "Aprobado", icon: Check },
  enrolled: { label: "Cursando", icon: PlayCircle },
  requested: { label: "En trámite", icon: Circle },
  failed: { label: "No aprobado", icon: XCircle },
  none: { label: "Por cursar", icon: Lock },
}

export function TrackPanel() {
  const [track, setTrack] = useState<TrackDto | null | undefined>(undefined)
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => {
    apiJson<{ track: TrackDto | null }>("/api/school/track")
      .then((d) => setTrack(d.track))
      .catch(() => setTrack(null))
  }, [])

  if (track === undefined) return <Skeleton className="h-28 w-full" />
  if (track === null) return null
  const done = track.steps.filter((s) => s.status === "completed").length
  const currentIndex = track.steps.findIndex((s) => s.status === "enrolled" || s.status === "requested")
  const nextIndex = currentIndex >= 0 ? currentIndex : track.steps.findIndex((s) => s.status === "none" || s.status === "failed")
  const shown = picked ?? (nextIndex >= 0 ? nextIndex : track.steps.length - 1)
  const step = track.steps[shown]
  const st = step ? STATE[step.status] : null
  const pct = track.steps.length ? Math.round((done / track.steps.length) * 100) : 0

  return (
    <section aria-labelledby="trayecto" className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4">
      <header className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Award className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="trayecto" className="truncate font-heading text-sm font-semibold sm:text-base">
            Mi trayecto · {track.schoolName}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {done}/{track.steps.length}
            </span>
          </div>
        </div>
      </header>

      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${track.steps.length}, minmax(0, 1fr))` }}>
        <span aria-hidden className="absolute top-4 right-[8.33%] left-[8.33%] h-0.5 bg-muted" />
        {track.steps.map((s, i) => {
          const completed = s.status === "completed"
          const current = i === nextIndex && !completed
          const active = i === shown
          return (
            <li key={s.courseId} className="relative flex justify-center">
              <button
                type="button"
                onClick={() => setPicked(i)}
                aria-label={`Año ${s.year ?? i + 1}: ${s.name}, ${STATE[s.status].label}`}
                aria-current={active ? "step" : undefined}
                className="press flex flex-col items-center gap-1 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "relative grid size-8 place-items-center rounded-full border-2 bg-card text-xs font-semibold transition-colors",
                    completed && "border-success bg-success text-success-foreground",
                    current && "border-primary bg-primary text-primary-foreground",
                    !completed && !current && "border-border text-muted-foreground",
                    active && "ring-4 ring-primary/20"
                  )}
                >
                  {completed ? <Check className="size-4" /> : (s.year ?? i + 1)}
                </span>
                <span className={cn("text-[0.65rem]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>Año {s.year ?? i + 1}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {step && st && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/50 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{step.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {step.credential ? `Otorga: ${step.credential}` : "Sin credencial"}
              {step.points !== null ? ` · ${step.points} pts` : ""}
            </span>
          </span>
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", step.status === "completed" ? "text-success-ink" : step.status === "enrolled" ? "text-primary" : "text-muted-foreground")}>
            <st.icon className="size-3.5" /> {st.label}
          </span>
          {step.enrollmentId && step.status !== "none" && (
            <Link href={`/mi/escuela/${step.enrollmentId}`} className="press rounded-lg border bg-card px-2.5 py-1 text-xs font-medium">
              Abrir
            </Link>
          )}
        </div>
      )}

      {track.earned.length > 0 && (
        <ul className="scroll-fade-x no-scrollbar flex gap-1.5 overflow-x-auto" aria-label="Credenciales obtenidas">
          {track.earned.map((e) => (
            <li key={e.serial} className="flex shrink-0 items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 text-xs text-warning-ink">
              <Award className="size-3.5" />
              <span className="font-medium">{e.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
