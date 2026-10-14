"use client"

import { TextareaField } from "@/components/base/textarea-field"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowLeft, ArrowUp, Ban, BookOpen, ClipboardList, FileText, ListChecks, Loader2, Plus, Settings2, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { SwitchField } from "@/components/base/switch-field"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { QUESTION_TYPES, QUESTION_TYPE_LABEL, type QuestionTypeKey } from "@/lib/school/rules"
import type { AssessmentAdminDto, CourseAdminDto, QuestionAdminDto } from "@/lib/school/server"
import { StaffPicker, type PickedPerson } from "./school-admin"
import { DocumentsTab } from "./documents-tab"
import { cn } from "@/lib/utils"

// Un libro de la escuela: sus datos y costos, material por semana, tareas y
// ejercicios (cuestionarios) y los grupos que lo cursan.

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const ymdOfLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const CONTENT_TYPES = [
  { value: "text", label: "Lectura (texto)" },
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Video (YouTube o Vimeo)" },
  { value: "link", label: "Enlace" },
  { value: "image", label: "Imagen" },
]

export function CourseEditor({ courseId }: { courseId: string }) {
  const [data, setData] = useState<CourseAdminDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ course: CourseAdminDto }>(`/api/school/courses/${courseId}`)
      setData(d.course)
    } catch (e) {
      setError(errorMessage(e, "No se pudo abrir el libro"))
    }
  }, [courseId])
  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/school">
            <ArrowLeft className="size-4" />
            Escuela
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir el libro" description={error} />
      </div>
    )
  }
  if (!data) return <Skeleton className="h-64 w-full" />
  const c = data.course

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/school">
          <ArrowLeft className="size-4" />
          Escuela
        </Link>
      </Button>
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{c.name}</h1>
        <p className="text-sm text-muted-foreground">
          {c.weeks} semanas · {c.tasksCount} tareas · {c.exercisesCount} ejercicios · inscripción {money(c.enrollmentFee)}
          {c.bookPrice > 0 ? ` · libro ${money(c.bookPrice)}` : ""}
        </p>
      </div>
      <Tabs defaultValue="assessments">
        <TabsList>
          <TabsTrigger value="assessments">
            <ListChecks className="size-4" /> Tareas y ejercicios
          </TabsTrigger>
          <TabsTrigger value="content">
            <FileText className="size-4" /> Material
          </TabsTrigger>
          <TabsTrigger value="book">
            <BookOpen className="size-4" /> Libro digital
          </TabsTrigger>
          <TabsTrigger value="groups">
            <Users className="size-4" /> Grupos
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings2 className="size-4" /> Datos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assessments">
          <AssessmentsTab data={data} onChanged={load} />
        </TabsContent>
        <TabsContent value="content">
          <ContentTab data={data} onChanged={load} />
        </TabsContent>
        <TabsContent value="book">
          <DocumentsTab courseId={data.course.id} weeks={data.course.weeks} />
        </TabsContent>
        <TabsContent value="groups">
          <GroupsTab data={data} onChanged={load} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab data={data} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Datos del libro ───────────────────────────────────────────────────────────

