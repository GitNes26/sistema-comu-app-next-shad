"use client"

import { TextareaField } from "@/components/base/textarea-field"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Award, BarChart3, BookOpen, ClipboardList, Download, GraduationCap, Loader2, Plus, Settings2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/base/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { ApprovalsReportDto, SchoolDto, SchoolOverviewDto } from "@/lib/school/server"
import { DiplomaDesigner } from "./diploma-designer"

// Administración de la escuela: programas (Escuela de ministerio y Universidad
// Teológica), director y subdirector, calificación mínima, costos y libros.

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })

export interface PickedPerson {
  id: string
  fullName: string
}

/** Buscador de personas del padrón para director, maestro o apoyo. */
export function StaffPicker({ label, value, onChange }: { label: string; value: PickedPerson | null; onChange: (p: PickedPerson | null) => void }) {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<{ id: string; fullName: string; hierarchy: string }[]>([])

  useEffect(() => {
    if (q.trim().length < 2) {
      setRows([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const d = await apiJson<{ people: typeof rows }>(`/api/school/staff?q=${encodeURIComponent(q)}`)
        setRows(d.people)
      } catch {
        setRows([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value ? (
        <p className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{value.fullName}</span>
          <button type="button" aria-label={`Quitar ${label}`} onClick={() => onChange(null)}>
            <X className="size-4" />
          </button>
        </p>
      ) : (
        <>
          <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el padrón…" aria-label={`Buscar ${label}`} />
          {rows.length > 0 && (
            <ul className="max-h-40 divide-y overflow-y-auto rounded-xl border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center px-3 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      onChange({ id: r.id, fullName: r.fullName })
                      setQ("")
                      setRows([])
                    }}
                  >
                    {r.fullName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export function SchoolAdmin() {
  const [data, setData] = useState<SchoolOverviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<SchoolDto | null>(null)
  const [newCourse, setNewCourse] = useState<SchoolDto | null>(null)
  const [diplomaFor, setDiplomaFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ overview: SchoolOverviewDto }>("/api/school")
      setData(d.overview)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  if (error) return <EmptyState icon={GraduationCap} title="No se pudo abrir la escuela" description={error} />
  if (!data) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-8">
      {data.schools.map((s) => (
        <section key={s.id} className="space-y-3">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-lg font-semibold">{s.name}</h2>
              <p className="text-sm text-muted-foreground">
                Director: {s.directorName ?? "sin asignar"} · Subdirector: {s.subdirectorName ?? "sin asignar"} · Mínima {s.passScore.toFixed(1)} · Inscripción {money(s.enrollmentFee)}
              </p>
            </div>
            {s.canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                  <Settings2 className="size-4" />
                  Configurar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setDiplomaFor(s.id)}>
                  <Award className="size-4" />
                  Diploma
                </Button>
                <Button size="sm" onClick={() => setNewCourse(s)}>
                  <Plus className="size-4" />
                  {s.kind === "ministry" ? "Nuevo libro" : "Nuevo curso"}
                </Button>
              </>
            )}
          </div>

          {s.courses.length === 0 ? (
            <EmptyState icon={BookOpen} title="Sin libros" description="Agrega los libros en el orden en que se cursan." />
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2">
              {s.courses.map((c) => {
                const active = c.groups.filter((g) => g.status !== "closed")
                return (
                  <li key={c.id} className="space-y-2 rounded-2xl border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold tabular-nums">{c.sortOrder || "·"}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/school/courses/${c.id}`} className="text-sm font-semibold hover:underline">
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {c.weeks} semanas · {c.tasksCount} tareas · {c.exercisesCount} ejercicios · {money(c.enrollmentFee)}
                          {c.bookPrice > 0 ? ` · libro ${money(c.bookPrice)}` : ""}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/school/courses/${c.id}`}>Abrir</Link>
                      </Button>
                    </div>
                    {active.length > 0 && (
                      <ul className="space-y-1">
                        {active.map((g) => (
                          <li key={g.id}>
                            <Link href={`/admin/school/groups/${g.id}`} className="flex items-center gap-2 rounded-xl bg-muted/50 px-2.5 py-1.5 text-xs hover:bg-muted">
                              <ClipboardList className="size-3.5 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">
                                {g.name}
                                {g.teacherName ? ` · ${g.teacherName}` : ""}
                              </span>
                              <StatusPill tone={g.status === "open" ? "success" : "info"} dot={false}>
                                {g.enrolled} {g.status === "open" ? "cursando" : "inscritos"}
                              </StatusPill>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      ))}

      <ApprovalsReport />
      <SchoolDialog school={editing} onClose={() => setEditing(null)} onSaved={load} />
      <CourseDialog school={newCourse} onClose={() => setNewCourse(null)} onSaved={load} />
      <DiplomaDesigner schoolId={diplomaFor} open={diplomaFor !== null} onClose={() => setDiplomaFor(null)} />
    </div>
  )
}

function SchoolDialog({ school, onClose, onSaved }: { school: SchoolDto | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [director, setDirector] = useState<PickedPerson | null>(null)
  const [sub, setSub] = useState<PickedPerson | null>(null)
  const [passScore, setPassScore] = useState("7")
  const [fee, setFee] = useState("0")
  const [pts, setPts] = useState({ attendance: "30", assignments: "10", payments: "10", toPass: "30" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!school) return
    setName(school.name)
    setDescription(school.description ?? "")
    setDirector(school.directorMemberId ? { id: school.directorMemberId, fullName: school.directorName ?? "Director" } : null)
    setSub(school.subdirectorMemberId ? { id: school.subdirectorMemberId, fullName: school.subdirectorName ?? "Subdirector" } : null)
    setPassScore(String(school.passScore))
    setFee(String(school.enrollmentFee))
    setPts({ attendance: String(school.points.attendance), assignments: String(school.points.assignments), payments: String(school.points.payments), toPass: String(school.points.toPass) })
  }, [school])

  const save = async () => {
    if (!school) return
    setSaving(true)
    try {
      await apiJson(`/api/school/programs/${school.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, description, directorMemberId: director?.id ?? null, subdirectorMemberId: sub?.id ?? null, passScore, enrollmentFee: fee, ...(school.kind === "university" ? { pointsAttendance: pts.attendance, pointsAssignments: pts.assignments, pointsPayments: pts.payments, pointsToPass: pts.toPass } : {}) }),
      })
      notify.success("Programa guardado")
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
      open={school !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Configurar programa"
      description="Dirección, calificación mínima y costo de inscripción por defecto."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputGroupField label="Nombre" required value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <TextareaField id="sd" label="Descripción" rows={2} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
        <StaffPicker label="Director" value={director} onChange={setDirector} />
        <StaffPicker label="Subdirector" value={sub} onChange={setSub} />
        <div className="grid grid-cols-2 gap-3">
          <InputGroupField label="Calificación mínima (0–10)" inputMode="decimal" value={passScore} onChange={(e) => setPassScore(e.target.value)} />
          <InputGroupField label="Inscripción por defecto" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
        {school?.kind === "university" && (
          <div className="space-y-2 rounded-2xl border p-3">
            <p className="text-sm font-medium">Acreditación por puntos</p>
            <p className="text-xs text-muted-foreground">Cada curso suma puntos por asistencia, tareas y pagos; se aprueba con el mínimo.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <InputGroupField label="Asistencia" inputMode="numeric" value={pts.attendance} onChange={(e) => setPts({ ...pts, attendance: e.target.value.replace(/\D/g, "") })} />
              <InputGroupField label="Tareas" inputMode="numeric" value={pts.assignments} onChange={(e) => setPts({ ...pts, assignments: e.target.value.replace(/\D/g, "") })} />
              <InputGroupField label="Pagos" inputMode="numeric" value={pts.payments} onChange={(e) => setPts({ ...pts, payments: e.target.value.replace(/\D/g, "") })} />
              <InputGroupField label="Mínimo para aprobar" inputMode="numeric" value={pts.toPass} onChange={(e) => setPts({ ...pts, toPass: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
        )}
      </div>
    </DialogComponent>
  )
}

function CourseDialog({ school, onClose, onSaved }: { school: SchoolDto | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [order, setOrder] = useState("1")
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!school) return
    setName("")
    setOrder(String((school.courses.at(-1)?.sortOrder ?? 0) + 1))
  }, [school])

  const save = async () => {
    if (!school) return
    setSaving(true)
    try {
      const r = await apiJson<{ id: string }>(`/api/school/programs/${school.id}/courses`, { method: "POST", body: JSON.stringify({ name, sortOrder: Number(order) }) })
      notify.success("Creado; completa sus datos y material")
      onClose()
      router.push(`/admin/school/courses/${r.id}`)
    } catch (e) {
      swalError("No se pudo crear", errorMessage(e))
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={school !== null}
      onOpenChange={(o) => !o && onClose()}
      title={school?.kind === "ministry" ? "Nuevo libro" : "Nuevo curso"}
      description="Después podrás agregar su material, tareas, ejercicios y grupos."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Crear
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <InputGroupField label="Nombre" required placeholder="Ej. ¿Quién es Jesús?" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        <InputGroupField label="Orden" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ""))} />
      </div>
    </DialogComponent>
  )
}

// ── Reporte de aprobados por periodo ──────────────────────────────────────────

const ymdOfLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function ApprovalsReport() {
  const [from, setFrom] = useState<Date | null>(() => new Date(new Date().getFullYear(), 0, 1))
  const [to, setTo] = useState<Date | null>(() => new Date())
  const [report, setReport] = useState<ApprovalsReportDto | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!from || !to) return
    let alive = true
    setLoading(true)
    apiJson<{ report: ApprovalsReportDto }>(`/api/school/reports/approvals?from=${ymdOfLocal(from)}&to=${ymdOfLocal(to)}`)
      .then((d) => {
        if (alive) setReport(d.report)
      })
      .catch((e) => {
        if (alive) swalError("No se pudo cargar el reporte", errorMessage(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [from, to])

  const exportCsv = () => {
    if (!report) return
    const head = ["Libro", "Grupo", "Programa", "Cierre", "Alumnos", "Aprobados", "No aprobados", "Promedio"]
    const lines = report.groups.map((g) => [g.courseName, g.groupName, g.schoolKind === "ministry" ? "Escuela de ministerio" : "Universidad Teológica", g.closedAt.slice(0, 10), g.total, g.passed, g.failed, g.average ?? ""])
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const csv = "﻿" + [head, ...lines].map((l) => l.map(esc).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `escuela-aprobados-${report.from}-${report.to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-3 border-t pt-6">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="flex flex-1 items-center gap-2 font-heading text-lg font-semibold">
          <BarChart3 className="size-5" /> Aprobados por periodo
        </h2>
        <div className="w-40">
          <DatePicker label="Desde" value={from} onChange={setFrom} />
        </div>
        <div className="w-40">
          <DatePicker label="Hasta" value={to} onChange={setTo} />
        </div>
        <Button variant="outline" size="sm" disabled={!report || report.groups.length === 0} onClick={exportCsv}>
          <Download className="size-4" />
          CSV
        </Button>
      </div>
      {loading && !report ? (
        <Skeleton className="h-24 w-full" />
      ) : !report || report.groups.length === 0 ? (
        <EmptyState icon={BarChart3} title="Sin grupos cerrados en el periodo" description="Al cerrar un grupo se calcula quién aprobó y aparece aquí." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Grupos cerrados", value: report.totals.groups },
              { label: "Alumnos", value: report.totals.total },
              { label: "Aprobados", value: report.totals.passed },
              { label: "% de aprobación", value: `${report.totals.rate}%` },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl border bg-card p-3">
                <p className="font-heading text-2xl font-semibold tabular-nums">{t.value}</p>
                <p className="text-xs text-muted-foreground">{t.label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Libro</th>
                  <th className="px-3 py-2 text-left font-medium">Grupo</th>
                  <th className="px-3 py-2 text-right font-medium">Alumnos</th>
                  <th className="px-3 py-2 text-right font-medium">Aprobados</th>
                  <th className="px-3 py-2 text-right font-medium">No aprobados</th>
                  <th className="px-3 py-2 text-right font-medium">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.groups.map((g) => (
                  <tr key={g.groupId}>
                    <td className="px-3 py-2 font-medium">{g.courseName}</td>
                    <td className="px-3 py-2">{g.groupName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.passed}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.failed}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.average ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
