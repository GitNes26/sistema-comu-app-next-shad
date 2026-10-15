"use client"

import { CourseCard } from "@/components/school/course-card"
import { TrackPanel } from "@/components/school/track-panel"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BookOpen, Check, ClipboardList, GraduationCap, Loader2, School as SchoolIcon, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { StatusPill, type StatusTone } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { CourseDto, EnrollmentLiteDto, GroupLiteDto, SchoolDto, SchoolOverviewDto } from "@/lib/school/server"
import { cn } from "@/lib/utils"

// «Mi escuela»: lo propio del alumno (su libro, material, tareas y notas), los
// grupos que enseña y el catálogo para solicitar inscripción. Es la puerta del
// portal educativo; el acceso a cada cosa nace de la relación.

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const STATUS: Record<EnrollmentLiteDto["status"], { label: string; tone: StatusTone }> = {
  requested: { label: "Solicitud en revisión", tone: "warning" },
  enrolled: { label: "Cursando", tone: "success" },
  completed: { label: "Aprobado", tone: "success" },
  failed: { label: "No aprobado", tone: "danger" },
  dropped: { label: "Baja", tone: "neutral" },
  rejected: { label: "Rechazada", tone: "neutral" },
}
const fmtDate = (ymd: string | null) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : null)

export function SchoolPortal({ adminHref }: { adminHref?: string }) {
  const [data, setData] = useState<SchoolOverviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState<{ course: CourseDto; group: GroupLiteDto; school: SchoolDto } | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ overview: SchoolOverviewDto }>("/api/school")
      setData(d.overview)
    } catch (e) {
      setError(errorMessage(e, "No se pudo cargar la escuela"))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  if (error) return <EmptyState icon={SchoolIcon} title="No se pudo abrir la escuela" description={error} />
  if (!data) return <Skeleton className="h-64 w-full" />

  const current = data.mine.filter((e) => e.status === "enrolled" || e.status === "requested")
  const history = data.mine.filter((e) => e.status !== "enrolled" && e.status !== "requested")

  return (
    <div className="space-y-6">
      {adminHref && data.access.canView && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href={adminHref}>
              <Settings2 className="size-4" />
              Administrar la escuela
            </Link>
          </Button>
        </div>
      )}

      {data.journey && data.diplomas.length === 0 && <DiplomaJourney journey={data.journey} />}

      {data.schools.some((s) => s.kind === "university" && s.courses.length > 0) && <TrackPanel />}

      {data.diplomas.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">Mis diplomas</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.diplomas.map((d) => (
              <li key={d.id}>
                <Link href={`/mi/escuela/diploma/${d.id}`} className="press flex items-center gap-3 rounded-2xl border border-amber-600/40 bg-amber-50/60 p-4 hover:border-amber-600 dark:bg-amber-950/20">
                  <GraduationCap className="size-6 shrink-0 text-amber-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{d.schoolName}</span>
                    <span className="block text-xs text-muted-foreground">
                      Folio {d.serial} · {new Date(d.issuedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {current.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">Mi libro actual</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {current.map((e) => (
              <li key={e.id}>
                <EnrollmentCard e={e} onChanged={load} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.teaching.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">Grupos que enseño</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.teaching.map((g) => (
              <li key={g.id}>
                <Link href={`/mi/escuela/grupos/${g.id}`} className="press flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardList className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{g.courseName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {g.name} · {g.enrolled} alumno{g.enrolled === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.schools.map((s) => (
        <section key={s.id} className="space-y-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">{s.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[s.description, s.directorName ? `Director: ${s.directorName}` : null, s.subdirectorName ? `Subdirector: ${s.subdirectorName}` : null].filter(Boolean).join(" · ")}
            </p>
            {s.blockedReason && <p className="mt-1 text-xs text-muted-foreground">{s.blockedReason}.</p>}
          </div>
          {s.courses.length === 0 ? (
            <p className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">Aún no se publican libros en este programa.</p>
          ) : (
            <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {s.courses.map((c, i) => (
                <li key={c.id}>
                  <CourseCard course={c} index={i} ministry={s.kind === "ministry"} href={`/mi/escuela/cursos/${c.id}`} />
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">Mi historial</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {history.map((e) => (
              <li key={e.id}>
                <EnrollmentCard e={e} onChanged={load} compact />
              </li>
            ))}
          </ul>
        </section>
      )}

      <RequestDialog target={request} onClose={() => setRequest(null)} onDone={load} />
    </div>
  )
}

function EnrollmentCard({ e, onChanged, compact }: { e: EnrollmentLiteDto; onChanged: () => Promise<void>; compact?: boolean }) {
  const st = STATUS[e.status]
  const cancel = async () => {
    const yes = await swalConfirm("¿Retirar tu solicitud?", undefined, { confirmText: "Retirar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/school/enrollments/${e.id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) })
      await onChanged()
    } catch (err) {
      swalError("No se pudo retirar", errorMessage(err))
    }
  }
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <GraduationCap className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{e.courseName}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {e.groupName}
          {e.finalGrade !== null ? ` · calificación ${e.finalGrade.toFixed(1)}` : ""}
          {e.balance > 0 && e.status !== "dropped" && e.status !== "rejected" ? ` · saldo ${money(e.balance)}` : ""}
        </span>
      </span>
      <StatusPill tone={st.tone}>{st.label}</StatusPill>
    </>
  )
  if (e.status === "enrolled" || e.status === "completed" || e.status === "failed") {
    return (
      <Link href={`/mi/escuela/${e.id}`} className={cn("press flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary/40", compact && "p-3")}>
        {body}
      </Link>
    )
  }
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-3">{body}</div>
      {e.status === "requested" && (
        <Button size="sm" variant="ghost" onClick={() => void cancel()}>
          Retirar solicitud
        </Button>
      )}
    </div>
  )
}

export function RequestDialog({ target, onClose, onDone }: { target: { course: CourseDto; group: GroupLiteDto; school: SchoolDto } | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [wantsBook, setWantsBook] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => setWantsBook(false), [target])

  const submit = async () => {
    if (!target) return
    setSaving(true)
    try {
      await apiJson(`/api/school/groups/${target.group.id}/enroll`, { method: "POST", body: JSON.stringify({ wantsBook }) })
      notify.success("Solicitud enviada; la escuela te confirmará")
      onClose()
      await onDone()
    } catch (e) {
      swalError("No se pudo solicitar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title={target ? `Solicitar «${target.course.name}»` : "Solicitud"}
      description={target ? `${target.group.name}${target.group.teacherName ? ` · Maestro: ${target.group.teacherName}` : ""}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Enviar solicitud
          </Button>
        </>
      }
    >
      {target && (
        <div className="space-y-4 text-sm">
          <p>
            Inscripción: <span className="font-semibold">{money(target.course.enrollmentFee)}</span>. Se paga con la escuela cuando te confirmen.
          </p>
          {target.course.bookPrice > 0 && (
            <label className="flex min-h-12 items-center gap-3 rounded-xl border px-3">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={wantsBook} onChange={(e) => setWantsBook(e.target.checked)} />
              <span>
                Quiero el libro de texto ({money(target.course.bookPrice)}) <span className="block text-xs text-muted-foreground">Es opcional y se vende por separado.</span>
              </span>
            </label>
          )}
        </div>
      )}
    </DialogComponent>
  )
}

function DiplomaJourney({ journey: j }: { journey: NonNullable<SchoolOverviewDto["journey"]> }) {
  const pct = j.total > 0 ? Math.round((j.passed / j.total) * 100) : 0
  const allPassed = j.total > 0 && j.passed >= j.total
  const fmt = (ymd: string | null) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : null)
  const steps = [
    { key: "baptism", title: "Bautismo en aguas", done: j.baptized, detail: fmt(j.baptizedAt) ?? "Declaras tu fe de manera pública" },
    { key: "encounter", title: "Encuentro con Jesús", done: j.encounterDone, detail: fmt(j.encounterAt) ?? "Recomendado antes de entrar a la escuela" },
    {
      key: "books",
      title: "Escuela de ministerio",
      done: allPassed,
      detail: `${j.passed} de ${j.total} libros aprobados, en orden`,
    },
    { key: "launch", title: "Lanzamiento", done: j.launchDone, detail: fmt(j.launchAt) ?? "Graduación: al finalizar recibes tu diploma" },
  ]
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-700">
          <GraduationCap className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold">Mi camino en la visión</h2>
          <p className="text-sm text-muted-foreground">
            El orden recomendado: bautismo en aguas, Encuentro con Jesús, los {j.total || 4} libros y el Lanzamiento. No es obligatorio, pero es el deber ser.
          </p>
        </div>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.key} className={cn("flex items-start gap-3 rounded-xl px-3 py-2.5", s.done ? "bg-emerald-500/10" : "bg-muted/50")}>
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                s.done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{s.title}</span>
              <span className="block text-xs text-muted-foreground">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Libros aprobados</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Libros aprobados">
          <div className="h-full rounded-full bg-amber-500 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ol className="grid gap-1.5 sm:grid-cols-2">
        {j.books.map((b) => (
          <li key={b.id} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full text-[0.65rem]",
                b.status === "passed" ? "bg-emerald-600 text-white" : b.status === "studying" ? "bg-sky-600 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {b.status === "passed" ? <Check className="size-3" /> : b.status === "studying" ? "•" : ""}
            </span>
            <span className="min-w-0 flex-1 truncate">{b.name}</span>
            <span className="text-xs text-muted-foreground">{b.status === "passed" ? "Aprobado" : b.status === "studying" ? "Cursando" : "Pendiente"}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
