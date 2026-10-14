"use client"

import { matchesSearch } from "@/lib/search"
import { notify } from "@/lib/notify"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Ban, Building2, CalendarClock, CreditCard, Loader2, Lock, Receipt, Search, ShieldCheck, Users, Wallet } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { DatePicker } from "@/components/base/date-picker"
import { ymdToDate, dateToYmd } from "@/lib/date-input"
import { SwitchField } from "@/components/base/switch-field"
import { SegmentedFilter, StatusPill, type StatusTone } from "@/components/base"
import { ClearFiltersButton } from "@/components/base/clear-filters-button"
import { money } from "@/lib/money"
import { cn } from "@/lib/utils"

// Control de suscripciones (solo superAdmin): plan, capacidad, vencimiento,
// bloqueo y pagos de cada iglesia, con lo urgente primero.

interface Plan {
  id: string
  name: string
  monthlyPrice: number | string
  includedLocations: number
  includedEmployees: number
  extraLocationPrice: number | string
  extraEmployeePackSize: number
  extraEmployeePackPrice: number | string
}
interface Payment {
  id: string
  amount: number | string
  paidAt: string | null
  reference: string | null
}
interface Org {
  id: string
  name: string
  businessMode?: string
  isBlocked: boolean
  blockedReason?: string | null
  _count: { locations: number; employees: number }
  subscription: {
    id: string
    planId: string
    status: string
    periodEndsAt: string
    extraLocations: number
    extraEmployeePacks: number
    reminderDaysBefore: number
    autoBlockOnPastDue: boolean
    plan: Plan
  } | null
  subscriptionPayments: Payment[]
}

type Health = "ok" | "soon" | "overdue" | "blocked" | "none"
type Filter = "all" | Health

const HEALTH: Record<Health, { label: string; tone: StatusTone }> = {
  ok: { label: "Al corriente", tone: "success" },
  soon: { label: "Por vencer", tone: "warning" },
  overdue: { label: "Vencida", tone: "danger" },
  blocked: { label: "Bloqueada", tone: "danger" },
  none: { label: "Sin plan", tone: "neutral" },
}

const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)

function healthOf(o: Org): Health {
  if (o.isBlocked) return "blocked"
  if (!o.subscription) return "none"
  const d = daysLeft(o.subscription.periodEndsAt)
  if (d < 0 || o.subscription.status === "past_due" || o.subscription.status === "suspended") return "overdue"
  if (d <= Math.max(7, o.subscription.reminderDaysBefore)) return "soon"
  return "ok"
}

function monthlyOf(o: Org) {
  const s = o.subscription
  if (!s) return 0
  return Number(s.plan.monthlyPrice) + s.extraLocations * Number(s.plan.extraLocationPrice) + s.extraEmployeePacks * Number(s.plan.extraEmployeePackPrice)
}