function SettingsTab({ data, onChanged }: { data: CourseAdminDto; onChanged: () => Promise<void> }) {
  const c = data.course
  const [v, setV] = useState({
    name: c.name,
    description: c.description ?? "",
    sortOrder: String(c.sortOrder),
    weeks: String(c.weeks),
    tasksCount: String(c.tasksCount),
    exercisesCount: String(c.exercisesCount),
    enrollmentFee: String(c.enrollmentFee),
    bookPrice: String(c.bookPrice),
    digitalBookUrl: c.digitalBookUrl ?? "",
    imageUrl: c.imageUrl ?? "",
    isActive: c.isActive,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v, val: string | boolean) => setV((cur) => ({ ...cur, [k]: val }))

  const save = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/school/courses/${c.id}`, { method: "PUT", body: JSON.stringify(v) })
      notify.success("Libro guardado")
      await onChanged()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <InputGroupField label="Nombre" required value={v.name} maxLength={120} onChange={(e) => set("name", e.target.value)} />
        </div>
        <TextareaField id="cdesc" label="Descripción" containerClassName="sm:col-span-2" rows={3} value={v.description} maxLength={2000} onChange={(e) => set("description", e.target.value)} />
        <InputGroupField label="Orden (grado)" inputMode="numeric" value={v.sortOrder} onChange={(e) => set("sortOrder", e.target.value.replace(/\D/g, ""))} />
        <InputGroupField label="Duración (semanas)" inputMode="numeric" value={v.weeks} onChange={(e) => set("weeks", e.target.value.replace(/\D/g, ""))} />
        <InputGroupField label="Número de tareas" inputMode="numeric" value={v.tasksCount} onChange={(e) => set("tasksCount", e.target.value.replace(/\D/g, ""))} />
        <InputGroupField label="Número de ejercicios" inputMode="numeric" value={v.exercisesCount} onChange={(e) => set("exercisesCount", e.target.value.replace(/\D/g, ""))} />
        <InputGroupField label="Costo de inscripción" inputMode="decimal" value={v.enrollmentFee} onChange={(e) => set("enrollmentFee", e.target.value)} helper="Se aplica a quienes se inscriban desde ahora." />
        <InputGroupField label="Libro de texto (opcional)" inputMode="decimal" value={v.bookPrice} onChange={(e) => set("bookPrice", e.target.value)} helper="Se vende aparte de la inscripción." />
        <div className="sm:col-span-2">
          <InputGroupField label="Libro digital (enlace, opcional)" type="url" inputMode="url" placeholder="https://…" value={v.digitalBookUrl} onChange={(e) => set("digitalBookUrl", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <SwitchField label="Activo" description="Un libro inactivo deja de ofrecerse, pero conserva su historial." checked={v.isActive} onCheckedChange={(b) => set("isActive", b)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving || !v.name.trim()}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  )
}

// ── Material ──────────────────────────────────────────────────────────────────

function ContentTab({ data, onChanged }: { data: CourseAdminDto; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<CourseAdminDto["contents"][number] | "new" | null>(null)
  const weeks = Array.from({ length: data.course.weeks }, (_, i) => i + 1)
  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Agregar material
        </Button>
      </div>
      {weeks.map((w) => {
        const items = data.contents.filter((c) => c.week === w)
        return (
          <section key={w} className="rounded-2xl border bg-card">
            <h3 className="border-b px-4 py-2 text-sm font-semibold">Semana {w}</h3>
            {items.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Sin material.</p>
            ) : (
              <ul className="divide-y">
                {items.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-4 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">{CONTENT_TYPES.find((t) => t.value === c.type)?.label}</span>
                    </span>
                    {!c.isPublished && <StatusPill tone="neutral" dot={false}>Borrador</StatusPill>}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                      Editar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
      <ContentDialog courseId={data.course.id} weeks={data.course.weeks} item={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  )
}

function ContentDialog({
  courseId,
  weeks,
  item,
  onClose,
  onSaved,
}: {
  courseId: string
  weeks: number
  item: CourseAdminDto["contents"][number] | "new" | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const current = item && item !== "new" ? item : null
  const [v, setV] = useState({ week: "1", title: "", type: "text", url: "", body: "", isPublished: true })
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (item === null) return
    setV({ week: String(current?.week ?? 1), title: current?.title ?? "", type: current?.type ?? "text", url: current?.url ?? "", body: current?.body ?? "", isPublished: current?.isPublished ?? true })
  }, [item, current])

  const save = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/school/courses/${courseId}/contents`, { method: "POST", body: JSON.stringify({ ...v, id: current?.id, week: Number(v.week) }) })
      notify.success("Material guardado")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!current) return
    const yes = await swalConfirm("¿Quitar este material?", undefined, { confirmText: "Quitar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/school/courses/${courseId}/contents?id=${current.id}`, { method: "DELETE" })
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo quitar", errorMessage(e))
    }
  }

  return (
    <DialogComponent
      open={item !== null}
      onOpenChange={(o) => !o && onClose()}
      title={current ? "Editar material" : "Agregar material"}
      footer={
        <>
          {current && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => void remove()} disabled={saving}>
              <Trash2 className="size-4" />
              Quitar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !v.title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormCombobox
          label="Semana"
          options={Array.from({ length: weeks }, (_, i) => ({ value: String(i + 1), label: `Semana ${i + 1}` }))}
          value={v.week}
          onChange={(x) => setV((c) => ({ ...c, week: x }))}
          clearable={false}
        />
        <FormCombobox label="Tipo" options={CONTENT_TYPES} value={v.type} onChange={(x) => setV((c) => ({ ...c, type: x }))} clearable={false} />
        <div className="sm:col-span-2">
          <InputGroupField label="Título" required value={v.title} maxLength={150} onChange={(e) => setV((c) => ({ ...c, title: e.target.value }))} />
        </div>
        {v.type === "text" ? (
          <TextareaField id="cbody" label="Contenido" containerClassName="sm:col-span-2" rows={8} value={v.body} onChange={(e) => setV((c) => ({ ...c, body: e.target.value }))} />
        ) : (
          <div className="sm:col-span-2">
            <InputGroupField label="Enlace" required type="url" inputMode="url" placeholder="https://…" value={v.url} onChange={(e) => setV((c) => ({ ...c, url: e.target.value }))} />
          </div>
        )}
        <div className="sm:col-span-2">
          <SwitchField label="Publicado" description="Los alumnos solo ven el material publicado." checked={v.isPublished} onCheckedChange={(b) => setV((c) => ({ ...c, isPublished: b }))} />
        </div>
      </div>
    </DialogComponent>
  )
}

