"use client"

import { TextareaField } from "@/components/base/textarea-field"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  BadgeDollarSign,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Landmark,
  Download,
  HandCoins,
  Loader2,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CampaignsTab } from "@/components/finance/campaigns-admin"
import { DialogComponent } from "@/components/ui/dialog"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, INCOME_KIND_LABEL, INCOME_SOURCE_LABEL } from "@/lib/finance/rules"
import type { DonationDto, ExpenseRowDto, FinanceSummaryDto, IncomeDto } from "@/lib/finance/server"
import { cn } from "@/lib/utils"
import { GatewaySettings } from "./gateway-settings"
import { BankReconciliation } from "./bank-reconciliation"

// Administración y finanzas: resumen del mes, ingresos y cortes de reunión, gastos
// (incluye los de eventos y vehículos), donativos por confirmar y nómina simple.

export const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const ymdOfLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
const METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "other", label: "Otro" },
]

function downloadCsv(name: string, head: string[], lines: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const csv = "﻿" + [head, ...lines].map((l) => l.map(esc).join(",")).join("\r\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function FinanceAdmin({ canManage, canPayroll, canVehicles }: { canManage: boolean; canPayroll: boolean; canVehicles: boolean }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])
  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number)
    setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7))
  }
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("es-MX", { month: "long", year: "numeric" })

  return (
    <Tabs defaultValue="summary">
      <TabsList>
        <TabsTrigger value="summary">
          <BadgeDollarSign className="size-4" /> Resumen
        </TabsTrigger>
        <TabsTrigger value="income">
          <TrendingUp className="size-4" /> Ingresos
        </TabsTrigger>
        <TabsTrigger value="expenses">
          <TrendingDown className="size-4" /> Gastos
        </TabsTrigger>
        <TabsTrigger value="donations">
          <HandCoins className="size-4" /> Donativos
        </TabsTrigger>
        <TabsTrigger value="campaigns">Campañas</TabsTrigger>
        <TabsTrigger value="bank">
          <Landmark className="size-4" /> Conciliación
        </TabsTrigger>
        {canPayroll && (
          <TabsTrigger value="payroll">
            <Users className="size-4" /> Nómina
          </TabsTrigger>
        )}
      </TabsList>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="outline" aria-label="Mes anterior" onClick={() => shift(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-0 flex-1 text-center font-heading text-sm font-semibold first-letter:uppercase">{monthLabel}</p>
        <Button size="icon-sm" variant="outline" aria-label="Mes siguiente" onClick={() => shift(1)}>
          <ChevronRight className="size-4" />
        </Button>
        {canVehicles && (
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/vehicles">
              <Car className="size-4" /> Vehículos
            </Link>
          </Button>
        )}
      </div>

      <TabsContent value="summary">
        <SummaryTab month={month} tick={tick} />
      </TabsContent>
      <TabsContent value="income">
        <IncomeTab month={month} tick={tick} canManage={canManage} onChanged={refresh} />
      </TabsContent>
      <TabsContent value="expenses">
        <ExpensesTab month={month} tick={tick} canManage={canManage} onChanged={refresh} />
      </TabsContent>
      <TabsContent value="donations">
        <DonationsTab canManage={canManage} onChanged={refresh} />
      </TabsContent>
      <TabsContent value="campaigns">
        <CampaignsTab canManage={canManage} onChanged={refresh} />
      </TabsContent>
      <TabsContent value="bank">
        <BankReconciliation canManage={canManage} />
      </TabsContent>
      {canPayroll && (
        <TabsContent value="payroll">
          <PayrollTab />
        </TabsContent>
      )}
    </Tabs>
  )
}

// ── Resumen ───────────────────────────────────────────────────────────────────

function Bars({ rows, labels, total, tone }: { rows: { key: string; total: number }[]; labels: Record<string, string>; total: number; tone: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin movimientos.</p>
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.total / total) * 100) : 0
        return (
          <li key={r.key} className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{labels[r.key] ?? r.key}</span>
              <span className="tabular-nums">{money(r.total)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function SummaryTab({ month, tick }: { month: string; tick: number }) {
  const [s, setS] = useState<FinanceSummaryDto | null>(null)
  useEffect(() => {
    let alive = true
    setS(null)
    apiJson<{ summary: FinanceSummaryDto }>(`/api/finance/summary?month=${month}`)
      .then((d) => {
        if (alive) setS(d.summary)
      })
      .catch((e) => {
        if (alive) swalError("No se pudo cargar el resumen", errorMessage(e))
      })
    return () => {
      alive = false
    }
  }, [month, tick])
  if (!s) return <Skeleton className="mt-3 h-48 w-full" />
  const a = s.alerts
  return (
    <div className="space-y-4 pt-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border bg-card p-3">
          <p className="font-heading text-xl font-semibold tabular-nums text-success-ink">{money(s.income.total)}</p>
          <p className="text-xs text-muted-foreground">Ingresos</p>
        </div>
        <div className="rounded-2xl border bg-card p-3">
          <p className="font-heading text-xl font-semibold tabular-nums">{money(s.expenses.total)}</p>
          <p className="text-xs text-muted-foreground">Gastos</p>
        </div>
        <div className="rounded-2xl border bg-card p-3">
          <p className={cn("font-heading text-xl font-semibold tabular-nums", s.balance < 0 && "text-destructive")}>{money(s.balance)}</p>
          <p className="text-xs text-muted-foreground">Saldo del mes</p>
        </div>
      </div>

      {(a.pendingDonations > 0 || a.draftPayroll > 0 || a.vehicleAlerts > 0) && (
        <ul className="flex flex-wrap gap-2">
          {a.pendingDonations > 0 && (
            <li>
              <StatusPill tone="warning">
                <HandCoins className="size-3.5" /> {a.pendingDonations} donativo(s) por confirmar
              </StatusPill>
            </li>
          )}
          {a.draftPayroll > 0 && (
            <li>
              <StatusPill tone="info">
                <Users className="size-3.5" /> {a.draftPayroll} nómina(s) en borrador
              </StatusPill>
            </li>
          )}
          {a.vehicleAlerts > 0 && (
            <li>
              <StatusPill tone="danger">
                <AlertTriangle className="size-3.5" /> {a.vehicleAlerts} alerta(s) de vehículos
              </StatusPill>
            </li>
          )}
        </ul>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Ingresos por tipo</h3>
          <Bars rows={s.income.byKind} labels={INCOME_KIND_LABEL} total={s.income.total} tone="bg-success" />
          <h3 className="pt-2 text-sm font-semibold">Por origen</h3>
          <Bars rows={s.income.bySource} labels={INCOME_SOURCE_LABEL} total={s.income.total} tone="bg-primary" />
        </section>
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Gastos por categoría</h3>
          <Bars rows={s.expenses.byCategory} labels={EXPENSE_CATEGORY_LABEL} total={s.expenses.total} tone="bg-destructive/70" />
        </section>
      </div>

      {s.cuts.length > 0 && (
        <section className="space-y-2 rounded-2xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Cortes de reunión</h3>
          <ul className="divide-y">
            {s.cuts.map((c) => (
              <li key={c.gatheringId} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {fmtDay(c.date)} · {c.label}
                </span>
                <span className="font-semibold tabular-nums">{money(c.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Ingresos y cortes ─────────────────────────────────────────────────────────

function IncomeTab({ month, tick, canManage, onChanged }: { month: string; tick: number; canManage: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<IncomeDto[] | null>(null)
  const [cutOpen, setCutOpen] = useState(false)
  const [incomeOpen, setIncomeOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setRows(null)
    apiJson<{ incomes: IncomeDto[] }>(`/api/finance/incomes?month=${month}`)
      .then((d) => {
        if (alive) setRows(d.incomes)
      })
      .catch((e) => {
        if (alive) {
          setRows([])
          swalError("No se pudieron cargar los ingresos", errorMessage(e))
        }
      })
    return () => {
      alive = false
    }
  }, [month, tick])

  const remove = async (i: IncomeDto) => {
    const yes = await swalConfirm("¿Eliminar este ingreso?", `${INCOME_KIND_LABEL[i.kind]} · ${money(i.amount)}`, { confirmText: "Eliminar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/finance/incomes/${i.id}`, { method: "DELETE" })
      onChanged()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!rows || rows.length === 0}
          onClick={() => rows && downloadCsv(`ingresos-${month}.csv`, ["Fecha", "Tipo", "Origen", "Monto", "Reunión", "Persona", "Concepto", "Referencia"], rows.map((r) => [r.receivedAt, INCOME_KIND_LABEL[r.kind], INCOME_SOURCE_LABEL[r.source], r.amount, r.gatheringLabel ?? "", r.memberName ?? "", r.concept ?? "", r.reference ?? ""]))}
        >
          <Download className="size-4" />
          CSV
        </Button>
        {canManage && (
          <span className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setIncomeOpen(true)}>
              <Plus className="size-4" />
              Ingreso
            </Button>
            <Button onClick={() => setCutOpen(true)}>
              <CircleDollarSign className="size-4" />
              Corte de reunión
            </Button>
          </span>
        )}
      </div>
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Sin ingresos este mes" description="Registra el corte de cada reunión con sus diezmos y ofrendas, u otros ingresos." />
      ) : (
        <ul className="space-y-2">
          {rows.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {INCOME_KIND_LABEL[i.kind]}
                  {i.concept ? ` · ${i.concept}` : ""}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[fmtDay(i.receivedAt), INCOME_SOURCE_LABEL[i.source], i.gatheringLabel, i.memberName, i.reference].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="font-heading text-base font-semibold tabular-nums">{money(i.amount)}</span>
              {canManage && (
                <Button size="icon-sm" variant="ghost" aria-label="Eliminar ingreso" onClick={() => void remove(i)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <CutDialog open={cutOpen} onClose={() => setCutOpen(false)} onDone={onChanged} />
      <IncomeDialog open={incomeOpen} onClose={() => setIncomeOpen(false)} onDone={onChanged} />
    </div>
  )
}

function CutDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [gatherings, setGatherings] = useState<{ id: string; date: string; label: string; hasCut: boolean }[]>([])
  const [gatheringId, setGatheringId] = useState("")
  const [date, setDate] = useState<Date | null>(null)
  const [tithes, setTithes] = useState("")
  const [offerings, setOfferings] = useState("")
  const [others, setOthers] = useState("")
  const [source, setSource] = useState("cash_cut")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setGatheringId("")
    setDate(new Date())
    setTithes("")
    setOfferings("")
    setOthers("")
    setSource("cash_cut")
    apiJson<{ gatherings: typeof gatherings }>("/api/finance/gatherings")
      .then((d) => setGatherings(d.gatherings))
      .catch(() => setGatherings([]))
  }, [open])

  const total = (Number(tithes) || 0) + (Number(offerings) || 0) + (Number(others) || 0)
  const save = async () => {
    setSaving(true)
    try {
      await apiJson("/api/finance/incomes/cut", {
        method: "POST",
        body: JSON.stringify({ gatheringId: gatheringId || null, date: date ? ymdOfLocal(date) : "", tithes, offerings, others, source }),
      })
      notify.success("Corte registrado")
      onClose()
      onDone()
    } catch (e) {
      swalError("No se pudo registrar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Corte de reunión"
      description="Diezmos y ofrendas contados al terminar la reunión."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || total <= 0 || !date}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Registrar {total > 0 ? money(total) : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormCombobox
          label="Reunión"
          options={gatherings.map((g) => ({ value: g.id, label: `${fmtDay(g.date)} · ${g.label}${g.hasCut ? " (ya tiene corte)" : ""}`, disabled: g.hasCut }))}
          value={gatheringId}
          onChange={(v) => {
            setGatheringId(v)
            const g = gatherings.find((x) => x.id === v)
            if (g) setDate(new Date(`${g.date}T12:00:00`))
          }}
          onClear={() => setGatheringId("")}
          placeholder="Sin reunión (corte suelto)"
        />
        <DatePicker label="Fecha del corte" required value={date} onChange={setDate} />
        <div className="grid gap-3 sm:grid-cols-3">
          <InputGroupField label="Diezmos" inputMode="decimal" value={tithes} onChange={(e) => setTithes(e.target.value)} />
          <InputGroupField label="Ofrendas" inputMode="decimal" value={offerings} onChange={(e) => setOfferings(e.target.value)} />
          <InputGroupField label="Otros" inputMode="decimal" value={others} onChange={(e) => setOthers(e.target.value)} />
        </div>
        <FormCombobox
          label="Cómo se recibió"
          options={[
            { value: "cash_cut", label: "Efectivo (corte manual)" },
            { value: "transfer", label: "Transferencias" },
          ]}
          value={source}
          onChange={setSource}
          clearable={false}
        />
      </div>
    </DialogComponent>
  )
}

function IncomeDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState("donation")
  const [source, setSource] = useState("transfer")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState<Date | null>(null)
  const [concept, setConcept] = useState("")
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    setKind("donation")
    setSource("transfer")
    setAmount("")
    setDate(new Date())
    setConcept("")
    setReference("")
  }, [open])

  const save = async () => {
    setSaving(true)
    try {
      await apiJson("/api/finance/incomes", { method: "POST", body: JSON.stringify({ kind, source, amount, receivedAt: date ? ymdOfLocal(date) : "", concept, reference }) })
      notify.success("Ingreso registrado")
      onClose()
      onDone()
    } catch (e) {
      swalError("No se pudo registrar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Registrar ingreso"
      description="Diezmos, ofrendas y otros ingresos de la iglesia."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !amount || !date}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Registrar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormCombobox label="Tipo" options={Object.entries(INCOME_KIND_LABEL).map(([value, label]) => ({ value, label }))} value={kind} onChange={setKind} clearable={false} />
        <FormCombobox label="Origen" options={Object.entries(INCOME_SOURCE_LABEL).map(([value, label]) => ({ value, label }))} value={source} onChange={setSource} clearable={false} />
        <InputGroupField label="Monto" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <DatePicker label="Fecha" required value={date} onChange={setDate} />
        <div className="sm:col-span-2">
          <InputGroupField label="Concepto" value={concept} maxLength={150} onChange={(e) => setConcept(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <InputGroupField label="Referencia o folio" value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} />
        </div>
      </div>
    </DialogComponent>
  )
}

// ── Gastos ────────────────────────────────────────────────────────────────────

function ExpensesTab({ month, tick, canManage, onChanged }: { month: string; tick: number; canManage: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<ExpenseRowDto[] | null>(null)
  const [editing, setEditing] = useState<ExpenseRowDto | "new" | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    apiJson<{ expenses: ExpenseRowDto[] }>(`/api/finance/expenses?month=${month}`)
      .then((d) => {
        if (alive) setRows(d.expenses)
      })
      .catch((e) => {
        if (alive) {
          setRows([])
          swalError("No se pudieron cargar los gastos", errorMessage(e))
        }
      })
    return () => {
      alive = false
    }
  }, [month, tick])

  const total = useMemo(() => (rows ?? []).reduce((s, r) => s + r.amount, 0), [rows])
  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Incluye los gastos de eventos, vehículos y nómina. Total <span className="font-semibold text-foreground">{money(total)}</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!rows || rows.length === 0}
          onClick={() => rows && downloadCsv(`gastos-${month}.csv`, ["Fecha", "Categoría", "Concepto", "Monto", "Proveedor", "Evento", "Vehículo"], rows.map((r) => [r.spentAt, EXPENSE_CATEGORY_LABEL[r.category] ?? r.category, r.concept, r.amount, r.vendor ?? "", r.eventName ?? "", r.vehicleName ?? ""]))}
        >
          <Download className="size-4" />
          CSV
        </Button>
        {canManage && (
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Gasto
          </Button>
        )}
      </div>
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin gastos este mes" description="Registra renta, servicios, material y demás gastos de la iglesia." />
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                disabled={!canManage || e.isPayroll}
                onClick={() => setEditing(e)}
                className="press flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left enabled:hover:border-primary/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.concept}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[fmtDay(e.spentAt), EXPENSE_CATEGORY_LABEL[e.category] ?? e.category, e.eventName ? `Evento: ${e.eventName}` : null, e.vehicleName ? `Vehículo: ${e.vehicleName}` : null, e.vendor].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="font-heading text-base font-semibold tabular-nums">{money(e.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ExpenseDialog expense={editing} onClose={() => setEditing(null)} onDone={onChanged} />
    </div>
  )
}

function ExpenseDialog({ expense, onClose, onDone }: { expense: ExpenseRowDto | "new" | null; onClose: () => void; onDone: () => void }) {
  const current = expense && expense !== "new" ? expense : null
  const [concept, setConcept] = useState("")
  const [category, setCategory] = useState("otro")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState<Date | null>(null)
  const [vendor, setVendor] = useState("")
  const [method, setMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (expense === null) return
    setConcept(current?.concept ?? "")
    setCategory(current?.category ?? "otro")
    setAmount(current ? String(current.amount) : "")
    setDate(current ? new Date(`${current.spentAt}T12:00:00`) : new Date())
    setVendor(current?.vendor ?? "")
    setMethod(current?.paymentMethod ?? "")
    setNotes(current?.notes ?? "")
  }, [expense, current])

  const save = async () => {
    setSaving(true)
    try {
      await apiJson("/api/finance/expenses", {
        method: "POST",
        body: JSON.stringify({ id: current?.id, concept, category, amount, spentAt: date ? ymdOfLocal(date) : "", vendor, paymentMethod: method || null, notes }),
      })
      notify.success("Gasto guardado")
      onClose()
      onDone()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!current) return
    const yes = await swalConfirm("¿Eliminar este gasto?", undefined, { confirmText: "Eliminar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/finance/expenses?id=${current.id}`, { method: "DELETE" })
      onClose()
      onDone()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }

  return (
    <DialogComponent
      open={expense !== null}
      onOpenChange={(o) => !o && onClose()}
      title={current ? "Editar gasto" : "Registrar gasto"}
      description="Todo gasto queda en el resumen del mes; los de nómina, eventos y vehículos nacen de su módulo."
      footer={
        <>
          {current && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => void remove()} disabled={saving}>
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !concept.trim() || !amount || !date}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <InputGroupField label="Concepto" required value={concept} maxLength={150} onChange={(e) => setConcept(e.target.value)} />
        </div>
        <FormCombobox label="Categoría" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABEL[c] }))} value={category} onChange={setCategory} clearable={false} />
        <InputGroupField label="Monto" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <DatePicker label="Fecha" required value={date} onChange={setDate} />
        <FormCombobox label="Forma de pago" options={METHODS} value={method} onChange={setMethod} onClear={() => setMethod("")} placeholder="—" />
        <div className="sm:col-span-2">
          <InputGroupField label="Proveedor" value={vendor} maxLength={150} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <TextareaField id="fe-notes" label="Notas" containerClassName="sm:col-span-2" rows={2} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </DialogComponent>
  )
}

// ── Donativos ─────────────────────────────────────────────────────────────────

function DonationsTab({ canManage, onChanged }: { canManage: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<DonationDto[] | null>(null)
  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ donations: DonationDto[] }>("/api/finance/donations")
      setRows(d.donations)
    } catch (e) {
      setRows([])
      swalError("No se pudieron cargar los donativos", errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const decide = async (id: string, decision: "confirm" | "reject") => {
    try {
      await apiJson(`/api/finance/donations/${id}`, { method: "PATCH", body: JSON.stringify({ decision }) })
      notify.success(decision === "confirm" ? "Donativo confirmado y registrado como ingreso" : "Aviso rechazado")
      await load()
      onChanged()
    } catch (e) {
      swalError("No se pudo registrar", errorMessage(e))
    }
  }

  if (rows === null) return <Skeleton className="mt-3 h-40 w-full" />
  const pending = rows.filter((r) => r.status === "pending")
  const done = rows.filter((r) => r.status !== "pending")
  return (
    <div className="space-y-4 pt-3">
      {canManage && <GatewaySettings />}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Por confirmar ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay avisos de transferencia pendientes.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block truncate text-sm font-medium">{d.donor}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {INCOME_KIND_LABEL[d.kind]} · {new Date(d.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    {d.reference ? ` · ref. ${d.reference}` : ""}
                    {d.notes ? ` · ${d.notes}` : ""}
                  </span>
                </span>
                <span className="font-heading text-base font-semibold tabular-nums">{money(d.amount)}</span>
                {canManage && d.provider && (
                  <span className="flex items-center gap-1">
                    <StatusPill tone="warning" dot={false}>
                      Esperando el pago en línea
                    </StatusPill>
                    <Button size="icon-sm" variant="ghost" aria-label="Cancelar cobro" onClick={() => void decide(d.id, "reject")}>
                      <X className="size-4" />
                    </Button>
                  </span>
                )}
                {canManage && !d.provider && (
                  <span className="flex gap-1">
                    <Button size="sm" onClick={() => void decide(d.id, "confirm")}>
                      <Check className="size-4" /> Confirmar
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Rechazar" onClick={() => void decide(d.id, "reject")}>
                      <X className="size-4" />
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {done.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Historial</h3>
          <ul className="divide-y rounded-2xl border bg-card">
            {done.map((d) => (
              <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {d.donor} · {INCOME_KIND_LABEL[d.kind]}
                </span>
                <span className="tabular-nums">{money(d.amount)}</span>
                <StatusPill tone={d.status === "paid" ? "success" : "neutral"}>{d.status === "paid" ? "Confirmado" : d.status === "failed" ? "Rechazado" : "Reembolsado"}</StatusPill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Nómina ────────────────────────────────────────────────────────────────────

/** La nómina tiene su propio módulo (/admin/payroll); aquí solo se enlaza y se ve el estado. */
function PayrollTab() {
  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Nómina del personal</p>
          <p className="text-sm text-muted-foreground">Periodos, horas extra, festivos, percepciones, deducciones y recibos. Al pagar una nómina se registra su gasto aquí.</p>
        </div>
        <Button asChild>
          <Link href="/admin/payroll">Abrir nómina</Link>
        </Button>
      </div>
    </div>
  )
}
