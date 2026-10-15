"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Award, Check, Circle, Lock, PlayCircle, XCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { apiJson } from "@/lib/ministries/client"
import type { TrackDto, TrackStepDto } from "@/lib/school/server"

// «Mi trayecto»: los años del programa de Teología como una escalera. Lo aprobado se
// ilumina, lo que cursas se destaca y lo que sigue queda tenue; cada peldaño muestra la
// credencial que otorga.

const STATE: Record<TrackStepDto["status"], { label: string; icon: typeof Check }> = {
  completed: { label: "Aprobado", icon: Check },
  enrolled: { label: "Cursando", icon: PlayCircle },
  requested: { label: "En trámite", icon: Circle },
  failed: { label: "No aprobado", icon: XCircle },
  none: { label: "Por cursar", icon: Lock },
}

export function TrackPanel() {
  const [track, setTrack] = useState<TrackDto | null | undefined>(undefined)
  useEffect(() => {
    apiJson<{ track: TrackDto | null }>("/api/school/track")
      .then((d) => setTrack(d.track))
      .catch(() => setTrack(null))
  }, [])

  if (track === undefined) return <Skeleton className="h-40 w-full" />
  if (track === null) return null
  const done = track.steps.filter((s) => s.status === "completed").length
  const currentIndex = track.steps.findIndex((s) => s.status === "enrolled" || s.status === "requested")
  const nextIndex = currentIndex >= 0 ? currentIndex : track.steps.findIndex((s) => s.status === "none" || s.status === "failed")

  return (
    <section aria-labelledby="trayecto" className="space-y-4 rounded-3xl border bg-card p-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Award className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="trayecto" className="font-heading text-lg font-semibold">
            Mi trayecto · {track.schoolName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {done} de {track.steps.length} cursos aprobados
          </p>
        </div>
      </header>

      <ol className="space-y-2">
        {track.steps.map((s, i) => {
          const st = STATE[s.status]
          const Icon = st.icon
          const highlight = s.status === "completed"
          const current = i === nextIndex && s.status !== "completed"
          return (
            <li key={s.courseId} className={cn("flex items-center gap-3 rounded-2xl border p-3", highlight && "border-success/40 bg-success/5", current && "border-primary/50 bg-primary/5", !highlight && !current && "opacity-70")}>
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl font-heading text-sm font-semibold", highlight ? "bg-success text-success-foreground" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {s.year ?? i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {s.credential ? `Otorga: ${s.credential}` : "Sin credencial"}
                  {s.points !== null ? ` · ${s.points} pts` : ""}
                </span>
              </span>
              <span className={cn("flex shrink-0 items-center gap-1 text-xs font-medium", highlight ? "text-success-ink" : current ? "text-primary" : "text-muted-foreground")}>
                <Icon className="size-4" /> {st.label}
              </span>
              {s.enrollmentId && s.status !== "none" && (
                <Link href={`/mi/escuela/${s.enrollmentId}`} className="press rounded-lg border px-2.5 py-1.5 text-xs font-medium">
                  Abrir
                </Link>
              )}
            </li>
          )
        })}
      </ol>

      {track.earned.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Credenciales obtenidas</p>
          <ul className="flex flex-wrap gap-2">
            {track.earned.map((e) => (
              <li key={e.serial} className="flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1.5 text-sm text-warning-ink">
                <Award className="size-4" />
                <span className="font-medium">{e.name}</span>
                <span className="font-mono text-[0.65rem] opacity-70">{e.serial}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
