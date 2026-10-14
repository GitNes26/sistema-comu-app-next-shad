"use client"

import { TextareaField } from "@/components/base/textarea-field"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Ban, CircleDollarSign, ClipboardCheck, Download, Loader2, Lock, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { DialogComponent } from "@/components/ui/dialog"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { GradebookDto } from "@/lib/school/server"
import { QuestionReviewCard, ReviewHeader, useRunningTotal, type ReviewData } from "@/components/school/submission-review"
import { cn } from "@/lib/utils"

// Planilla del grupo: como la hoja de la escuela de ministerio (asistencias,
// tareas 1–7 con promedio, ejercicios 1–7 con promedio y calificación general),
// pero viva: el maestro pasa lista, califica y revisa desde aquí.

type Row = GradebookDto["rows"][number]
const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toFixed(1))
const ymdOfLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const ATT_MARK = { present: "✓", absent: "F", excused: "J" } as const

export function Gradebook({ groupId, backHref }: { groupId: string; backHref: string }) {
  const [book, setBook] = useState<GradebookDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [week, setWeek] = useState<number | null>(null)
  const [cell, setCell] = useState<{ row: Row; assessmentId: string; label: string } | null>(null)
  const [student, setStudent] = useState<Row | null>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [reviewsOpen, setReviewsOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ book: GradebookDto }>(`/api/school/groups/${groupId}`)
      setBook(d.book)
    } catch (e) {
      setError(errorMessage(e, "No se pudo abrir el grupo"))
    }
  }, [groupId])
  useEffect(() => {
    void load()
  }, [load])

  const byKind = useMemo(() => {
    const m = new Map<string, { id: string; title: string }>()
    for (const a of book?.assessments ?? []) m.set(`${a.kind}-${a.number}`, { id: a.id, title: a.title })
    return m
  }, [book])

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir el grupo" description={error} />
      </div>
    )
  }
  if (!book) return <Skeleton className="h-64 w-full" />

  const g = book.group
  const canTeach = book.access.canTeach
  const canManage = book.access.canManage
  const closed = g.status === "closed"
  const tasks = Array.from({ length: g.tasksCount }, (_, i) => i + 1)
  const exercises = Array.from({ length: g.exercisesCount }, (_, i) => i + 1)
  const weeks = Array.from({ length: g.weeks }, (_, i) => i + 1)
  const sessionByWeek = new Map(book.sessions.map((s) => [s.week, s]))

  const decide = async (id: string, action: "approve" | "reject") => {
    try {
      await apiJson(`/api/school/enrollments/${id}`, { method: "PATCH", body: JSON.stringify({ action }) })
      notify.success(action === "approve" ? "Alumno inscrito" : "Solicitud rechazada")
      await load()
    } catch (e) {
      swalError("No se pudo registrar", errorMessage(e))
    }
  }
  const close = async () => {
    const yes = await swalConfirm("¿Cerrar el grupo?", "Se calculan las calificaciones finales y cada alumno queda aprobado o no aprobado. Ya no se pasa lista ni se inscribe a nadie.", {
      confirmText: "Cerrar grupo",
      danger: true,
    })
    if (!yes) return
    try {
      const r = await apiJson<{ passed: number; failed: number }>(`/api/school/groups/${groupId}/close`, { method: "POST" })
      notify.success(`Grupo cerrado: ${r.passed} aprobado(s), ${r.failed} no aprobado(s)`)
      await load()
    } catch (e) {
      swalError("No se pudo cerrar", errorMessage(e))
    }
  }
  const exportCsv = () => {
    const head = ["Alumno", ...weeks.map((w) => `Asist. ${w}`), ...tasks.map((t) => `Tarea ${t}`), "Prom. tareas", ...exercises.map((x) => `Ejercicio ${x}`), "Prom. ejercicios", "GRAL", "Resultado"]
    const lines = book.rows.map((r) => [
      r.name,
      ...weeks.map((w) => (r.attendance[w] ? ATT_MARK[r.attendance[w]] : "")),
      ...tasks.map((t) => r.tasks[t]?.value ?? ""),
      r.tasksAvg ?? "",
      ...exercises.map((x) => r.exercises[x]?.value ?? ""),
      r.exercisesAvg ?? "",
      r.finalGrade ?? "",
      r.passed === null ? "" : r.passed ? "Aprobado" : "No aprobado",
    ])
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const csv = "﻿" + [head, ...lines].map((l) => l.map(esc).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `planilla-${g.courseName.replace(/\W+/g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const th = "border px-1.5 py-1 text-center text-[0.7rem] font-medium text-muted-foreground"
  const td = "border px-1 py-1 text-center text-xs tabular-nums"

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={backHref}>
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </Button>

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">{g.courseName}</h1>
          <p className="text-sm text-muted-foreground">
            {g.name}
            {g.teacherName ? ` · Maestro: ${g.teacherName}` : ""}
            {g.assistantName ? ` · Apoyo: ${g.assistantName}` : ""}
            {g.startDate ? ` · ${g.startDate}` : ""}
            {g.endDate ? ` al ${g.endDate}` : ""}
          </p>
        </div>
        <StatusPill tone={closed ? "neutral" : g.status === "open" ? "success" : "info"}>{closed ? "Cerrado" : g.status === "open" ? "Abierto" : "Por iniciar"}</StatusPill>
      </div>

      <div className="flex flex-wrap gap-2">
        {canTeach && book.pendingReviews > 0 && (
          <Button onClick={() => setReviewsOpen(true)}>
            <ClipboardCheck className="size-4" />
            Por revisar ({book.pendingReviews})
          </Button>
        )}
        {canManage && !closed && (
          <Button variant="outline" onClick={() => setEnrollOpen(true)}>
            <UserPlus className="size-4" />
            Inscribir alumno
          </Button>
        )}
        <Button variant="outline" onClick={exportCsv}>
          <Download className="size-4" />
          CSV
        </Button>
        {canManage && !closed && (
          <Button variant="ghost" className="ml-auto" onClick={() => void close()}>
            <Lock className="size-4" />
            Cerrar grupo
          </Button>
        )}
      </div>

      {book.requests.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-warning/40 bg-warning/5 p-3">
          <h2 className="text-sm font-semibold">Solicitudes de inscripción</h2>
          <ul className="space-y-1.5">
            {book.requests.map((r) => (
              <li key={r.enrollmentId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  {r.name}
                  {r.wantsBook ? " · quiere el libro" : ""}
                </span>
                <Button size="sm" onClick={() => void decide(r.enrollmentId, "approve")}>
                  Aprobar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void decide(r.enrollmentId, "reject")}>
                  Rechazar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className={cn(th, "sticky left-0 z-10 bg-card text-left")}>
                #
              </th>
              <th rowSpan={2} className={cn(th, "sticky left-6 z-10 min-w-40 bg-card text-left")}>
                Alumno
              </th>
              <th colSpan={g.weeks} className={th}>
                Asistencias
              </th>
              <th colSpan={g.tasksCount + 1} className={th}>
                Tareas
              </th>
              <th colSpan={g.exercisesCount + 1} className={th}>
                Ejercicios
              </th>
              <th rowSpan={2} className={th}>
                GRAL.
              </th>
              {canManage && (
                <th rowSpan={2} className={th}>
                  Saldo
                </th>
              )}
            </tr>
            <tr>
              {weeks.map((w) => (
                <th key={w} className={th}>
                  <button
                    type="button"
                    disabled={!canTeach || closed}
                    onClick={() => setWeek(w)}
                    title={sessionByWeek.get(w) ? `Clase del ${sessionByWeek.get(w)!.date}` : "Pasar lista"}
                    className={cn("rounded px-1 py-0.5", canTeach && !closed && "text-primary hover:bg-primary/10", sessionByWeek.has(w) && "font-bold")}
                  >
                    {w}
                  </button>
                </th>
              ))}
              {tasks.map((t) => (
                <th key={`t${t}`} className={th}>
                  {t}
                </th>
              ))}
              <th className={th}>Prom.</th>
              {exercises.map((x) => (
                <th key={`e${x}`} className={th}>
                  {x}
                </th>
              ))}
              <th className={th}>Prom.</th>
            </tr>
          </thead>
          <tbody>
            {book.rows.length === 0 && (
              <tr>
                <td colSpan={20} className="p-6 text-center text-sm text-muted-foreground">
                  Aún no hay alumnos inscritos.
                </td>
              </tr>
            )}
            {book.rows.map((r, i) => (
              <tr key={r.enrollmentId} className={cn(r.status === "failed" && "bg-destructive/5", r.status === "completed" && "bg-success/5")}>
                <td className={cn(td, "sticky left-0 z-10 bg-card")}>{i + 1}</td>
                <td className={cn(td, "sticky left-6 z-10 bg-card text-left font-sans text-sm")}>
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => setStudent(r)}>
                    {r.name}
                  </button>
                </td>
                {weeks.map((w) => {
                  const st = r.attendance[w]
                  return (
                    <td key={w} className={cn(td, st === "absent" && "text-destructive", st === "excused" && "text-warning-ink")}>
                      {st ? ATT_MARK[st] : ""}
                    </td>
                  )
                })}
                {tasks.map((t) => {
                  const a = byKind.get(`task-${t}`)
                  const v = r.tasks[t]
                  return (
                    <td key={`t${t}`} className={cn(td, v?.manual && "font-semibold")}>
                      <button
                        type="button"
                        disabled={!canTeach || !a}
                        className={cn("min-h-6 min-w-7 rounded", canTeach && a && "hover:bg-primary/10")}
                        onClick={() => a && setCell({ row: r, assessmentId: a.id, label: `Tarea ${t}` })}
                      >
                        {fmt(v?.value) || (a ? "·" : "")}
                      </button>
                    </td>
                  )
                })}
                <td className={cn(td, "bg-muted/40 font-semibold")}>{fmt(r.tasksAvg)}</td>
                {exercises.map((x) => {
                  const a = byKind.get(`exercise-${x}`)
                  const v = r.exercises[x]
                  return (
                    <td key={`e${x}`} className={cn(td, v?.manual && "font-semibold")}>
                      <button
                        type="button"
                        disabled={!canTeach || !a}
                        className={cn("min-h-6 min-w-7 rounded", canTeach && a && "hover:bg-primary/10")}
                        onClick={() => a && setCell({ row: r, assessmentId: a.id, label: `Ejercicio ${x}` })}
                      >
                        {fmt(v?.value) || (a ? "·" : "")}
                      </button>
                    </td>
                  )
                })}
                <td className={cn(td, "bg-muted/40 font-semibold")}>{fmt(r.exercisesAvg)}</td>
                <td className={cn(td, "font-bold", r.finalGrade !== null && (r.finalGrade >= g.passScore ? "text-success-ink" : "text-destructive"))}>{fmt(r.finalGrade)}</td>
                {canManage && <td className={cn(td, r.balance > 0 && "text-warning-ink")}>{r.balance > 0 ? money(r.balance) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        ✓ asistió · F faltó · J justificada. Las calificaciones en negritas las capturó el maestro. El promedio se calcula sobre el total de actividades del libro y se aprueba con {g.passScore.toFixed(1)} o más.
      </p>

      <SessionDialog groupId={groupId} week={week} book={book} onClose={() => setWeek(null)} onSaved={load} />
      <GradeDialog cell={cell} onClose={() => setCell(null)} onSaved={load} />
      <StudentDialog row={student} canManage={canManage} onClose={() => setStudent(null)} onChanged={load} />
      <EnrollDialog groupId={groupId} open={enrollOpen} onClose={() => setEnrollOpen(false)} onDone={load} />
      <ReviewsDialog groupId={groupId} open={reviewsOpen} onClose={() => setReviewsOpen(false)} onChanged={load} />
    </div>
  )
}

function SessionDialog({ groupId, week, book, onClose, onSaved }: { groupId: string; week: number | null; book: GradebookDto; onClose: () => void; onSaved: () => Promise<void> }) {
  const [date, setDate] = useState<Date | null>(null)
  const [topic, setTopic] = useState("")
  const [att, setAtt] = useState<Record<string, "present" | "absent" | "excused">>({})
  const [saving, setSaving] = useState(false)
  const enrolled = book.rows.filter((r) => r.status === "enrolled")

  useEffect(() => {
    if (week === null) return
    const s = book.sessions.find((x) => x.week === week)
    setDate(s ? new Date(`${s.date}T12:00:00`) : new Date())
    setTopic(s?.topic ?? "")
    const next: Record<string, "present" | "absent" | "excused"> = {}
    for (const r of enrolled) next[r.enrollmentId] = r.attendance[week] ?? "present"
    setAtt(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week])

  const save = async () => {
    if (week === null || !date) return
    setSaving(true)
    try {
      await apiJson(`/api/school/groups/${groupId}/sessions`, { method: "POST", body: JSON.stringify({ week, date: ymdOfLocal(date), topic, attendance: att }) })
      notify.success("Lista guardada")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={week !== null}
      onOpenChange={(o) => !o && onClose()}
      title={week ? `Clase de la semana ${week}` : "Clase"}
      description="Pasa lista y anota el tema de la clase."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !date}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker label="Fecha" required value={date} onChange={setDate} />
          <InputGroupField label="Tema" value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <ul className="space-y-1.5">
          {enrolled.map((r) => (
            <li key={r.enrollmentId} className="flex items-center gap-2 rounded-xl border px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
              <span className="flex gap-1">
                {(["present", "absent", "excused"] as const).map((s) => (
                  <Button key={s} type="button" size="sm" variant={att[r.enrollmentId] === s ? "default" : "outline"} onClick={() => setAtt((a) => ({ ...a, [r.enrollmentId]: s }))}>
                    {s === "present" ? "Asistió" : s === "absent" ? "Faltó" : "Justif."}
                  </Button>
                ))}
              </span>
            </li>
          ))}
          {enrolled.length === 0 && <li className="text-sm text-muted-foreground">No hay alumnos inscritos.</li>}
        </ul>
      </div>
    </DialogComponent>
  )
}

function GradeDialog({ cell, onClose, onSaved }: { cell: { row: Row; assessmentId: string; label: string } | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!cell) return
    const num = /\d+/.exec(cell.label)?.[0]
    const kind = cell.label.startsWith("Tarea") ? cell.row.tasks : cell.row.exercises
    setValue(num && kind[Number(num)] ? String(kind[Number(num)].value) : "")
  }, [cell])

  const save = async (clear = false) => {
    if (!cell) return
    setSaving(true)
    try {
      await apiJson(`/api/school/enrollments/${cell.row.enrollmentId}/grades`, {
        method: "POST",
        body: JSON.stringify({ assessmentId: cell.assessmentId, value: clear ? null : value }),
      })
      notify.success(clear ? "Calificación automática restaurada" : "Calificación guardada")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={cell !== null}
      onOpenChange={(o) => !o && onClose()}
      title={cell ? `${cell.label} · ${cell.row.name}` : "Calificación"}
      description="De 0 a 10. Una calificación capturada aquí no la reemplazan los envíos del alumno."
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={() => void save(true)} disabled={saving}>
            Volver a la automática
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || value === ""}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <InputGroupField label="Calificación" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
    </DialogComponent>
  )
}

function StudentDialog({ row, canManage, onClose, onChanged }: { row: Row | null; canManage: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [amount, setAmount] = useState("")
  const [concept, setConcept] = useState("enrollment")
  const [method, setMethod] = useState("cash")
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!row) return
    setAmount(row.balance > 0 ? String(row.balance) : "")
    setConcept("enrollment")
    setMethod("cash")
  }, [row])

  const pay = async () => {
    if (!row) return
    setSaving(true)
    try {
      await apiJson(`/api/school/enrollments/${row.enrollmentId}/payments`, { method: "POST", body: JSON.stringify({ amount, concept, method }) })
      notify.success("Pago registrado")
      onClose()
      await onChanged()
    } catch (e) {
      swalError("No se pudo registrar el pago", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const drop = async () => {
    if (!row) return
    const yes = await swalConfirm(`¿Dar de baja a ${row.name}?`, "Se conserva su historial.", { confirmText: "Dar de baja", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/school/enrollments/${row.enrollmentId}`, { method: "PATCH", body: JSON.stringify({ action: "drop" }) })
      onClose()
      await onChanged()
    } catch (e) {
      swalError("No se pudo dar de baja", errorMessage(e))
    }
  }

  return (
    <DialogComponent open={row !== null} onOpenChange={(o) => !o && onClose()} title={row?.name ?? "Alumno"} description={row ? `Saldo: ${row.balance > 0 ? money(row.balance) : "sin saldo"}` : undefined}>
      {row && (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-muted/50 p-2">
              <dd className="font-semibold tabular-nums">{fmt(row.tasksAvg) || "—"}</dd>
              <dt className="text-xs text-muted-foreground">Tareas</dt>
            </div>
            <div className="rounded-xl bg-muted/50 p-2">
              <dd className="font-semibold tabular-nums">{fmt(row.exercisesAvg) || "—"}</dd>
              <dt className="text-xs text-muted-foreground">Ejercicios</dt>
            </div>
            <div className="rounded-xl bg-muted/50 p-2">
              <dd className="font-semibold tabular-nums">{fmt(row.finalGrade) || "—"}</dd>
              <dt className="text-xs text-muted-foreground">General</dt>
            </div>
          </dl>
          {canManage && row.balance > 0 && (
            <div className="space-y-3 rounded-xl border p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CircleDollarSign className="size-4" /> Registrar pago
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <InputGroupField label="Monto" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <FormCombobox
                  label="Concepto"
                  options={[
                    { value: "enrollment", label: "Inscripción" },
                    { value: "book", label: "Libro de texto" },
                  ]}
                  value={concept}
                  onChange={setConcept}
                  clearable={false}
                />
                <FormCombobox
                  label="Forma"
                  options={[
                    { value: "cash", label: "Efectivo" },
                    { value: "transfer", label: "Transferencia" },
                    { value: "card", label: "Tarjeta" },
                    { value: "other", label: "Otro" },
                  ]}
                  value={method}
                  onChange={setMethod}
                  clearable={false}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => void pay()} disabled={saving || !amount}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Registrar
                </Button>
              </div>
            </div>
          )}
          {canManage && row.status === "enrolled" && (
            <Button variant="ghost" className="text-destructive" onClick={() => void drop()}>
              Dar de baja
            </Button>
          )}
        </div>
      )}
    </DialogComponent>
  )
}

