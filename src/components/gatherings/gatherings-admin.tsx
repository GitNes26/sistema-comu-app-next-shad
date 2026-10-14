"use client"

import { TextareaField } from "@/components/base/textarea-field"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { BarChart3, CalendarClock, ChevronLeft, ChevronRight, Download, Loader2, Mic2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { Attachment } from "@/components/base/attachment"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { StatusPill } from "@/components/base/status-pill"
import { SwitchField } from "@/components/base/switch-field"
import { TimePicker } from "@/components/base/time-picker"
import { EmptyState } from "@/components/shared/empty-state"
import { ServiceSheetDialog } from "./service-sheet"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { DAY_LABEL, timeLabel } from "@/lib/cells/rules"
import {
  CATEGORIES,
  CATEGORY_LABEL,
  GATHERING_KIND_LABEL,
  lastOccurrenceOnOrBefore,
  totalAttendance,
  type CategoryKey,
  type GatheringKindKey,
} from "@/lib/gatherings/rules"
import type { GatheringDto, SeriesDto } from "@/lib/gatherings/server"
import { cn } from "@/lib/utils"

// Reuniones generales y de jóvenes: registro de tema, quién compartió, asistencia
// por categoría y ministerios en servicio; horarios configurables y reporte mensual.

type KindFilter = "all" | GatheringKindKey
interface MonthData {
  month: string
  gatherings: GatheringDto[]
  summary: { totals: Record<CategoryKey, number>; total: number; average: number; best: { date: string; total: number } | null; count: number }
}
interface ReportData extends MonthData {
  bySeries: { id: string; name: string; count: number; total: number; average: number; totals: Record<CategoryKey, number> }[]
}

const DAY_OPTIONS = DAY_LABEL.map((d, i) => ({ value: String(i), label: d }))
const fmtDate = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })
const ymdOfLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export function GatheringsAdmin({ canManage }: { canManage: boolean }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [kind, setKind] = useState<KindFilter>("all")
  const [data, setData] = useState<MonthData | null>(null)
  const [series, setSeries] = useState<SeriesDto[]>([])
  const [form, setForm] = useState<GatheringDto | "new" | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<MonthData>(`/api/gatherings?month=${month}${kind === "all" ? "" : `&kind=${kind}`}`)
      setData(d)
    } catch (e) {
      setData({ month, gatherings: [], summary: { totals: { men: 0, women: 0, youth: 0, kids: 0, new: 0 }, total: 0, average: 0, best: null, count: 0 } })
      swalError("No se pudieron cargar las reuniones", errorMessage(e))
    }
  }, [month, kind])

  const loadSeries = useCallback(async () => {
    try {
      const d = await apiJson<{ series: SeriesDto[] }>("/api/gatherings/series")
      setSeries(d.series)
    } catch {
      setSeries([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    void loadSeries()
  }, [loadSeries])

  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number)
    setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7))
  }
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("es-MX", { month: "long", year: "numeric" })

  return (
    <Tabs defaultValue="list">
      <TabsList>
        <TabsTrigger value="list">
          <Mic2 className="size-4" /> Reuniones
        </TabsTrigger>
        <TabsTrigger value="report">
          <BarChart3 className="size-4" /> Asistencia
        </TabsTrigger>
        <TabsTrigger value="series">
          <CalendarClock className="size-4" /> Horarios
        </TabsTrigger>
      </TabsList>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="outline" aria-label="Mes anterior" onClick={() => shift(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-0 flex-1 text-center font-heading text-sm font-semibold first-letter:uppercase">{monthLabel}</p>
        <Button size="icon-sm" variant="outline" aria-label="Mes siguiente" onClick={() => shift(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <TabsContent value="list">
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedFilter<KindFilter>
              ariaLabel="Tipo de reunión"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "Todas" },
                { value: "general", label: "Generales" },
                { value: "youth", label: "Jóvenes" },
              ]}
            />
            {canManage && (
              <Button className="ml-auto" onClick={() => setForm("new")}>
                <Plus className="size-4" />
                Registrar reunión
              </Button>
            )}
          </div>

          {data === null ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <SummaryTiles summary={data.summary} />
              {data.gatherings.length === 0 ? (
                <EmptyState icon={Mic2} title="Sin reuniones este mes" description={canManage ? "Registra el tema, quién compartió y la asistencia de cada reunión." : "Aún no se registran reuniones."} />
              ) : (
                <ul className="space-y-2">
                  {data.gatherings.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => setForm(g)}
                        className="press flex w-full items-start gap-3 rounded-2xl border bg-card p-3 text-left enabled:hover:border-primary/40"
                      >
                        {g.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={g.imageUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-muted">
                            <Mic2 className="size-5 text-muted-foreground" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold first-letter:uppercase">{fmtDate(g.date)}</span>
                            {g.startTime && <span className="text-xs text-muted-foreground">{timeLabel(g.startTime)}</span>}
                            <StatusPill tone={g.kind === "youth" ? "info" : "neutral"} dot={false}>
                              {[g.groupName, g.seriesName].filter(Boolean).join(" · ") || GATHERING_KIND_LABEL[g.kind]}
                            </StatusPill>
                          </span>
                          <span className="block truncate text-sm">{g.topic ?? "Sin tema registrado"}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {g.speakerName ? `Compartió ${g.speakerName}` : "—"}
                            {g.ministryNames.length > 0 ? ` · En servicio: ${g.ministryNames.join(", ")}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-heading text-xl font-semibold tabular-nums">{g.total}</span>
                          <span className="block text-[0.7rem] text-muted-foreground">{g.counts.new > 0 ? `${g.counts.new} nuevos` : "asistentes"}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </TabsContent>

      <TabsContent value="report">
        <ReportTab month={month} kind={kind} onKind={setKind} />
      </TabsContent>

      <TabsContent value="series">
        <SeriesTab series={series} canManage={canManage} onChanged={loadSeries} />
      </TabsContent>

      <GatheringForm
        gathering={form}
        series={series}
        onClose={() => setForm(null)}
        onSaved={async () => {
          setForm(null)
          await load()
        }}
      />
    </Tabs>
  )
}

function SummaryTiles({ summary }: { summary: MonthData["summary"] }) {
  const tiles = [
    { label: "Reuniones", value: summary.count },
    { label: "Asistencia total", value: summary.total },
    { label: "Promedio", value: summary.average },
    { label: "Nuevos", value: summary.totals.new },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border bg-card p-3">
          <p className="font-heading text-2xl font-semibold tabular-nums">{t.value}</p>
          <p className="text-xs text-muted-foreground">{t.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Registro ──────────────────────────────────────────────────────────────────

const count = yup
  .number()
  .transform((v, o) => (o === "" || o === null ? 0 : v))
  .typeError("Número")
  .integer("Entero")
  .min(0, "0 o más")
  .max(100000)
  .default(0)

const gatheringSchema = yup.object({
  seriesId: yup.string().default(""),
  kind: yup.string().oneOf(["general", "youth"]).default("general"),
  ministryId: yup.string().default(""),
  date: yup.date().typeError("Elige la fecha").required("Elige la fecha"),
  startTime: yup.string().default(""),
  topic: yup.string().trim().max(200).default(""),
  speakerName: yup.string().trim().max(150).default(""),
  imageUrl: yup.string().default(""),
  notes: yup.string().trim().max(2000).default(""),
  men: count,
  women: count,
  youth: count,
  kids: count,
  new: count,
})
type GatheringValues = yup.InferType<typeof gatheringSchema>

function GatheringForm({
  gathering,
  series,
  onClose,
  onSaved,
}: {
  gathering: GatheringDto | "new" | null
  series: SeriesDto[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const current = gathering && gathering !== "new" ? gathering : null
  const [ministries, setMinistries] = useState<{ id: string; name: string }[]>([])
  const [serviceFor, setServiceFor] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hint, setHint] = useState<{ kids: number; newcomers: number } | null>(null)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GatheringValues>({ resolver: yupResolver(gatheringSchema) as never })
  const watched = watch()
  const total = totalAttendance({ men: Number(watched.men) || 0, women: Number(watched.women) || 0, youth: Number(watched.youth) || 0, kids: Number(watched.kids) || 0, new: 0 })
  const date = watched.date ? ymdOfLocal(watched.date as Date) : null

  useEffect(() => {
    if (gathering === null) return
    setSelected(new Set(current?.ministryIds ?? []))
    reset({
      seriesId: current?.seriesId ?? "",
      kind: current?.kind ?? "general",
      ministryId: current?.ministryId ?? "",
      date: current ? new Date(`${current.date}T12:00:00`) : (undefined as unknown as Date),
      startTime: current?.startTime ?? "",
      topic: current?.topic ?? "",
      speakerName: current?.speakerName ?? "",
      imageUrl: current?.imageUrl ?? "",
      notes: current?.notes ?? "",
      men: current?.counts.men ?? 0,
      women: current?.counts.women ?? 0,
      youth: current?.counts.youth ?? 0,
      kids: current?.counts.kids ?? 0,
      new: current?.counts.new ?? 0,
    })
  }, [gathering, current, reset])

  useEffect(() => {
    if (gathering === null) return
    apiJson<{ groups: { id: string; name: string }[] }>("/api/gatherings/groups")
      .then((d) => setGroups(d.groups))
      .catch(() => setGroups([]))
  }, [gathering])

  // Cifras que el sistema ya tiene de ese día (Kids, nuevos) y catálogo de ministerios.
  useEffect(() => {
    if (gathering === null || !date) {
      setHint(null)
      return
    }
    let alive = true
    apiJson<{ suggestions: { kids: number; newcomers: number; ministries: { id: string; name: string }[] } }>(`/api/gatherings/suggestions?date=${date}`)
      .then((d) => {
        if (!alive) return
        setHint({ kids: d.suggestions.kids, newcomers: d.suggestions.newcomers })
        setMinistries(d.suggestions.ministries)
      })
      .catch(() => alive && setHint(null))
    return () => {
      alive = false
    }
  }, [gathering, date])

  const pickSeries = (id: string) => {
    setValue("seriesId", id)
    const s = series.find((x) => x.id === id)
    if (s) {
      setValue("kind", s.kind)
      setValue("ministryId", s.ministryId ?? "")
      setValue("startTime", s.startTime)
      // Al elegir horario se sugiere la última fecha en que tocaba, si aún no hay una.
      if (!watched.date) setValue("date", new Date(`${lastOccurrenceOnOrBefore(s.dayOfWeek)}T12:00:00`))
    }
  }

  const submit = async (v: GatheringValues) => {
    try {
      const body = {
        seriesId: v.seriesId || null,
        kind: v.kind,
        ministryId: v.ministryId || null,
        date: ymdOfLocal(v.date),
        startTime: v.startTime || null,
        topic: v.topic,
        speakerName: v.speakerName,
        imageUrl: v.imageUrl || null,
        notes: v.notes,
        counts: { men: v.men, women: v.women, youth: v.youth, kids: v.kids, new: v.new },
        ministryIds: [...selected],
      }
      if (current) await apiJson(`/api/gatherings/${current.id}`, { method: "PUT", body: JSON.stringify(body) })
      else await apiJson("/api/gatherings", { method: "POST", body: JSON.stringify(body) })
      notify.success("Reunión guardada")
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    }
  }

  const remove = async () => {
    if (!current) return
    const yes = await swalConfirm("¿Eliminar este registro?", "Se pierde la asistencia capturada de esa reunión.", { confirmText: "Eliminar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/gatherings/${current.id}`, { method: "DELETE" })
      await onSaved()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }

  const NUMBER_FIELDS: { key: CategoryKey; label: string }[] = CATEGORIES.map((k) => ({ key: k, label: CATEGORY_LABEL[k] }))

  return (
    <DialogComponent
      open={gathering !== null}
      onOpenChange={(o) => !o && onClose()}
      title={current ? "Editar reunión" : "Registrar reunión"}
      description="Tema, quién compartió y asistencia por categoría."
      className="max-w-[90vw]"
      footer={
        <>
          {current && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => void remove()} disabled={isSubmitting}>
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit(submit, (e) => focusFirstInvalid(e, formId))} className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="seriesId"
          render={({ field }) => (
            <FormCombobox
              label="Horario"
              options={series.filter((s) => s.isActive || s.id === field.value).map((s) => ({ value: s.id, label: `${s.name} · ${DAY_LABEL[s.dayOfWeek]} ${timeLabel(s.startTime)}` }))}
              value={field.value}
              onChange={pickSeries}
              onClear={() => field.onChange("")}
              placeholder="Reunión extraordinaria"
            />
          )}
        />
        <div data-form-field="date">
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker label="Fecha" required value={field.value ?? null} onChange={(d) => field.onChange(d ?? undefined)} disabledAfter={new Date()} error={errors.date?.message} />
            )}
          />
        </div>
        {!watched.seriesId && (
          <>
            <Controller
              control={control}
              name="ministryId"
              render={({ field }) => (
                <FormCombobox
                  label="Grupo"
                  options={groups.map((g) => ({ value: g.id, label: g.name }))}
                  value={field.value}
                  onChange={field.onChange}
                  onClear={() => field.onChange("")}
                  placeholder="Toda la iglesia"
                />
              )}
            />
            <Controller control={control} name="startTime" render={({ field }) => <TimePicker label="Hora" value={field.value || null} onChange={(t) => field.onChange(t ?? "")} />} />
          </>
        )}
        <div className="sm:col-span-2">
          <InputGroupField id="topic" label="Tema" placeholder="Tema de la enseñanza" {...register("topic")} />
        </div>
        <div className="sm:col-span-2">
          <InputGroupField id="speakerName" label="Quién compartió" placeholder="Pastor u otra persona a quien se dio la oportunidad" {...register("speakerName")} />
        </div>
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <Attachment label="Imagen del tema (opcional)" value={field.value || null} onChange={(u) => field.onChange(u ?? "")} upload={uploadFile} accept={UPLOAD_IMAGE_ACCEPT} />
            )}
          />
        </div>

        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="flex w-full items-baseline gap-2 text-sm font-semibold">
            <span className="flex-1">Asistencia por categoría</span>
            <span className="text-xs font-normal text-muted-foreground">
              Total: <span className="font-semibold tabular-nums text-foreground">{total}</span>
            </span>
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {NUMBER_FIELDS.map(({ key, label }) => (
              <div key={key} data-form-field={key}>
                <InputGroupField
                  id={`count-${key}`}
                  label={key === "new" ? "Nuevos (incluidos)" : label}
                  inputMode="numeric"
                  error={errors[key]?.message}
                  {...register(key)}
                />
              </div>
            ))}
          </div>
          {hint && (hint.kids > 0 || hint.newcomers > 0) && (
            <div className="flex flex-wrap gap-2">
              {hint.kids > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => setValue("kids", hint.kids)}>
                  Usar niños de Kids: {hint.kids}
                </Button>
              )}
              {hint.newcomers > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => setValue("new", hint.newcomers)}>
                  Usar nuevos de Consolidación: {hint.newcomers}
                </Button>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">«Nuevos» son personas que ya cuentan dentro de las demás categorías; no suman al total.</p>
        </fieldset>

        {ministries.length > 0 && (
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-semibold">Ministerios en servicio</legend>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {ministries.map((m) => (
                <label key={m.id} className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm", selected.has(m.id) && "border-primary bg-primary/5")}>
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={selected.has(m.id)}
                    onChange={() =>
                      setSelected((cur) => {
                        const next = new Set(cur)
                        if (next.has(m.id)) next.delete(m.id)
                        else next.add(m.id)
                        return next
                      })
                    }
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {current && current.ministryIds.length > 0 && (
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-semibold">Asistencia de servidores</legend>
            <p className="text-xs text-muted-foreground">Pasa lista de quienes sirvieron en esta reunión (también la puede pasar cada líder desde su ministerio).</p>
            <div className="flex flex-wrap gap-2">
              {current.ministryIds.map((id, i) => (
                <Button key={id} type="button" size="sm" variant="outline" onClick={() => setServiceFor(id)}>
                  {current.ministryNames[i] ?? "Ministerio"}
                </Button>
              ))}
            </div>
          </fieldset>
        )}

        <TextareaField id="gathering-notes" label="Notas" containerClassName="sm:col-span-2" rows={2} {...register("notes")} />
      </form>
      <ServiceSheetDialog gatheringId={current?.id ?? null} ministryId={serviceFor} open={serviceFor !== null} onClose={() => setServiceFor(null)} />
    </DialogComponent>
  )
}

// ── Reporte mensual ───────────────────────────────────────────────────────────

function ReportTab({ month, kind, onKind }: { month: string; kind: KindFilter; onKind: (k: KindFilter) => void }) {
  const [report, setReport] = useState<ReportData | null>(null)

  useEffect(() => {
    let alive = true
    setReport(null)
    apiJson<{ report: ReportData }>(`/api/gatherings/report?month=${month}${kind === "all" ? "" : `&kind=${kind}`}`)
      .then((d) => alive && setReport(d.report))
      .catch((e) => {
        if (alive) swalError("No se pudo cargar el reporte", errorMessage(e))
      })
    return () => {
      alive = false
    }
  }, [month, kind])

  const exportCsv = () => {
    if (!report) return
    const head = ["Fecha", "Horario", "Tema", "Compartió", ...CATEGORIES.map((c) => CATEGORY_LABEL[c]), "Total"]
    const lines = report.gatherings
      .slice()
      .reverse()
      .map((g) => [g.date, g.seriesName ?? "", g.topic ?? "", g.speakerName ?? "", ...CATEGORIES.map((c) => g.counts[c]), g.total])
    lines.push(["", "Total", "", "", ...CATEGORIES.map((c) => report.summary.totals[c]), report.summary.total])
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const csv = "﻿" + [head, ...lines].map((l) => l.map(esc).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `asistencia-reuniones-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter<KindFilter>
          ariaLabel="Tipo de reunión"
          value={kind}
          onChange={onKind}
          options={[
            { value: "all", label: "Todas" },
            { value: "general", label: "Generales" },
            { value: "youth", label: "Jóvenes" },
          ]}
        />
        <Button className="ml-auto" variant="outline" size="sm" disabled={!report || report.gatherings.length === 0} onClick={exportCsv}>
          <Download className="size-4" />
          CSV
        </Button>
      </div>
      {!report ? (
        <Skeleton className="h-40 w-full" />
      ) : report.gatherings.length === 0 ? (
        <EmptyState icon={BarChart3} title="Sin datos este mes" description="Registra reuniones para ver la asistencia por categoría." />
      ) : (
        <>
          <SummaryTiles summary={report.summary} />
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Horario</th>
                  <th className="px-3 py-2 text-right font-medium">Reuniones</th>
                  {CATEGORIES.map((c) => (
                    <th key={c} className="px-3 py-2 text-right font-medium">
                      {CATEGORY_LABEL[c]}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.bySeries.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                    {CATEGORIES.map((c) => (
                      <td key={c} className="px-3 py-2 text-right tabular-nums">
                        {s.totals[c]}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{s.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.average}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-semibold">
                <tr>
                  <td className="px-3 py-2">Total del mes</td>
                  <td className="px-3 py-2 text-right tabular-nums">{report.summary.count}</td>
                  {CATEGORIES.map((c) => (
                    <td key={c} className="px-3 py-2 text-right tabular-nums">
                      {report.summary.totals[c]}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums">{report.summary.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{report.summary.average}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {report.summary.best && (
            <p className="text-xs text-muted-foreground">
              Mayor asistencia: <span className="font-medium text-foreground first-letter:uppercase">{fmtDate(report.summary.best.date)}</span> con {report.summary.best.total}.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ── Horarios ──────────────────────────────────────────────────────────────────

function SeriesTab({ series, canManage, onChanged }: { series: SeriesDto[]; canManage: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<SeriesDto | "new" | null>(null)
  const grouped = useMemo(() => series, [series])
  return (
    <div className="space-y-3 pt-2">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Nuevo horario
          </Button>
        </div>
      )}
      {grouped.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Sin horarios" description="Configura los días y horas de las reuniones (domingo 10:00, miércoles 19:30…)." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {grouped.map((s) => (
            <li key={s.id} className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3", !s.isActive && "opacity-60")}>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{s.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {DAY_LABEL[s.dayOfWeek]} · {timeLabel(s.startTime)} · {s.groupName ?? "Toda la iglesia"}
                  {!s.isActive ? " · inactivo" : ""}
                </span>
              </span>
              {canManage && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                  Editar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <SeriesDialog series={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  )
}

function SeriesDialog({ series, onClose, onSaved }: { series: SeriesDto | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const current = series && series !== "new" ? series : null
  const [name, setName] = useState("")
  const [groupId, setGroupId] = useState("")
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [day, setDay] = useState("0")
  const [time, setTime] = useState("")
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (series === null) return
    setName(current?.name ?? "")
    setGroupId(current?.ministryId ?? "")
    apiJson<{ groups: { id: string; name: string }[] }>("/api/gatherings/groups")
      .then((d) => setGroups(d.groups))
      .catch(() => setGroups([]))
    setDay(String(current?.dayOfWeek ?? 0))
    setTime(current?.startTime ?? "")
    setActive(current?.isActive ?? true)
  }, [series, current])

  const save = async () => {
    setSaving(true)
    try {
      const body = JSON.stringify({ name, ministryId: groupId || null, dayOfWeek: Number(day), startTime: time, isActive: active })
      if (current) await apiJson(`/api/gatherings/series/${current.id}`, { method: "PUT", body })
      else await apiJson("/api/gatherings/series", { method: "POST", body })
      notify.success("Horario guardado")
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
      open={series !== null}
      onOpenChange={(o) => !o && onClose()}
      title={current ? "Editar horario" : "Nuevo horario"}
      description="Se configura por iglesia; puede cambiar cuando haga falta."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !name.trim() || !time}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <InputGroupField label="Nombre" required placeholder="Ej. Domingo 10:00" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <FormCombobox
          label="Grupo"
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
          value={groupId}
          onChange={setGroupId}
          onClear={() => setGroupId("")}
          placeholder="Toda la iglesia"
        />
        <div className="grid grid-cols-2 gap-3">
          <FormCombobox label="Día" required options={DAY_OPTIONS} value={day} onChange={setDay} clearable={false} />
          <TimePicker label="Hora" required value={time || null} onChange={(t) => setTime(t ?? "")} />
        </div>
        {current && <SwitchField label="Activo" description="Un horario inactivo conserva su historial." checked={active} onCheckedChange={setActive} />}
      </div>
    </DialogComponent>
  )
}

