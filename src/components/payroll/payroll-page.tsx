"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  CalendarRange,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  HandCoins,
  Loader2,
  Pencil,
  Plus,
  Repeat,
  Save,
  Settings2,
  Trash2,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { DatePicker, EntityCell, InputGroupField, SegmentedFilter, StatusPill, TimePicker } from "@/components/base"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { money } from "@/lib/money"
import { swalConfirm, swalError } from "@/lib/swal"
import { errorMessage } from "@/lib/ministries/client"
import { cn } from "@/lib/utils"
import { FREQUENCY_LABELS, PAY_METHOD_LABELS, SALARY_TYPE_LABELS, WEEKDAY_LABELS, rates, suggestPeriod } from "@/lib/payroll/calc"
import { fmtDate, PERIOD_STATUS, payrollApi, type PayConcept, type PayEmployee, type PayPeriodRow } from "./payroll-api"

// Nómina ligera: periodos, configuración de pago por colaborador y conceptos.
// No calcula impuestos (ISR/IMSS) ni timbra; el recibo es un comprobante interno.

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fromIso = (s: string) => (s ? new Date(`${s}T12:00:00`) : null)

export function PayrollPage() {
  const router = useRouter()
  const [data, setData] = useState<{ employees: PayEmployee[]; concepts: PayConcept[]; periods: PayPeriodRow[] } | null>(null)
  const [tab, setTab] = useState("periods")
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PayEmployee | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await payrollApi.workspace())
    } catch (err) {
      swalError("No se pudo cargar la nómina", errorMessage(err))
      setData({ employees: [], concepts: [], periods: [] })
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const unconfigured = data?.employees.filter((e) => !e.salaryType || e.salaryAmount <= 0).length ?? 0

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
            <HandCoins className="size-6 text-primary" /> Nómina
          </h1>
          <p className="text-sm text-muted-foreground">Calcula la paga del personal por periodo: sueldo, horas extra, festivos y descansos. Recibo impreso o por correo.</p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!data?.employees.length}>
          <Plus className="size-4" /> Nueva nómina
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3">
          <TabsTrigger value="periods">Nóminas</TabsTrigger>
          <TabsTrigger value="employees">
            Personal y pago
            {unconfigured > 0 && <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-xs text-warning-ink">{unconfigured}</span>}
          </TabsTrigger>
          <TabsTrigger value="concepts">Percepciones y deducciones</TabsTrigger>
        </TabsList>

        <TabsContent value="periods">
          {!data ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : data.periods.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Aún no hay nóminas"
              description="1) Configura cómo se le paga a cada persona. 2) Crea la nómina del periodo. 3) Ajusta lo capturado, cierra y entrega recibos."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => setTab("employees")}>
                    <Settings2 className="size-4" /> Configurar pagos
                  </Button>
                  <Button onClick={() => setCreating(true)} disabled={!data.employees.length}>
                    <Plus className="size-4" /> Crear la primera
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.periods.map((p) => {
                const st = PERIOD_STATUS[p.status] ?? PERIOD_STATUS.draft
                return (
                  <Link key={p.id} href={`/admin/payroll/${p.id}`} className="press group block rounded-2xl border bg-card p-4 ring-1 ring-transparent transition hover:ring-primary/30">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {p.folio} · {FREQUENCY_LABELS[p.frequency] ?? p.frequency}
                        </p>
                        <p className="mt-0.5 font-semibold">
                          {fmtDate(p.startDate)} – {fmtDate(p.endDate)}
                        </p>
                      </div>
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        <p className="flex items-center gap-1">
                          <Users className="size-3.5" /> {p.employees} {p.employees === 1 ? "persona" : "personas"}
                        </p>
                        {p.status !== "draft" && (
                          <p className="mt-0.5">
                            Pagados {p.paid} de {p.employees}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Neto a pagar</p>
                        <p className="font-heading text-xl font-semibold tabular-nums">{money(p.net)}</p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="employees">
          {!data ? (
            <Skeleton className="h-64 rounded-2xl" />
          ) : data.employees.length === 0 ? (
            <EmptyState icon={Users} title="Sin personal activo" description="Da de alta a tu equipo en Personal (Catálogos) y vuelve aquí para definir cómo se les paga." />
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="divide-y">
                {data.employees.map((e) => {
                  const missing = !e.salaryType || e.salaryAmount <= 0
                  return (
                    <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <EntityCell title={e.fullName} subtitle={[e.position, e.location].filter(Boolean).join(" · ") || e.employeeCode || undefined} image={e.imageUrl} className="min-w-52 flex-1" />
                      <div className="min-w-40 text-sm">
                        {missing ? (
                          <StatusPill tone="warning">Sin sueldo definido</StatusPill>
                        ) : (
                          <>
                            <p className="font-semibold tabular-nums">
                              {money(e.salaryAmount)} <span className="text-xs font-normal text-muted-foreground">{SALARY_TYPE_LABELS[e.salaryType]}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Pago {FREQUENCY_LABELS[e.paymentFrequency]?.toLowerCase()} · {PAY_METHOD_LABELS[e.payMethod]}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="min-w-44 text-xs text-muted-foreground">
                        <p className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {e.workDays.map((d) => WEEKDAY_LABELS[d]).join(" ")}
                          {e.shiftStart && e.shiftEnd ? ` · ${e.shiftStart}–${e.shiftEnd}` : ` · ${e.dailyHours} h`}
                        </p>
                        <p className="mt-0.5">
                          Extra ×{e.overtimeRate} · Festivo ×{e.holidayRate} · Descanso ×{e.restDayRate}
                        </p>
                      </div>
                      <Button variant={missing ? "default" : "outline"} size="sm" onClick={() => setEditing(e)}>
                        <Settings2 className="size-4" /> Configurar
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="concepts">
          <ConceptsPanel concepts={data?.concepts ?? null} onChange={load} />
        </TabsContent>
      </Tabs>

      {editing && (
        <EmployeePayDialog
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
      {data && <NewPeriodDialog open={creating} onOpenChange={setCreating} employees={data.employees} onCreated={(id) => router.push(`/admin/payroll/${id}`)} />}
    </div>
  )
}

/** Etiqueta con icono para los grupos segmentados (que no son un input). */
function GroupLabel({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Label className="flex items-center gap-1.5 text-sm leading-none">
      <Icon className="size-4 text-muted-foreground" />
      {children}
    </Label>
  )
}

// ── Configuración de pago de una persona ────────────────────────────────────

function EmployeePayDialog({ employee, onClose, onSaved }: { employee: PayEmployee; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ ...employee, salaryType: employee.salaryType || "monthly" })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof PayEmployee>(k: K, v: PayEmployee[K]) => setF((c) => ({ ...c, [k]: v }))
  const r = rates({ ...f })
  const numInput = (k: "salaryAmount" | "dailyHours" | "overtimeRate" | "holidayRate" | "restDayRate", label: string, hint?: string, icon?: React.ReactNode) => (
    <InputGroupField
      label={label}
      hint={hint}
      type="number"
      inputMode="decimal"
      min="0"
      step="0.01"
      leftIcon={icon}
      value={String(f[k])}
      onChange={(e) => set(k, Number(e.target.value))}
      className="tabular-nums"
    />
  )

  const save = async () => {
    setSaving(true)
    try {
      await payrollApi.action("employee.pay", { ...f, id: employee.id })
      notify.success("Pago configurado")
      onSaved()
    } catch (err) {
      swalError("No se pudo guardar", errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      icon={<HandCoins />}
      title={`Pago de ${employee.fullName}`}
      description="Estas condiciones se usan al crear cada nómina."
      size="2xl"
      bodyClassName="space-y-5"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
          </Button>
        </>
      }
    >
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Sueldo</h3>
        <SegmentedFilter
          ariaLabel="Tipo de sueldo"
          value={f.salaryType}
          onChange={(v) => set("salaryType", v)}
          options={["monthly", "weekly", "daily", "hourly"].map((v) => ({ value: v, label: SALARY_TYPE_LABELS[v] }))}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {numInput(
            "salaryAmount",
            f.salaryType === "hourly" ? "Pago por hora" : f.salaryType === "daily" ? "Salario diario" : f.salaryType === "weekly" ? "Sueldo semanal" : "Sueldo mensual",
            undefined,
            <CircleDollarSign className="size-4" />
          )}
          <div className="space-y-2">
            <GroupLabel icon={Repeat}>Se paga</GroupLabel>
            <SegmentedFilter ariaLabel="Frecuencia" value={f.paymentFrequency} onChange={(v) => set("paymentFrequency", v)} options={["weekly", "biweekly", "monthly"].map((v) => ({ value: v, label: FREQUENCY_LABELS[v] }))} />
          </div>
          <div className="space-y-2">
            <GroupLabel icon={CreditCard}>Forma de pago</GroupLabel>
            <SegmentedFilter ariaLabel="Forma de pago" value={f.payMethod} onChange={(v) => set("payMethod", v)} options={["cash", "transfer", "check"].map((v) => ({ value: v, label: PAY_METHOD_LABELS[v] }))} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Equivale a <b className="text-foreground">{money(r.daily)}</b> por día y <b className="text-foreground">{money(r.hourly)}</b> por hora.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Horario</h3>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, d) => {
            const on = f.workDays.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => set("workDays", on ? f.workDays.filter((x) => x !== d) : [...f.workDays, d].sort())}
                className={cn("press h-9 w-12 rounded-lg border text-sm font-medium", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">Los días sin marcar son de descanso. Si trabaja un descanso se paga aparte.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <TimePicker label="Entrada" value={f.shiftStart ?? null} onChange={(v) => set("shiftStart", v || null)} />
          <TimePicker label="Salida" value={f.shiftEnd ?? null} onChange={(v) => set("shiftEnd", v || null)} />
          {numInput("dailyHours", "Horas por jornada", undefined, <Clock className="size-4" />)}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Pagos especiales</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {numInput("overtimeRate", "Hora extra ×", "0 = no se pagan", <Clock className="size-4" />)}
          {numInput("holidayRate", "Festivo trabajado ×", "Adicional al sueldo", <CalendarDays className="size-4" />)}
          {numInput("restDayRate", "Descanso trabajado ×", "Adicional al sueldo", <CalendarRange className="size-4" />)}
        </div>
      </section>
    </DialogComponent>
  )
}

// ── Conceptos configurables ─────────────────────────────────────────────────

function ConceptsPanel({ concepts, onChange }: { concepts: PayConcept[] | null; onChange: () => void }) {
  const [draft, setDraft] = useState({ name: "", kind: "perception", calc: "fixed", amount: "" })
  // Concepto que se está editando (null = alta de uno nuevo).
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const startEdit = (c: PayConcept) => {
    setEditingId(c.id)
    setDraft({ name: c.name, kind: c.kind, calc: c.calc, amount: String(c.amount) })
    window.requestAnimationFrame(() => document.getElementById("concept-name")?.focus())
  }
  const cancelEdit = () => {
    setEditingId(null)
    setDraft({ name: "", kind: "perception", calc: "fixed", amount: "" })
  }
  const add = async () => {
    setSaving(true)
    try {
      await payrollApi.action("concept.save", { ...draft, id: editingId ?? undefined, amount: Number(draft.amount) || 0 })
      setDraft({ name: "", kind: draft.kind, calc: "fixed", amount: "" })
      setEditingId(null)
      onChange()
    } catch (err) {
      swalError("No se pudo guardar", errorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  const remove = async (c: PayConcept) => {
    if (!(await swalConfirm("Quitar concepto", `«${c.name}» ya no se agregará a nuevas nóminas. Las existentes no cambian.`, { confirmText: "Quitar", danger: true }))) return
    await payrollApi.action("concept.delete", { id: c.id }).catch(() => undefined)
    onChange()
  }
  if (!concepts) return <Skeleton className="h-64 rounded-2xl" />
  const col = (kind: "perception" | "deduction") => {
    const list = concepts.filter((c) => c.kind === kind)
    return (
      <div className="rounded-2xl border bg-card p-4">
        <p className="font-semibold">{kind === "perception" ? "Percepciones (suman)" : "Deducciones (restan)"}</p>
        <p className="text-xs text-muted-foreground">
          {kind === "perception" ? "Bonos, ayuda de transporte, vales… El % se calcula sobre el sueldo base." : "Préstamos, adelantos, descuentos… El % se calcula sobre el total de percepciones."}
        </p>
        <ul className="mt-3 divide-y rounded-xl border">
          {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Ninguna todavía</li>}
          {list.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {c.calc === "percent" ? `${c.amount}%` : money(c.amount)}
                <Button variant="ghost" size="icon" className="size-11 desk:size-7" aria-label={`Editar ${c.name}`} onClick={() => startEdit(c)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-11 text-destructive desk:size-7" aria-label={`Quitar ${c.name}`} onClick={() => void remove(c)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border bg-muted/30 p-4 md:grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,1fr)_auto] md:items-end">
        <InputGroupField
          id="concept-name"
          label={editingId ? "Editando concepto" : "Nuevo concepto"}
          leftIcon={<Wallet className="size-4" />}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Ej. Bono de puntualidad"
        />
        <SegmentedFilter ariaLabel="Tipo" value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })} options={[{ value: "perception", label: "Suma" }, { value: "deduction", label: "Resta" }]} />
        <SegmentedFilter ariaLabel="Cálculo" value={draft.calc} onChange={(v) => setDraft({ ...draft, calc: v })} options={[{ value: "fixed", label: "$ fijo" }, { value: "percent", label: "%" }]} />
        <InputGroupField
          label={draft.calc === "percent" ? "Porcentaje" : "Importe"}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={draft.amount}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
          placeholder={draft.calc === "percent" ? "%" : "$"}
          className="tabular-nums"
        />
        <div className="flex gap-2">
          {editingId && (
            <Button variant="ghost" onClick={cancelEdit} disabled={saving}>
              Cancelar
            </Button>
          )}
          <Button onClick={() => void add()} disabled={!draft.name.trim() || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : editingId ? <Save className="size-4" /> : <Plus className="size-4" />} {editingId ? "Guardar" : "Agregar"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Los conceptos activos se agregan a cada nómina nueva; en cada persona puedes quitarlos o cambiar el importe. No se calculan ISR ni IMSS.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {col("perception")}
        {col("deduction")}
      </div>
    </div>
  )
}

// ── Nueva nómina ────────────────────────────────────────────────────────────

function NewPeriodDialog({ open, onOpenChange, employees, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; employees: PayEmployee[]; onCreated: (id: string) => void }) {
  const [frequency, setFrequency] = useState("biweekly")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [holidays, setHolidays] = useState<string[]>([])
  const [holidayDraft, setHolidayDraft] = useState<Date | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const s = suggestPeriod(frequency)
    setStart(s.start)
    setEnd(s.end)
    setHolidays([])
    setSelected(employees.filter((e) => e.paymentFrequency === frequency).map((e) => e.id))
  }, [open, frequency, employees])

  const sorted = useMemo(() => [...employees].sort((a, b) => Number(b.paymentFrequency === frequency) - Number(a.paymentFrequency === frequency)), [employees, frequency])

  const create = async () => {
    setSaving(true)
    try {
      const res = await payrollApi.action<{ ok: boolean; id: string; folio: string }>("period.create", { frequency, startDate: start, endDate: end, holidays, employeeIds: selected })
      notify.success(`Nómina ${res.folio} creada`)
      onOpenChange(false)
      onCreated(res.id)
    } catch (err) {
      swalError("No se pudo crear", errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<CalendarDays />}
      title="Nueva nómina"
      description="Se precargan los días del horario de cada persona. Después ajustas lo que haga falta."
      size="2xl"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void create()} disabled={saving || !selected.length || !start || !end}>
            {saving && <Loader2 className="size-4 animate-spin" />} Crear nómina ({selected.length})
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <GroupLabel icon={Repeat}>Frecuencia</GroupLabel>
        <SegmentedFilter ariaLabel="Frecuencia" value={frequency} onChange={setFrequency} options={["weekly", "biweekly", "monthly"].map((v) => ({ value: v, label: FREQUENCY_LABELS[v] }))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DatePicker label="Desde" value={fromIso(start)} onChange={(d) => setStart(d ? toIso(d) : "")} />
        <DatePicker label="Hasta" value={fromIso(end)} onChange={(d) => setEnd(d ? toIso(d) : "")} />
      </div>
      <div className="space-y-2">
        <GroupLabel icon={CalendarDays}>Días festivos del periodo</GroupLabel>
        <div className="flex flex-wrap items-center gap-2">
          {holidays.map((h) => (
            <span key={h} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {fmtDate(h)}
              <button type="button" aria-label="Quitar festivo" onClick={() => setHolidays(holidays.filter((x) => x !== h))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
          <div className="min-w-44 flex-1 sm:max-w-xs">
            <DatePicker
              value={holidayDraft}
              placeholder="Agregar festivo"
              disabledBefore={fromIso(start) ?? undefined}
              disabledAfter={fromIso(end) ?? undefined}
              onChange={(d) => {
                setHolidayDraft(null)
                if (d && !holidays.includes(toIso(d))) setHolidays([...holidays, toIso(d)].sort())
              }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Si un festivo cae en día laboral se marca como trabajado (pago adicional); puedes quitarlo por persona.</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <GroupLabel icon={Users}>Personal</GroupLabel>
          <button type="button" className="text-xs font-medium text-primary" onClick={() => setSelected(selected.length === employees.length ? [] : employees.map((e) => e.id))}>
            {selected.length === employees.length ? "Quitar todos" : "Seleccionar todos"}
          </button>
        </div>
        <div className="max-h-60 divide-y overflow-auto rounded-xl border">
          {sorted.map((e) => (
            <label key={e.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
              <Checkbox checked={selected.includes(e.id)} onCheckedChange={(v) => setSelected(v === true ? [...selected, e.id] : selected.filter((x) => x !== e.id))} />
              <span className="flex-1 font-medium">{e.fullName}</span>
              <span className="text-xs text-muted-foreground">
                {e.salaryType && e.salaryAmount > 0 ? `${SALARY_TYPE_LABELS[e.salaryType]} · pago ${FREQUENCY_LABELS[e.paymentFrequency]?.toLowerCase()}` : "Sin sueldo definido"}
              </span>
            </label>
          ))}
        </div>
      </div>
    </DialogComponent>
  )
}
