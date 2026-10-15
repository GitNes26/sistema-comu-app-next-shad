"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowLeft, ArrowUp, Ban, BookOpen, CalendarCheck, Check, ClipboardCheck, ExternalLink, FileText, GraduationCap, Library, Loader2, PenLine, PlayCircle, Timer, Trophy, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { FormCombobox } from "@/components/base/form-combobox"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { StudentPortalDto, TakeAssessmentDto } from "@/lib/school/server"
import { cn } from "@/lib/utils"

// Portal del alumno: su libro, el material de cada semana, tareas y ejercicios
// (cuestionarios), asistencia y calificaciones.

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const gradeTone = (g: number | null, pass: number) => (g === null ? "text-muted-foreground" : g >= pass ? "text-success-ink" : "text-destructive")

/** Desglose de puntos de la acreditación (escuela universitaria). */
function PointsCard({ p }: { p: NonNullable<StudentPortalDto["points"]> }) {
  const rows = [
    { label: "Asistencia", value: p.attendance },
    { label: "Tareas", value: p.assignments },
    { label: "Pagos", value: p.payments },
  ]
  const pct = Math.min(100, Math.round((p.total / Math.max(1, p.max)) * 100))
  const minPct = Math.round((p.toPass / Math.max(1, p.max)) * 100)
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Mis puntos</p>
        <p className="font-heading text-xl font-semibold tabular-nums">
          {p.total}
          <span className="text-sm font-normal text-muted-foreground"> / {p.max}</span>
        </p>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.total} aria-valuemin={0} aria-valuemax={p.max} aria-label="Puntos acumulados">
        <div className={cn("h-full rounded-full transition-all duration-700", p.passed ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
        <span aria-hidden className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${minPct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {p.passed ? "Ya alcanzaste el mínimo para aprobar" : `Te faltan ${Math.max(0, p.toPass - p.total)} para el mínimo (${p.toPass})`}
        {p.credential ? ` · Obtienes: ${p.credential}` : ""}
      </p>
      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium tabular-nums">{r.value} pts</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function embedUrl(url: string | null): string | null {
  if (!url) return null
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/.exec(url)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = /vimeo\.com\/(\d+)/.exec(url)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}

export function StudentPortal({ enrollmentId, backHref }: { enrollmentId: string; backHref: string }) {
  const [data, setData] = useState<StudentPortalDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ portal: StudentPortalDto }>(`/api/school/enrollments/${enrollmentId}`)
      setData(d.portal)
    } catch (e) {
      setError(errorMessage(e, "No se pudo abrir tu libro"))
    }
  }, [enrollmentId])
  useEffect(() => {
    void load()
  }, [load])

  const weeks = useMemo(() => {
    const map = new Map<number, StudentPortalDto["contents"]>()
    for (const c of data?.contents ?? []) map.set(c.week, [...(map.get(c.week) ?? []), c])
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [data])

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir el libro" description={error} />
      </div>
    )
  }
  if (!data) return <Skeleton className="h-64 w-full" />

  const e = data.enrollment
  const tasks = data.assessments.filter((a) => a.kind === "task")
  const exercises = data.assessments.filter((a) => a.kind === "exercise")
  const active = e.status === "enrolled"

  const renderAssessments = (title: string, list: typeof tasks) => (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
        {title === "Tareas" ? <ClipboardCheck className="size-5 text-primary" /> : <PenLine className="size-5 text-primary" />} {title}
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay {title.toLowerCase()} publicadas.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {a.kind === "task" ? "Tarea" : "Ejercicio"} {a.number} · {a.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {a.week ? `Semana ${a.week} · ` : ""}
                  intentos {a.attemptsUsed}/{a.maxAttempts}
                  {a.timeLimitMin ? ` · ${a.timeLimitMin} min` : ""}
                </span>
              </span>
              {a.pendingReview && <StatusPill tone="warning">En revisión</StatusPill>}
              {a.grade !== null && <span className={cn("font-heading text-lg font-semibold tabular-nums", gradeTone(a.grade, data.course.passScore))}>{a.grade.toFixed(1)}</span>}
              <Button size="sm" variant={a.attemptsUsed === 0 ? "default" : "outline"} onClick={() => setOpen(a.id)}>
                {a.attemptsUsed === 0 ? "Responder" : active && a.attemptsUsed < a.maxAttempts ? "Otro intento" : "Ver resultado"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const doneCount = data.assessments.filter((a) => a.attemptsUsed > 0).length
  const progress = data.assessments.length > 0 ? Math.round((doneCount / data.assessments.length) * 100) : 0
  const attended = data.attendance.filter((a) => a.status === "present").length
  const nav = [
    { id: "resumen", label: "Resumen", icon: GraduationCap, count: null as number | null },
    { id: "asistencia", label: "Asistencia", icon: CalendarCheck, count: attended },
    { id: "tareas", label: "Tareas", icon: ClipboardCheck, count: tasks.length },
    { id: "ejercicios", label: "Ejercicios", icon: PenLine, count: exercises.length },
    { id: "material", label: "Material", icon: Library, count: weeks.length },
    ...(data.documents.length > 0 || data.course.digitalBookUrl ? [{ id: "libro", label: "Libro digital", icon: BookOpen, count: data.documents.length || null }] : []),
  ]
  const R = 38
  const CIRC = 2 * Math.PI * R

  return (
    <div className="w-full space-y-5">
      {/* ── Portada del curso ── */}
      <header id="resumen" className="relative scroll-mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_55%,black)] p-5 text-primary-foreground sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-white/5" />
        <Link href={backHref} className="relative inline-flex items-center gap-1.5 text-xs font-medium text-primary-foreground/80 hover:text-primary-foreground">
          <ArrowLeft className="size-3.5" /> Mi escuela
        </Link>
        <div className="relative mt-3 flex flex-wrap items-center gap-5">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-80">Escuela de Ministerio</p>
            <h1 className="font-heading text-2xl leading-tight font-semibold text-balance sm:text-3xl">{data.course.name}</h1>
            <p className="text-sm opacity-90">
              {data.group.name}
              {data.group.teacherName ? ` · Maestro: ${data.group.teacherName}` : ""}
              {data.group.assistantName ? ` · Apoyo: ${data.group.assistantName}` : ""}
            </p>
          </div>
          <div className="relative grid size-24 shrink-0 place-items-center" aria-label={`Avance ${progress}%`}>
            <svg viewBox="0 0 96 96" className="size-full -rotate-90">
              <circle cx="48" cy="48" r={R} fill="none" strokeWidth="8" className="stroke-white/20" />
              <circle cx="48" cy="48" r={R} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-white transition-[stroke-dashoffset] duration-700" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress / 100)} />
            </svg>
            <span className="absolute text-center leading-tight">
              <span className="block font-heading text-xl font-semibold tabular-nums">{progress}%</span>
              <span className="block text-[0.6rem] tracking-wide uppercase opacity-80">avance</span>
            </span>
          </div>
        </div>
      </header>

      {e.passed !== null && e.status !== "enrolled" && (
        <p className={cn("flex items-center gap-2 rounded-2xl p-3 text-sm", e.passed ? "bg-success/15 text-success-ink" : "bg-destructive/10 text-destructive")}>
          <Trophy className="size-4" />
          {e.passed ? "Aprobaste este libro. ¡Felicidades!" : "No alcanzaste la calificación mínima; puedes cursarlo de nuevo."}
        </p>
      )}
      {e.balance > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-warning/10 p-3 text-sm text-warning-ink">
          <Wallet className="size-4" /> Tienes un saldo de {money(e.balance)} con la escuela.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* ── Navegación del curso y boleta, siempre a la vista ── */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <nav aria-label="Secciones del curso" className="flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5 lg:flex-col lg:overflow-visible">
            {nav.map((n) => (
              <a key={n.id} href={`#${n.id}`} className="press flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <n.icon className="size-4" />
                <span className="flex-1 whitespace-nowrap">{n.label}</span>
                {n.count !== null && <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{n.count}</span>}
              </a>
            ))}
          </nav>
          {data.points && (
            <div className="hidden lg:block">
              <PointsCard p={data.points} />
            </div>
          )}
          <div className="hidden space-y-3 rounded-2xl border bg-card p-4 lg:block">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Mi boleta</p>
            {[
              { label: "Tareas", value: e.tasksAvg },
              { label: "Ejercicios", value: e.exercisesAvg },
              { label: "General", value: e.finalGrade },
            ].map((t) => (
              <div key={t.label} className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{t.label}</span>
                <span className={cn("font-heading text-xl font-semibold tabular-nums", gradeTone(t.value, data.course.passScore))}>{t.value === null ? "—" : t.value.toFixed(1)}</span>
              </div>
            ))}
            <p className="border-t pt-2 text-xs text-muted-foreground">Mínima para aprobar: {data.course.passScore.toFixed(1)}</p>
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          {data.points && (
            <div className="lg:hidden">
              <PointsCard p={data.points} />
            </div>
          )}
          {/* Boleta en móvil */}
          <div className="grid grid-cols-3 gap-2 lg:hidden">
            {[
              { label: "Tareas", value: e.tasksAvg },
              { label: "Ejercicios", value: e.exercisesAvg },
              { label: "General", value: e.finalGrade },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl border bg-card p-3 text-center">
                <p className={cn("font-heading text-2xl font-semibold tabular-nums", gradeTone(t.value, data.course.passScore))}>{t.value === null ? "—" : t.value.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{t.label}</p>
              </div>
            ))}
          </div>

          <section id="asistencia" className="scroll-mt-4 space-y-2">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <CalendarCheck className="size-5 text-primary" /> Asistencia
            </h2>
            <ol className="flex flex-wrap gap-1.5">
              {data.attendance.map((a) => (
                <li
                  key={a.week}
                  title={a.date ? `Semana ${a.week} · ${a.date}` : `Semana ${a.week}`}
                  className={cn(
                    "grid size-11 place-items-center rounded-xl border text-xs font-medium",
                    a.status === "present" && "border-success/50 bg-success/15 text-success-ink",
                    a.status === "absent" && "border-destructive/40 bg-destructive/10 text-destructive",
                    a.status === "excused" && "border-warning/50 bg-warning/10 text-warning-ink"
                  )}
                >
                  {a.status === "present" ? <Check className="size-4" /> : a.status === "absent" ? "F" : a.status === "excused" ? "J" : a.week}
                </li>
              ))}
            </ol>
          </section>

          <div id="tareas" className="scroll-mt-4">
            {renderAssessments("Tareas", tasks)}
          </div>
          <div id="ejercicios" className="scroll-mt-4">
            {renderAssessments("Ejercicios", exercises)}
          </div>

          <section id="material" className="scroll-mt-4 space-y-2">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <Library className="size-5 text-primary" /> Material por semana
            </h2>
            {weeks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay material publicado.</p>
            ) : (
              weeks.map(([week, items]) => (
                <details key={week} className="rounded-2xl border bg-card" open={week === 1}>
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Semana {week}</summary>
                  <ul className="space-y-3 border-t p-4">
                    {items.map((c) => {
                      const embed = c.type === "video" ? embedUrl(c.url) : null
                      return (
                        <li key={c.id} className="space-y-2">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {c.type === "video" ? <PlayCircle className="size-4 text-primary" /> : <FileText className="size-4 text-primary" />}
                            {c.title}
                          </p>
                          {c.type === "text" && c.body && <p className="text-sm whitespace-pre-line text-muted-foreground">{c.body}</p>}
                          {embed && (
                            <div className="aspect-video overflow-hidden rounded-xl border">
                              <iframe src={embed} title={c.title} className="size-full" allow="encrypted-media; picture-in-picture" allowFullScreen />
                            </div>
                          )}
                          {c.type === "image" && c.url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.url} alt={c.title} className="max-h-72 rounded-xl object-contain" />
                          )}
                          {c.url && !embed && c.type !== "image" && (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                              Abrir <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </details>
              ))
            )}
          </section>

          {(data.documents.length > 0 || data.course.digitalBookUrl) && (
            <section id="libro" className="scroll-mt-4 space-y-2">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
                <BookOpen className="size-5 text-primary" /> Libro digital
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.documents.map((d) => (
                  <li key={d.id}>
                    <Link href={`/mi/escuela/libro/${d.id}`} className="press flex items-center gap-3 rounded-2xl border bg-card p-3 hover:border-primary/40">
                      <BookOpen className="size-5 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {d.visible} de {d.total} páginas habilitadas · tus apuntes se guardan aquí
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {data.course.digitalBookUrl && (
                  <li>
                    <a href={data.course.digitalBookUrl} target="_blank" rel="noopener noreferrer" className="press flex items-center gap-3 rounded-2xl border bg-card p-3 hover:border-primary/40">
                      <ExternalLink className="size-5 shrink-0 text-primary" />
                      <span className="text-sm font-medium">Abrir el libro digital</span>
                    </a>
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>
      </div>

      <AssessmentRunner enrollmentId={enrollmentId} assessmentId={open} onClose={() => setOpen(null)} onDone={load} />
    </div>
  )
}

// ── Responder una tarea o ejercicio ───────────────────────────────────────────

type Answers = Record<string, unknown>

function AssessmentRunner({ enrollmentId, assessmentId, onClose, onDone }: { enrollmentId: string; assessmentId: string | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [take, setTake] = useState<TakeAssessmentDto | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [result, setResult] = useState<{ percent: number | null; needsReview: boolean } | null>(null)

  const load = useCallback(async () => {
    if (!assessmentId) return
    try {
      const d = await apiJson<{ take: TakeAssessmentDto }>(`/api/school/enrollments/${enrollmentId}/assessments/${assessmentId}`)
      setTake(d.take)
      setAnswers((d.take.draft?.answers ?? {}) as Answers)
    } catch (e) {
      swalError("No se pudo abrir la actividad", errorMessage(e))
      onClose()
    }
  }, [enrollmentId, assessmentId, onClose])

  useEffect(() => {
    setTake(null)
    setResult(null)
    setAnswers({})
    void load()
  }, [load])

  const deadline = take?.draft?.deadline ? new Date(take.draft.deadline).getTime() : null
  useEffect(() => {
    if (!deadline) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [deadline])
  const remaining = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : null

  const start = async () => {
    if (!assessmentId) return
    setBusy(true)
    try {
      await apiJson(`/api/school/enrollments/${enrollmentId}/assessments/${assessmentId}`, { method: "POST", body: JSON.stringify({ action: "start" }) })
      await load()
    } catch (e) {
      swalError("No se pudo iniciar", errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const submit = async () => {
    if (!assessmentId) return
    setBusy(true)
    try {
      const r = await apiJson<{ percent: number | null; needsReview: boolean }>(`/api/school/enrollments/${enrollmentId}/assessments/${assessmentId}`, {
        method: "POST",
        body: JSON.stringify({ action: "submit", answers: withVisibleOrder(take?.questions ?? [], answers) }),
      })
      setResult({ percent: r.percent, needsReview: r.needsReview })
      notify.success("Respuestas enviadas")
      await onDone()
      await load()
    } catch (e) {
      swalError("No se pudo enviar", errorMessage(e))
      await onDone()
      await load()
    } finally {
      setBusy(false)
    }
  }

  const set = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }))
  const last = take?.last

  return (
    <DialogComponent
      open={assessmentId !== null}
      onOpenChange={(o) => !o && onClose()}
      title={take ? `${take.assessment.kind === "task" ? "Tarea" : "Ejercicio"} ${take.assessment.number} · ${take.assessment.title}` : "Actividad"}
      description={take?.assessment.instructions ?? undefined}
      className="max-w-[96vw] md:max-w-3xl"
      footer={
        take?.draft ? (
          <>
            {remaining !== null && (
              <span className={cn("mr-auto inline-flex items-center gap-1.5 text-sm tabular-nums", remaining < 60 && "text-destructive")}>
                <Timer className="size-4" />
                {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
              </span>
            )}
            <Button onClick={() => void submit()} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Enviar respuestas
            </Button>
          </>
        ) : undefined
      }
    >
      {!take ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-5">
          {(result || last) && !take.draft && (
            <div className="space-y-2 rounded-2xl border bg-card p-4">
              {(result?.needsReview ?? last?.needsReview) ? (
                <p className="text-sm">Tus respuestas fueron recibidas. Tu maestro revisará las preguntas abiertas.</p>
              ) : (
                <p className="text-sm">
                  Resultado del intento {last?.attempt}:{" "}
                  <span className="font-heading text-lg font-semibold tabular-nums">{(result?.percent ?? last?.percent ?? 0).toFixed(0)}%</span>
                  {last?.score !== null && last?.maxScore ? ` (${last.score} de ${last.maxScore} puntos)` : ""}
                </p>
              )}
              {last?.feedback && <p className="rounded-xl bg-muted/60 p-3 text-sm whitespace-pre-line">{last.feedback}</p>}
            </div>
          )}

          {!take.draft && take.canAttempt && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Intento {take.attemptsUsed + 1} de {take.assessment.maxAttempts}
                {take.assessment.timeLimitMin ? ` · tienes ${take.assessment.timeLimitMin} minutos desde que empiezas` : ""}.
              </p>
              <Button onClick={() => void start()} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Comenzar
              </Button>
            </div>
          )}
          {!take.draft && !take.canAttempt && take.reason && <p className="text-sm text-muted-foreground">{take.reason}.</p>}

          {take.draft &&
            take.questions.map((q, i) => (
              <fieldset key={q.id} className="space-y-3 rounded-2xl border p-4">
                <legend className="px-1 text-xs text-muted-foreground">
                  Pregunta {i + 1} · {q.points} {q.points === 1 ? "punto" : "puntos"}
                </legend>
                <QuestionPrompt q={q} />
                {q.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.imageUrl} alt="" className="max-h-64 rounded-xl object-contain" />
                )}
                {q.videoUrl && embedUrl(q.videoUrl) && (
                  <div className="aspect-video overflow-hidden rounded-xl border">
                    <iframe src={embedUrl(q.videoUrl)!} title="Video de la pregunta" className="size-full" allowFullScreen />
                  </div>
                )}
                <QuestionInput q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
              </fieldset>
            ))}
        </div>
      )}
    </DialogComponent>
  )
}

type TakeQuestion = TakeAssessmentDto["questions"][number]

/** Al ordenar, el orden que se ve ya es una respuesta: si no lo movió, también se envía. */
function withVisibleOrder(questions: TakeQuestion[], answers: Answers): Answers {
  const out: Answers = { ...answers }
  for (const q of questions) {
    const items = (q.view as { items?: string[] }).items
    if (q.type === "ordering" && out[q.id] === undefined && Array.isArray(items)) out[q.id] = items
  }
  return out
}

function QuestionPrompt({ q }: { q: TakeQuestion }) {
  if (q.type === "fill_blank") return null // el enunciado se integra con los espacios
  return <p className="text-sm font-medium whitespace-pre-line">{q.prompt}</p>
}

function QuestionInput({ q, value, onChange }: { q: TakeQuestion; value: unknown; onChange: (v: unknown) => void }) {
  const view = q.view as { options?: { text: string; imageUrl?: string }[]; blanks?: number; lefts?: string[]; rights?: string[]; items?: string[] }

  if (q.type === "open") {
    return <Textarea rows={4} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} placeholder="Escribe tu respuesta…" maxLength={5000} />
  }
  if (q.type === "true_false") {
    return (
      <div className="flex gap-2">
        {[
          { v: true, label: "Verdadero" },
          { v: false, label: "Falso" },
        ].map((o) => (
          <Button key={String(o.v)} type="button" variant={value === o.v ? "default" : "outline"} onClick={() => onChange(o.v)}>
            {o.label}
          </Button>
        ))}
      </div>
    )
  }
  if (q.type === "multiple_choice" || q.type === "multiple_select") {
    const multi = q.type === "multiple_select"
    const selected = new Set<number>(multi ? ((Array.isArray(value) ? value : []) as number[]) : value === undefined || value === null ? [] : [Number(value)])
    return (
      <ul className="space-y-1.5">
        {(view.options ?? []).map((o, idx) => (
          <li key={idx}>
            <label className={cn("flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm", selected.has(idx) && "border-primary bg-primary/5")}>
              <input
                type={multi ? "checkbox" : "radio"}
                name={q.id}
                className="size-4 accent-[var(--primary)]"
                checked={selected.has(idx)}
                onChange={() => {
                  if (!multi) return onChange(idx)
                  const next = new Set(selected)
                  if (next.has(idx)) next.delete(idx)
                  else next.add(idx)
                  onChange([...next].sort((a, b) => a - b))
                }}
              />
              {o.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.imageUrl} alt="" className="size-12 rounded-lg object-cover" />
              )}
              <span>{o.text}</span>
            </label>
          </li>
        ))}
      </ul>
    )
  }
  if (q.type === "fill_blank") {
    const given = (Array.isArray(value) ? value : []) as string[]
    const parts = q.prompt.split(/_{3,}/)
    return (
      <p className="text-sm leading-10">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <Input
                aria-label={`Espacio ${i + 1}`}
                className="mx-1 inline-block h-9 w-36 align-middle"
                value={given[i] ?? ""}
                onChange={(e) => {
                  const next = [...given]
                  next[i] = e.target.value
                  onChange(next)
                }}
              />
            )}
          </span>
        ))}
      </p>
    )
  }
  if (q.type === "matching") {
    const given = (Array.isArray(value) ? value : []) as string[]
    const rights = view.rights ?? []
    return (
      <ul className="space-y-2">
        {(view.lefts ?? []).map((left, i) => (
          <li key={i} className="grid items-center gap-2 sm:grid-cols-2">
            <span className="rounded-xl bg-muted/60 px-3 py-2 text-sm">{left}</span>
            <FormCombobox
              ariaLabel={`Pareja de ${left}`}
              options={rights.map((r) => ({ value: r, label: r }))}
              value={given[i] ?? ""}
              onChange={(v) => {
                const next = [...given]
                next[i] = v
                onChange(next)
              }}
              onClear={() => {
                const next = [...given]
                next[i] = ""
                onChange(next)
              }}
              placeholder="Elige…"
            />
          </li>
        ))}
      </ul>
    )
  }
  // ordering
  const order = (Array.isArray(value) && value.length === (view.items ?? []).length ? (value as string[]) : view.items ?? []) as string[]
  const move = (i: number, d: number) => {
    const next = [...order]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <ol className="space-y-1.5">
      {order.map((it, i) => (
        <li key={`${it}-${i}`} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
          <span className="grid size-6 place-items-center rounded-full bg-muted text-xs tabular-nums">{i + 1}</span>
          <span className="min-w-0 flex-1">{it}</span>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
            <ArrowUp className="size-4" />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Bajar" disabled={i === order.length - 1} onClick={() => move(i, 1)}>
            <ArrowDown className="size-4" />
          </Button>
        </li>
      ))}
    </ol>
  )
}