function Capacity({ icon: Icon, used, limit, label }: { icon: typeof Users; used: number; limit: number | null; label: string }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0
  const full = limit != null && used >= limit
  return (
    <div className="min-w-32">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </span>
        <span className={cn("font-semibold tabular-nums", full && "text-warning-ink")}>
          {used}/{limit ?? "—"}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", full ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function SubscriptionsManager() {
  const [orgs, setOrgs] = useState<Org[] | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [filter, setFilter] = useState<Filter>("all")
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState<Org | null>(null)

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch("/api/settings/subscriptions").then((r) => r.json()), fetch("/api/settings/plans").then((r) => r.json())])
    setOrgs(a.organizations ?? [])
    setPlans(b.plans ?? [])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const withHealth = useMemo(() => (orgs ?? []).map((o) => ({ o, h: healthOf(o) })), [orgs])
  const counts = useMemo(() => {
    const c: Record<Health, number> = { ok: 0, soon: 0, overdue: 0, blocked: 0, none: 0 }
    for (const { h } of withHealth) c[h]++
    return c
  }, [withHealth])
  const mrr = withHealth.filter(({ h }) => h !== "blocked" && h !== "none").reduce((s, { o }) => s + monthlyOf(o), 0)
  const order: Health[] = ["overdue", "blocked", "soon", "none", "ok"]
  const visible = withHealth
    .filter(({ h }) => filter === "all" || h === filter)
    .filter(({ o }) => !q || matchesSearch(o.name, q))
    .sort((a, b) => order.indexOf(a.h) - order.indexOf(b.h) || a.o.name.localeCompare(b.o.name))

  return (
    <div className="space-y-5">
      <PageHeader icon={<ShieldCheck className="size-5" />} title="Control de suscripciones" description="Plan, capacidad, vencimiento, bloqueo y pagos de cada iglesia. Lo urgente aparece primero." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Ingreso mensual activo", value: money(mrr), icon: Wallet, tone: "text-primary" },
          { label: "Al corriente", value: counts.ok, icon: ShieldCheck, tone: "text-success" },
          { label: "Por vencer", value: counts.soon, icon: CalendarClock, tone: "text-warning-ink" },
          { label: "Vencidas o bloqueadas", value: counts.overdue + counts.blocked, icon: AlertTriangle, tone: "text-destructive" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-4 shadow-e1">
            <k.icon className={cn("size-5", k.tone)} />
            <p className="mt-2 font-heading text-2xl font-semibold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter
          ariaLabel="Estado"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Todas", count: orgs?.length ?? 0 },
            { value: "overdue", label: "Vencidas", count: counts.overdue, countTone: counts.overdue ? "danger" : undefined },
            { value: "soon", label: "Por vencer", count: counts.soon, countTone: counts.soon ? "warning" : undefined },
            { value: "blocked", label: "Bloqueadas", count: counts.blocked, countTone: counts.blocked ? "danger" : undefined },
            { value: "none", label: "Sin plan", count: counts.none },
          ]}
        />
        <InputGroupField placeholder="Buscar iglesia…" leftIcon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
        <ClearFiltersButton active={Boolean(q) || filter !== "all"} onClear={() => { setQ(""); setFilter("all") }} />
      </div>

      {!orgs ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">Ninguna iglesia en esta vista.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map(({ o, h }) => {
            const s = o.subscription
            const p = s?.plan
            const d = s ? daysLeft(s.periodEndsAt) : null
            const last = o.subscriptionPayments[0]
            return (
              <div key={o.id} className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-e1", (h === "overdue" || h === "blocked") && "border-destructive/40")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{o.name}</p>
                    <p className="text-sm text-muted-foreground">{p ? `${p.name} · ${money(monthlyOf(o))}/mes` : "Sin plan asignado"}</p>
                  </div>
                  <StatusPill tone={HEALTH[h].tone}>{HEALTH[h].label}</StatusPill>
                </div>
                {s && (
                  <p className={cn("flex items-center gap-1.5 text-sm", d! < 0 ? "text-destructive" : d! <= 7 ? "text-warning-ink" : "text-muted-foreground")}>
                    <CalendarClock className="size-4" />
                    {d! < 0 ? `Venció hace ${-d!} días` : d === 0 ? "Vence hoy" : `Vence en ${d} días`} · {new Date(s.periodEndsAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
                {o.isBlocked && o.blockedReason && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                    <Lock className="size-3.5" /> {o.blockedReason}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Capacity icon={Building2} label="Sedes" used={o._count.locations} limit={p ? p.includedLocations + (s?.extraLocations ?? 0) : null} />
                  <Capacity icon={Users} label="Empleados" used={o._count.employees} limit={p ? p.includedEmployees + (s?.extraEmployeePacks ?? 0) * p.extraEmployeePackSize : null} />
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Receipt className="size-3.5" />
                    {last ? `Último pago ${money(Number(last.amount))} · ${last.paidAt ? new Date(last.paidAt).toLocaleDateString("es-MX") : "pendiente"}` : "Sin pagos registrados"}
                  </span>
                  <Button size="sm" variant={h === "ok" ? "outline" : "default"} onClick={() => setSelected(o)}>
                    Administrar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && <SubscriptionDialog org={selected} plans={plans} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); void load() }} />}
    </div>
  )
}

function SubscriptionDialog({ org, plans, onClose, onSaved }: { org: Org; plans: Plan[]; onClose: () => void; onSaved: () => void }) {
  const s = org.subscription
  const [form, setForm] = useState({
    planId: s?.planId ?? plans[0]?.id ?? "",
    status: s?.status ?? "active",
    periodEndsAt: (s?.periodEndsAt ?? new Date(Date.now() + 30 * 864e5).toISOString()).slice(0, 10),
    extraLocations: String(s?.extraLocations ?? 0),
    extraEmployeePacks: String(s?.extraEmployeePacks ?? 0),
    reminderDaysBefore: String(s?.reminderDaysBefore ?? 5),
    autoBlockOnPastDue: s?.autoBlockOnPastDue ?? true,
    blocked: org.isBlocked,
    blockedReason: org.blockedReason ?? "",
  })
  const [payment, setPayment] = useState({ amount: "", reference: "" })
  const [busy, setBusy] = useState(false)
  const plan = plans.find((p) => p.id === form.planId)
  const total = plan ? Number(plan.monthlyPrice) + Number(form.extraLocations || 0) * Number(plan.extraLocationPrice) + Number(form.extraEmployeePacks || 0) * Number(plan.extraEmployeePackPrice) : 0

  const post = async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const r = await fetch("/api/settings/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) {
        notify.error(j.error ?? "No se pudo guardar")
        return false
      }
      return true
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    if (await post({ organizationId: org.id, subscriptionId: s?.id ?? null, ...form })) {
      notify.success("Suscripción actualizada")
      onSaved()
    }
  }
  const pay = async () => {
    if (!(Number(payment.amount) > 0)) {
      notify.error("Captura un importe válido")
      return
    }
    if (await post({ action: "payment", organizationId: org.id, subscriptionId: s?.id ?? null, planId: form.planId, amount: Number(payment.amount), reference: payment.reference })) {
      notify.success("Pago registrado y iglesia desbloqueada")
      onSaved()
    }
  }

  return (
    <DialogComponent
      open
      onOpenChange={(v) => !v && onClose()}
      title={org.name}
      description="Los límites consideran el plan base más los adicionales mensuales."
      icon={<CreditCard className="size-5" />}
      size="3xl"
      bodyClassName="space-y-5"
      footer={
        <>
          <span className="mr-auto text-sm text-muted-foreground">
            Mensualidad: <b className="text-foreground tabular-nums">{money(total)}</b>
          </span>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Guardar cambios
          </Button>
        </>
      }
    >
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Plan y vigencia</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setForm({ ...form, planId: p.id })}
              aria-pressed={form.planId === p.id}
              className={cn("press rounded-xl border p-3 text-left", form.planId === p.id ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "hover:bg-muted/60")}
            >
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm tabular-nums">{money(Number(p.monthlyPrice))}/mes</p>
              <p className="text-xs text-muted-foreground">
                {p.includedLocations} sedes · {p.includedEmployees} empleados
              </p>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <DatePicker label="Vence el" value={ymdToDate(form.periodEndsAt)} onChange={(d) => setForm({ ...form, periodEndsAt: dateToYmd(d) })} clearable />
          <FormCombobox
            id="subscription-status"
            label="Estado"
            value={form.status}
            onChange={(status) => setForm({ ...form, status })}
            options={[
              { value: "active", label: "Activa" },
              { value: "past_due", label: "Vencida (en gracia)" },
              { value: "suspended", label: "Suspendida" },
            ]}
            clearable={false}
            searchable={false}
          />
          <InputGroupField label="Recordar antes (días)" type="number" leftIcon={<CalendarClock className="size-4" />} value={form.reminderDaysBefore} onChange={(e) => setForm({ ...form, reminderDaysBefore: e.target.value })} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Capacidad adicional</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <InputGroupField
            label={`Sedes extra${plan ? ` (${money(Number(plan.extraLocationPrice))} c/u)` : ""}`}
            type="number"
            leftIcon={<Building2 className="size-4" />}
            value={form.extraLocations}
            onChange={(e) => setForm({ ...form, extraLocations: e.target.value })}
          />
          <InputGroupField
            label={`Paquetes de empleados${plan ? ` (${plan.extraEmployeePackSize} por ${money(Number(plan.extraEmployeePackPrice))})` : ""}`}
            type="number"
            leftIcon={<Users className="size-4" />}
            value={form.extraEmployeePacks}
            onChange={(e) => setForm({ ...form, extraEmployeePacks: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Acceso</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <SwitchField id="subscription-auto-block" label="Bloqueo automático al vencer" description="Al pasar el vencimiento sin pago" checked={form.autoBlockOnPastDue} onCheckedChange={(v) => setForm({ ...form, autoBlockOnPastDue: v })} />
          <SwitchField id="subscription-blocked" label="Iglesia bloqueada" description="Nadie de la iglesia puede entrar" checked={form.blocked} onCheckedChange={(v) => setForm({ ...form, blocked: v })} />
        </div>
        {form.blocked && <InputGroupField label="Motivo del bloqueo (lo ve la iglesia)" leftIcon={<Ban className="size-4" />} value={form.blockedReason} onChange={(e) => setForm({ ...form, blockedReason: e.target.value })} />}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-semibold">Registrar pago</p>
          <InputGroupField label="Importe" type="number" leftIcon={<Wallet className="size-4" />} value={payment.amount} placeholder={String(total)} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
          <InputGroupField label="Referencia" leftIcon={<Receipt className="size-4" />} value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
          <Button variant="outline" className="w-full" onClick={() => void pay()} disabled={busy}>
            Registrar pago y desbloquear
          </Button>
        </div>
        <div className="space-y-2 rounded-xl border p-4">
          <p className="text-sm font-semibold">Historial de pagos</p>
          {org.subscriptionPayments.length ? (
            <ul className="max-h-56 divide-y overflow-auto text-sm">
              {org.subscriptionPayments.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2">
                  <span className="text-muted-foreground">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString("es-MX") : "Pendiente"}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <b className="tabular-nums">{money(Number(p.amount))}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No hay pagos registrados.</p>
          )}
        </div>
      </section>
    </DialogComponent>
  )
}