function EnrollDialog({ groupId, open, onClose, onDone }: { groupId: string; open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [q, setQ] = useState("")
  const [people, setPeople] = useState<{ id: string; fullName: string; phone: string | null }[]>([])
  const [wantsBook, setWantsBook] = useState(false)

  useEffect(() => {
    if (!open) return
    setQ("")
    setPeople([])
    setWantsBook(false)
  }, [open])
  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setPeople([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const d = await apiJson<{ people: typeof people }>(`/api/school/groups/${groupId}/people?q=${encodeURIComponent(q)}`)
        setPeople(d.people)
      } catch {
        setPeople([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, open, groupId])

  const enroll = async (memberId: string) => {
    try {
      await apiJson(`/api/school/groups/${groupId}/enroll`, { method: "POST", body: JSON.stringify({ memberId, wantsBook }) })
      notify.success("Alumno inscrito")
      onClose()
      await onDone()
    } catch (e) {
      swalError("No se pudo inscribir", errorMessage(e))
    }
  }

  return (
    <DialogComponent open={open} onOpenChange={(o) => !o && onClose()} title="Inscribir alumno" description="Un alumno cursa un libro a la vez y, en la escuela, en orden.">
      <div className="space-y-3">
        <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar creyente por nombre o teléfono…" aria-label="Buscar creyente" autoFocus />
        <label className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={wantsBook} onChange={(e) => setWantsBook(e.target.checked)} />
          Incluye el libro de texto
        </label>
        <ul className="max-h-60 divide-y overflow-y-auto rounded-xl border">
          {people.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Escribe al menos 2 letras.</li>}
          {people.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => void enroll(p.id)} className="flex min-h-12 w-full flex-col items-start justify-center px-3 text-left hover:bg-muted">
                <span className="text-sm font-medium">{p.fullName}</span>
                {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DialogComponent>
  )
}

interface ReviewRow {
  id: string
  studentName: string
  assessmentTitle: string
  kind: "task" | "exercise"
  number: number
  attempt: number
}
type ReviewDetail = ReviewData

function ReviewsDialog({ groupId, open, onClose, onChanged }: { groupId: string; open: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [detail, setDetail] = useState<ReviewDetail | null>(null)
  const [points, setPoints] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState("")
  const [saving, setSaving] = useState(false)
  const running = useRunningTotal(detail?.questions ?? [], points)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ reviews: ReviewRow[] }>(`/api/school/groups/${groupId}/reviews`)
      setRows(d.reviews)
    } catch {
      setRows([])
    }
  }, [groupId])
  useEffect(() => {
    if (open) {
      setDetail(null)
      void load()
    }
  }, [open, load])

  const openOne = async (id: string) => {
    try {
      const d = await apiJson<{ submission: ReviewDetail }>(`/api/school/submissions/${id}`)
      setDetail(d.submission)
      setPoints(Object.fromEntries(d.submission.questions.map((q) => [q.id, q.awarded === null ? "" : String(q.awarded)])))
      setComments(Object.fromEntries(d.submission.questions.map((q) => [q.id, q.comment])))
      setFeedback(d.submission.feedback ?? "")
    } catch (e) {
      swalError("No se pudo abrir", errorMessage(e))
    }
  }
  const save = async () => {
    if (!detail) return
    setSaving(true)
    try {
      const perQuestion = Object.fromEntries(detail.questions.map((q) => [q.id, { points: points[q.id] === "" ? null : Number(points[q.id]), comment: comments[q.id] }]))
      await apiJson(`/api/school/submissions/${detail.id}`, { method: "POST", body: JSON.stringify({ perQuestion, feedback }) })
      notify.success("Envío calificado")
      setDetail(null)
      await load()
      await onChanged()
    } catch (e) {
      swalError("No se pudo calificar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={detail ? detail.studentName : "Por revisar"}
      description={detail ? "Revisa cada respuesta y asigna los puntos de las preguntas abiertas." : "Envíos con respuestas abiertas."}
      size="3xl"
      footer={
        detail ? (
          <>
            <Button variant="ghost" onClick={() => setDetail(null)} disabled={saving}>
              Volver
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar calificación
            </Button>
          </>
        ) : undefined
      }
    >
      {detail ? (
        <div className="space-y-4">
          <ReviewHeader data={detail} total={running.total} graded={running.graded} />
          {detail.questions.map((q, i) => (
            <QuestionReviewCard
              key={q.id}
              q={q}
              index={i}
              points={points[q.id] ?? ""}
              comment={comments[q.id] ?? ""}
              onPoints={(v) => setPoints((p) => ({ ...p, [q.id]: v }))}
              onComment={(v) => setComments((cm) => ({ ...cm, [q.id]: v }))}
            />
          ))}
          <TextareaField id="fb" label="Retroalimentación general" rows={3} value={feedback} maxLength={2000} onChange={(e) => setFeedback(e.target.value)} />
        </div>
      ) : rows === null ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay envíos por revisar.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => void openOne(r.id)} className="flex min-h-12 w-full items-center gap-2 px-3 text-left hover:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{r.studentName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.kind === "task" ? "Tarea" : "Ejercicio"} {r.number} · {r.assessmentTitle} · intento {r.attempt}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </DialogComponent>
  )
}