// ── Tareas y ejercicios ───────────────────────────────────────────────────────

function AssessmentsTab({ data, onChanged }: { data: CourseAdminDto; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<{ id: string | null; kind: "task" | "exercise"; number: number } | null>(null)
  const slot = (kind: "task" | "exercise", n: number) => data.assessments.find((a) => a.kind === kind && a.number === n)
  const section = (kind: "task" | "exercise", total: number, title: string) => (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
          const a = slot(kind, n)
          return (
            <li key={n}>
              <button
                type="button"
                onClick={() => setEditing({ id: a?.id ?? null, kind, number: n })}
                className={cn("press flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left hover:border-primary/40", !a && "border-dashed")}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold tabular-nums">{n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a?.title ?? "Sin crear"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {a ? `${a.questions} pregunta${a.questions === 1 ? "" : "s"}${a.week ? ` · semana ${a.week}` : ""}${a.submissions ? ` · ${a.submissions} envío(s)` : ""}` : "Toca para crearla"}
                  </span>
                </span>
                {a && <StatusPill tone={a.isPublished ? "success" : "neutral"} dot={false}>{a.isPublished ? "Publicada" : "Borrador"}</StatusPill>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
  return (
    <div className="space-y-5 pt-2">
      {section("task", data.course.tasksCount, "Tareas")}
      {section("exercise", data.course.exercisesCount, "Ejercicios")}
      <AssessmentDialog courseId={data.course.id} weeks={data.course.weeks} target={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  )
}

const emptyQuestion = (type: QuestionTypeKey): QuestionAdminDto => ({
  type,
  prompt: "",
  imageUrl: null,
  videoUrl: null,
  points: 1,
  config:
    type === "multiple_choice"
      ? { options: [{ text: "" }, { text: "" }], correct: 0 }
      : type === "multiple_select"
        ? { options: [{ text: "" }, { text: "" }], correct: [] }
        : type === "true_false"
          ? { correct: true }
          : type === "fill_blank"
            ? { answers: [[""]] }
            : type === "matching"
              ? { pairs: [{ left: "", right: "" }, { left: "", right: "" }] }
              : type === "ordering"
                ? { items: ["", ""] }
                : {},
})

function AssessmentDialog({
  courseId,
  weeks,
  target,
  onClose,
  onSaved,
}: {
  courseId: string
  weeks: number
  target: { id: string | null; kind: "task" | "exercise"; number: number } | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [loaded, setLoaded] = useState<AssessmentAdminDto | null>(null)
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [week, setWeek] = useState("")
  const [attempts, setAttempts] = useState("1")
  const [limit, setLimit] = useState("")
  const [published, setPublished] = useState(false)
  const [questions, setQuestions] = useState<QuestionAdminDto[]>([])
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!target) return
    setLoaded(null)
    if (!target.id) {
      setTitle("")
      setInstructions("")
      setWeek("")
      setAttempts("1")
      setLimit("")
      setPublished(false)
      setQuestions([])
      return
    }
    setBusy(true)
    apiJson<{ assessment: AssessmentAdminDto }>(`/api/school/assessments/${target.id}`)
      .then((d) => {
        const a = d.assessment
        setLoaded(a)
        setTitle(a.title)
        setInstructions(a.instructions ?? "")
        setWeek(a.week ? String(a.week) : "")
        setAttempts(String(a.maxAttempts))
        setLimit(a.timeLimitMin ? String(a.timeLimitMin) : "")
        setPublished(a.isPublished)
        setQuestions(a.questions)
      })
      .catch((e) => {
        swalError("No se pudo abrir", errorMessage(e))
        onClose()
      })
      .finally(() => setBusy(false))
  }, [target, onClose])

  const locked = (loaded?.submissions ?? 0) > 0

  const save = async () => {
    if (!target) return
    setSaving(true)
    try {
      await apiJson(`/api/school/courses/${courseId}/assessments`, {
        method: "POST",
        body: JSON.stringify({
          id: target.id,
          kind: target.kind,
          number: target.number,
          title,
          instructions,
          week: week || null,
          maxAttempts: Number(attempts),
          timeLimitMin: limit || null,
          isPublished: published,
          // Con envíos hechos las preguntas ya no se reemplazan.
          ...(locked ? {} : { questions }),
        }),
      })
      notify.success("Actividad guardada")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!target?.id) return
    const yes = await swalConfirm("¿Eliminar esta actividad?", "Se borran sus preguntas.", { confirmText: "Eliminar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/school/courses/${courseId}/assessments?id=${target.id}`, { method: "DELETE" })
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }

  const setQ = (i: number, patch: Partial<QuestionAdminDto>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const move = (i: number, d: number) =>
    setQuestions((qs) => {
      const next = [...qs]
      const j = i + d
      if (j < 0 || j >= next.length) return qs
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  return (
    <DialogComponent
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title={target ? `${target.kind === "task" ? "Tarea" : "Ejercicio"} ${target.number}` : "Actividad"}
      description="Cuestionario con preguntas de 7 tipos; se califica solo salvo las abiertas."
      className="max-w-[96vw] md:max-w-4xl"
      footer={
        <>
          {target?.id && !locked && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => void remove()} disabled={saving}>
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || busy || !title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      {busy ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <InputGroupField label="Título" required value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <TextareaField id="ins" label="Instrucciones" containerClassName="sm:col-span-4" rows={2} value={instructions} maxLength={4000} onChange={(e) => setInstructions(e.target.value)} />
            <FormCombobox
              label="Semana"
              options={Array.from({ length: weeks }, (_, i) => ({ value: String(i + 1), label: `Semana ${i + 1}` }))}
              value={week}
              onChange={setWeek}
              onClear={() => setWeek("")}
              placeholder="Todas"
            />
            <InputGroupField label="Intentos permitidos" inputMode="numeric" value={attempts} onChange={(e) => setAttempts(e.target.value.replace(/\D/g, ""))} />
            <InputGroupField label="Tiempo límite (min)" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} helper="Vacío = sin límite" />
            <div className="self-end">
              <SwitchField label="Publicada" checked={published} onCheckedChange={setPublished} />
            </div>
          </div>

          {locked && <p className="rounded-xl bg-warning/10 p-3 text-sm text-warning-ink">Ya hay envíos de alumnos: las preguntas no se pueden cambiar. Puedes ajustar los datos generales.</p>}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Preguntas ({questions.length})</h3>
            {questions.map((q, i) => (
              <fieldset key={i} disabled={locked} className="space-y-3 rounded-2xl border p-3">
                <legend className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
                  Pregunta {i + 1}
                  {!locked && (
                    <>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="Bajar" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar pregunta" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </legend>
                <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                  <FormCombobox
                    label="Tipo"
                    options={QUESTION_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABEL[t] }))}
                    value={q.type}
                    onChange={(t) => setQ(i, { ...emptyQuestion(t as QuestionTypeKey), prompt: q.prompt, points: q.points, imageUrl: q.imageUrl, videoUrl: q.videoUrl })}
                    clearable={false}
                  />
                  <InputGroupField label="Puntos" inputMode="decimal" value={String(q.points)} onChange={(e) => setQ(i, { points: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{q.type === "fill_blank" ? "Enunciado (usa ___ para cada espacio)" : "Enunciado"}</Label>
                  <Textarea rows={2} value={q.prompt} maxLength={4000} onChange={(e) => setQ(i, { prompt: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InputGroupField label="Imagen (enlace, opcional)" type="url" value={q.imageUrl ?? ""} onChange={(e) => setQ(i, { imageUrl: e.target.value || null })} />
                  <InputGroupField label="Video (enlace, opcional)" type="url" value={q.videoUrl ?? ""} onChange={(e) => setQ(i, { videoUrl: e.target.value || null })} />
                </div>
                <ConfigEditor q={q} onChange={(config) => setQ(i, { config })} />
              </fieldset>
            ))}
            {!locked && (
              <Button type="button" variant="outline" onClick={() => setQuestions((qs) => [...qs, emptyQuestion("multiple_choice")])}>
                <Plus className="size-4" />
                Agregar pregunta
              </Button>
            )}
          </section>
        </div>
      )}
    </DialogComponent>
  )
}

function ConfigEditor({ q, onChange }: { q: QuestionAdminDto; onChange: (c: Record<string, unknown>) => void }) {
  const cfg = q.config as Record<string, unknown>
  const options = (Array.isArray(cfg.options) ? cfg.options : []) as { text: string; imageUrl?: string }[]

  if (q.type === "open") return <p className="text-xs text-muted-foreground">Respuesta libre: la califica el maestro.</p>
  if (q.type === "true_false") {
    return (
      <div className="flex gap-2">
        {[
          { v: true, label: "La respuesta es Verdadero" },
          { v: false, label: "La respuesta es Falso" },
        ].map((o) => (
          <Button key={String(o.v)} type="button" variant={cfg.correct === o.v ? "default" : "outline"} onClick={() => onChange({ correct: o.v })}>
            {o.label}
          </Button>
        ))}
      </div>
    )
  }
  if (q.type === "multiple_choice" || q.type === "multiple_select") {
    const multi = q.type === "multiple_select"
    const correct = multi ? ((cfg.correct as number[]) ?? []) : [Number(cfg.correct)]
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Marca {multi ? "las opciones correctas" : "la opción correcta"}.</p>
        {options.map((o, idx) => (
          <div key={idx} className="grid grid-cols-[auto_1fr_1fr_auto] items-start gap-2">
            <input
              type={multi ? "checkbox" : "radio"}
              name={`correct-${q.id ?? "n"}`}
              aria-label={`Opción ${idx + 1} correcta`}
              className="mt-3 size-4 accent-[var(--primary)]"
              checked={correct.includes(idx)}
              onChange={() => {
                if (!multi) return onChange({ ...cfg, correct: idx })
                const next = correct.includes(idx) ? correct.filter((c) => c !== idx) : [...correct, idx]
                onChange({ ...cfg, correct: next.sort((a, b) => a - b) })
              }}
            />
            <InputGroupField aria-label={`Texto de la opción ${idx + 1}`} placeholder={`Opción ${idx + 1}`} value={o.text} onChange={(e) => onChange({ ...cfg, options: options.map((x, j) => (j === idx ? { ...x, text: e.target.value } : x)) })} />
            <InputGroupField aria-label="Imagen de la opción" type="url" placeholder="Imagen (opcional)" value={o.imageUrl ?? ""} onChange={(e) => onChange({ ...cfg, options: options.map((x, j) => (j === idx ? { ...x, imageUrl: e.target.value || undefined } : x)) })} />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Quitar opción"
              disabled={options.length <= 2}
              onClick={() => {
                const nextOptions = options.filter((_, j) => j !== idx)
                const nextCorrect = multi ? correct.filter((c) => c !== idx).map((c) => (c > idx ? c - 1 : c)) : Math.min(Number(cfg.correct), nextOptions.length - 1)
                onChange({ ...cfg, options: nextOptions, correct: nextCorrect })
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {options.length < 8 && (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...cfg, options: [...options, { text: "" }] })}>
            <Plus className="size-4" /> Opción
          </Button>
        )}
      </div>
    )
  }
  if (q.type === "fill_blank") {
    const answers = (Array.isArray(cfg.answers) ? cfg.answers : []) as string[][]
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Respuesta de cada espacio, en orden. Separa con «|» las variantes aceptadas.</p>
        {answers.map((a, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <InputGroupField
                aria-label={`Respuesta del espacio ${i + 1}`}
                placeholder={`Espacio ${i + 1}`}
                value={a.join(" | ")}
                onChange={(e) => onChange({ ...cfg, answers: answers.map((x, j) => (j === i ? e.target.value.split("|").map((s) => s.trim()).filter(Boolean) : x)) })}
              />
            </div>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar espacio" disabled={answers.length <= 1} onClick={() => onChange({ ...cfg, answers: answers.filter((_, j) => j !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...cfg, answers: [...answers, [""]] })}>
          <Plus className="size-4" /> Espacio
        </Button>
      </div>
    )
  }
  if (q.type === "matching") {
    const pairs = (Array.isArray(cfg.pairs) ? cfg.pairs : []) as { left: string; right: string }[]
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Cada fila es una pareja correcta; el alumno las verá revueltas.</p>
        {pairs.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
            <InputGroupField aria-label="Elemento" placeholder="Elemento" value={p.left} onChange={(e) => onChange({ ...cfg, pairs: pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })} />
            <InputGroupField aria-label="Pareja" placeholder="Su pareja" value={p.right} onChange={(e) => onChange({ ...cfg, pairs: pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })} />
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar pareja" disabled={pairs.length <= 2} onClick={() => onChange({ ...cfg, pairs: pairs.filter((_, j) => j !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {pairs.length < 10 && (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...cfg, pairs: [...pairs, { left: "", right: "" }] })}>
            <Plus className="size-4" /> Pareja
          </Button>
        )}
      </div>
    )
  }
  // ordering
  const items = (Array.isArray(cfg.items) ? cfg.items : []) as string[]
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Escríbelos en el orden correcto; el alumno los verá revueltos.</p>
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2.5 w-5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
          <div className="flex-1">
            <InputGroupField aria-label={`Elemento ${i + 1}`} value={it} onChange={(e) => onChange({ ...cfg, items: items.map((x, j) => (j === i ? e.target.value : x)) })} />
          </div>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar" disabled={items.length <= 2} onClick={() => onChange({ ...cfg, items: items.filter((_, j) => j !== i) })}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {items.length < 10 && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...cfg, items: [...items, ""] })}>
          <Plus className="size-4" /> Elemento
        </Button>
      )}
    </div>
  )
}

// ── Grupos ────────────────────────────────────────────────────────────────────

function GroupsTab({ data, onChanged }: { data: CourseAdminDto; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<CourseAdminDto["course"]["groups"][number] | "new" | null>(null)
  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Nuevo grupo
        </Button>
      </div>
      {data.course.groups.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sin grupos" description="Un grupo cursa el libro con su maestro y apoyo en un periodo." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.course.groups.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-2xl border bg-card p-3">
              <Link href={`/admin/school/groups/${g.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium hover:underline">{g.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[g.teacherName ? `Maestro: ${g.teacherName}` : "Sin maestro", g.assistantName ? `Apoyo: ${g.assistantName}` : null, `${g.enrolled} alumno(s)`].filter(Boolean).join(" · ")}
                </span>
              </Link>
              <StatusPill tone={g.status === "open" ? "success" : g.status === "closed" ? "neutral" : "info"}>{g.status === "open" ? "Abierto" : g.status === "closed" ? "Cerrado" : "Por iniciar"}</StatusPill>
              <Button size="sm" variant="ghost" onClick={() => setEditing(g)}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <GroupDialog courseId={data.course.id} group={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  )
}

function GroupDialog({
  courseId,
  group,
  onClose,
  onSaved,
}: {
  courseId: string
  group: CourseAdminDto["course"]["groups"][number] | "new" | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const current = group && group !== "new" ? group : null
  const [name, setName] = useState("")
  const [teacher, setTeacher] = useState<PickedPerson | null>(null)
  const [assistant, setAssistant] = useState<PickedPerson | null>(null)
  const [start, setStart] = useState<Date | null>(null)
  const [end, setEnd] = useState<Date | null>(null)
  const [capacity, setCapacity] = useState("")
  const [status, setStatus] = useState("planned")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (group === null) return
    setName(current?.name ?? "")
    setTeacher(null)
    setAssistant(null)
    setStart(current?.startDate ? new Date(`${current.startDate}T12:00:00`) : null)
    setEnd(current?.endDate ? new Date(`${current.endDate}T12:00:00`) : null)
    setCapacity(current?.capacity ? String(current.capacity) : "")
    setStatus(current?.status ?? "planned")
  }, [group, current])

  const save = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/school/courses/${courseId}/groups`, {
        method: "POST",
        body: JSON.stringify({
          id: current?.id,
          name,
          // Al editar sin tocar los maestros se conservan (undefined = no se envía).
          ...(teacher || !current ? { teacherMemberId: teacher?.id ?? null } : {}),
          ...(assistant || !current ? { assistantMemberId: assistant?.id ?? null } : {}),
          startDate: start ? ymdOfLocal(start) : null,
          endDate: end ? ymdOfLocal(end) : null,
          capacity: capacity || null,
          status,
        }),
      })
      notify.success("Grupo guardado")
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
      open={group !== null}
      onOpenChange={(o) => !o && onClose()}
      title={current ? "Editar grupo" : "Nuevo grupo"}
      description="Un libro tiene 1 maestro y 1 apoyo por grupo."
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
        <InputGroupField label="Nombre del grupo" required placeholder="Ej. Grupo martes 7 pm" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        {current && (current.teacherName || current.assistantName) && (
          <p className="text-xs text-muted-foreground">
            Actual: {[current.teacherName ? `Maestro ${current.teacherName}` : null, current.assistantName ? `Apoyo ${current.assistantName}` : null].filter(Boolean).join(" · ")}. Elige otra persona solo si quieres cambiarlos.
          </p>
        )}
        <StaffPicker label="Maestro" value={teacher} onChange={setTeacher} />
        <StaffPicker label="Maestro de apoyo" value={assistant} onChange={setAssistant} />
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePicker label="Inicio" value={start} onChange={setStart} onClear={() => setStart(null)} />
          <DatePicker label="Fin" value={end} onChange={setEnd} onClear={() => setEnd(null)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputGroupField label="Cupo (opcional)" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} />
          <FormCombobox
            label="Estado"
            options={[
              { value: "planned", label: "Por iniciar (recibe solicitudes)" },
              { value: "open", label: "Abierto (en curso)" },
              { value: "closed", label: "Cerrado" },
            ]}
            value={status}
            onChange={setStatus}
            clearable={false}
          />
        </div>
      </div>
    </DialogComponent>
  )
}
