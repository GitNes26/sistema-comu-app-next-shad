"use client"

import { useMemo } from "react"
import { ArrowRight, Check, CircleHelp, GripVertical, ListChecks, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { QUESTION_TYPE_LABEL, normalizeText, type QuestionTypeKey } from "@/lib/school/rules"

// Calificación de un envío con la interfaz de la respuesta (no el dato crudo):
// verdadero/falso con su veredicto, opciones con la elegida y la correcta, huecos con lo
// escrito, parejas y orden. Encabezado fijo con el avance del puntaje acumulado.

export interface ReviewQuestion {
  id: string
  type: string
  prompt: string
  points: number
  answer: unknown
  expected: unknown
  awarded: number | null
  comment: string
}
export interface ReviewData {
  id: string
  studentName: string
  courseName: string
  groupName: string
  attempt: number
  submittedAt: string | null
  maxScore: number
  feedback: string | null
  assessment: { title: string; kind: string; number: number }
  questions: ReviewQuestion[]
}

type Expected = {
  options?: { text: string; imageUrl?: string }[]
  correct?: number | number[] | boolean
  answers?: string[][]
  pairs?: { left: string; right: string }[]
  items?: string[]
}

const Mark = ({ ok }: { ok: boolean }) =>
  ok ? (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
      <Check className="size-3" />
    </span>
  ) : (
    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
      <X className="size-3" />
    </span>
  )

function AnswerView({ q }: { q: ReviewQuestion }) {
  const type = q.type as QuestionTypeKey
  const exp = (q.expected ?? {}) as Expected

  if (type === "open") {
    const text = typeof q.answer === "string" ? q.answer.trim() : ""
    return text ? (
      <p className="rounded-xl border-l-4 border-primary bg-muted/50 p-3 text-sm leading-relaxed whitespace-pre-line">{text}</p>
    ) : (
      <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground italic">No respondió.</p>
    )
  }

  if (type === "true_false") {
    const given = typeof q.answer === "boolean" ? q.answer : null
    const correct = exp.correct === true
    return (
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => {
          const chosen = given === v
          const isCorrect = correct === v
          return (
            <div
              key={String(v)}
              className={cn(
                "flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-sm font-medium",
                chosen && isCorrect && "border-success bg-success/10",
                chosen && !isCorrect && "border-destructive bg-destructive/10",
                !chosen && isCorrect && "border-success/50 border-dashed",
                !chosen && !isCorrect && "opacity-60"
              )}
            >
              <span>{v ? "Verdadero" : "Falso"}</span>
              {chosen ? <Mark ok={isCorrect} /> : isCorrect ? <span className="text-xs text-success-ink">Correcta</span> : null}
            </div>
          )
        })}
      </div>
    )
  }

  if (type === "multiple_choice" || type === "multiple_select") {
    const options = exp.options ?? []
    const chosen = new Set<number>(type === "multiple_choice" ? (q.answer === null || q.answer === "" ? [] : [Number(q.answer)]) : (Array.isArray(q.answer) ? q.answer : []).map(Number))
    const correct = new Set<number>(type === "multiple_choice" ? [Number(exp.correct)] : ((exp.correct as number[]) ?? []))
    return (
      <ul className="space-y-1.5">
        {options.map((o, i) => {
          const picked = chosen.has(i)
          const right = correct.has(i)
          return (
            <li
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm",
                picked && right && "border-success bg-success/10",
                picked && !right && "border-destructive bg-destructive/10",
                !picked && right && "border-success/50 border-dashed",
                !picked && !right && "opacity-60"
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">{String.fromCharCode(65 + i)}</span>
              <span className="min-w-0 flex-1">{o.text}</span>
              {picked ? <Mark ok={right} /> : right ? <span className="text-xs text-success-ink">Correcta</span> : null}
            </li>
          )
        })}
        {chosen.size === 0 && <li className="text-xs text-muted-foreground italic">No respondió.</li>}
      </ul>
    )
  }

  if (type === "fill_blank") {
    const given = Array.isArray(q.answer) ? q.answer : []
    return (
      <ul className="space-y-1.5">
        {(exp.answers ?? []).map((accepted, i) => {
          const text = String(given[i] ?? "")
          const ok = accepted.some((a) => normalizeText(a) === normalizeText(text))
          return (
            <li key={i} className={cn("flex flex-wrap items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm", ok ? "border-success bg-success/10" : "border-destructive bg-destructive/10")}>
              <span className="text-xs font-semibold text-muted-foreground">Espacio {i + 1}</span>
              <span className="font-medium">{text || <em className="text-muted-foreground">vacío</em>}</span>
              <Mark ok={ok} />
              {!ok && <span className="ml-auto text-xs text-success-ink">Esperado: {accepted.join(" / ")}</span>}
            </li>
          )
        })}
      </ul>
    )
  }

  if (type === "matching") {
    const given = Array.isArray(q.answer) ? q.answer : []
    return (
      <ul className="space-y-1.5">
        {(exp.pairs ?? []).map((p, i) => {
          const text = String(given[i] ?? "")
          const ok = normalizeText(text) === normalizeText(p.right)
          return (
            <li key={i} className={cn("grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm", ok ? "border-success bg-success/10" : "border-destructive bg-destructive/10")}>
              <span className="font-medium">{p.left}</span>
              <ArrowRight className="size-4 text-muted-foreground" />
              <span className="flex items-center justify-end gap-2 text-right">
                <span>{text || <em className="text-muted-foreground">sin elegir</em>}</span>
                <Mark ok={ok} />
              </span>
              {!ok && <span className="col-span-3 text-xs text-success-ink">Correcto: {p.right}</span>}
            </li>
          )
        })}
      </ul>
    )
  }

  if (type === "ordering") {
    const given = Array.isArray(q.answer) ? q.answer : []
    const items = exp.items ?? []
    return (
      <ol className="space-y-1.5">
        {items.map((expected, i) => {
          const text = String(given[i] ?? "")
          const ok = normalizeText(text) === normalizeText(expected)
          return (
            <li key={i} className={cn("flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm", ok ? "border-success bg-success/10" : "border-destructive bg-destructive/10")}>
              <GripVertical className="size-4 text-muted-foreground" />
              <span className="grid size-6 place-items-center rounded-md bg-muted text-xs font-semibold">{i + 1}</span>
              <span className="min-w-0 flex-1">{text || <em className="text-muted-foreground">vacío</em>}</span>
              <Mark ok={ok} />
              {!ok && <span className="hidden text-xs text-success-ink sm:inline">Va: {expected}</span>}
            </li>
          )
        })}
      </ol>
    )
  }

  return <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{String(q.answer ?? "")}</p>
}

export function ReviewHeader({ data, total, graded }: { data: ReviewData; total: number; graded: number }) {
  const pct = data.maxScore > 0 ? Math.min(100, Math.round((total / data.maxScore) * 100)) : 0
  const submitted = data.submittedAt ? new Date(data.submittedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null
  return (
    <div className="sticky top-0 z-10 -mx-2 space-y-2 border-b bg-popover/95 px-2 pt-1 pb-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <b className="text-foreground">{data.courseName}</b> · {data.groupName}
        </span>
        <span>
          {data.assessment.kind === "task" ? "Tarea" : "Ejercicio"} {data.assessment.number} · {data.assessment.title}
        </span>
        <span>Intento {data.attempt}</span>
        {submitted && <span>Entregado {submitted}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <p className="shrink-0 font-heading text-lg font-semibold tabular-nums">
          {Number.isInteger(total) ? total : total.toFixed(2)}
          <span className="text-sm font-normal text-muted-foreground"> / {data.maxScore} pts</span>
        </p>
        <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
          <ListChecks className="size-3.5" /> {graded}/{data.questions.length} calificadas
        </span>
      </div>
    </div>
  )
}

export function QuestionReviewCard({
  q,
  index,
  points,
  comment,
  onPoints,
  onComment,
}: {
  q: ReviewQuestion
  index: number
  points: string
  comment: string
  onPoints: (v: string) => void
  onComment: (v: string) => void
}) {
  const open = q.type === "open"
  const value = points === "" ? null : Number(points)
  const invalid = value !== null && (!Number.isFinite(value) || value < 0 || value > q.points)
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <header className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 font-heading text-sm font-semibold text-primary">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium whitespace-pre-line">{q.prompt}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleHelp className="size-3" /> {QUESTION_TYPE_LABEL[q.type as QuestionTypeKey] ?? q.type} · {q.points} pts
            {!open && <span className="rounded-full bg-muted px-1.5">Calificada automáticamente</span>}
          </p>
        </div>
      </header>
      <AnswerView q={q} />
      <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`pts-${q.id}`}>
            Puntos (0 – {q.points})
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id={`pts-${q.id}`}
              type="number"
              inputMode="decimal"
              min={0}
              max={q.points}
              step={0.5}
              value={points}
              onChange={(e) => onPoints(e.target.value)}
              aria-invalid={invalid || undefined}
              className={cn("h-11 w-full min-w-0 rounded-lg border bg-transparent px-3 text-center text-lg font-semibold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 desk:h-9", invalid && "border-destructive")}
            />
            <button type="button" onClick={() => onPoints("0")} className="press h-11 rounded-lg border px-2 text-xs font-medium desk:h-9">
              0
            </button>
            <button type="button" onClick={() => onPoints(String(q.points))} className="press h-11 rounded-lg border px-2 text-xs font-medium text-primary desk:h-9">
              Máx.
            </button>
          </div>
          {invalid && <p className="text-xs text-destructive">Debe estar entre 0 y {q.points}.</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`cm-${q.id}`}>
            Comentario para el alumno (opcional)
          </label>
          <input
            id={`cm-${q.id}`}
            value={comment}
            maxLength={500}
            onChange={(e) => onComment(e.target.value)}
            className="h-11 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 desk:h-9"
          />
        </div>
      </div>
    </section>
  )
}

/** Suma del puntaje acumulado y cuántas preguntas ya tienen puntos. */
export function useRunningTotal(questions: ReviewQuestion[], points: Record<string, string>) {
  return useMemo(() => {
    let total = 0
    let graded = 0
    for (const q of questions) {
      const raw = points[q.id]
      if (raw === undefined || raw === "") continue
      const n = Number(raw)
      if (Number.isFinite(n)) {
        total += Math.max(0, Math.min(q.points, n))
        graded++
      }
    }
    return { total: Math.round(total * 100) / 100, graded }
  }, [questions, points])
}
