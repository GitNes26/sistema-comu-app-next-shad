"use client"

import { useCallback, useEffect, useId, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import {
  AlarmClock,
  ArrowLeft,
  Ban,
  Check,
  HeartHandshake,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { DatePicker } from "@/components/base/date-picker"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { AddressField } from "@/components/base/address-field"
import { SwitchField } from "@/components/base/switch-field"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { StatusPill, type StatusTone } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { ApiError, apiJson, errorMessage } from "@/lib/ministries/client"
import {
  CASE_STATUS_LABEL,
  CHANNELS,
  CHANNEL_LABEL,
  INTERESTS,
  INTEREST_LABEL,
  OUTCOMES,
  OUTCOME_LABEL,
  type CaseStatusKey,
  type OutcomeKey,
} from "@/lib/consolidation/rules"
import type { CaseDetailDto, CaseDto, ConsolidationWorkspaceDto, NearbyCellDto, NearbyCellsDto } from "@/lib/consolidation/server"
import type { WorkspaceDto } from "@/lib/ministries/server"
import { cn } from "@/lib/utils"

// Espacio de Consolidación: registro de quienes llegan por primera vez y su
// seguimiento hasta canalizarlos a una célula u otra reunión. Lo comparten el panel
// y «Mi espacio»; el servidor decide qué ve y qué puede hacer cada quien.

const STATUS_TONE: Record<CaseStatusKey, StatusTone> = { received: "info", following: "warning", channeled: "success", closed: "neutral" }
const GENDER_OPTIONS = [
  { value: "female", label: "Mujer" },
  { value: "male", label: "Hombre" },
]
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

type Filter = "all" | CaseStatusKey | "overdue"

export function ConsolidationWorkspace({ ministryId, backHref }: { ministryId: string; backHref: string }) {
  const [ws, setWs] = useState<WorkspaceDto | null>(null)
  const [data, setData] = useState<ConsolidationWorkspaceDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [registerOpen, setRegisterOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ workspace: WorkspaceDto }>(`/api/ministries/${ministryId}`)
      .then((d) => setWs(d.workspace))
      .catch((e) => setError(errorMessage(e, "No se pudo abrir Consolidación")))
  }, [ministryId])

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ workspace: ConsolidationWorkspaceDto }>(`/api/consolidation/${ministryId}/cases?q=${encodeURIComponent(q)}`)
      setData(d.workspace)
    } catch (e) {
      setError(errorMessage(e, "No se pudo cargar Consolidación"))
    }
  }, [ministryId, q])

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir Consolidación" description={error} />
      </div>
    )
  }
  if (!ws || !data) return <Skeleton className="h-64 w-full" />

  const cases = data.cases.filter((c) => (filter === "all" ? true : filter === "overdue" ? c.overdue : c.status === filter))
  const s = data.summary

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`${backHref}/${ministryId}`}>
          <ArrowLeft className="size-4" />
          {ws.ministry.name}
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <HeartHandshake className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Consolidación</h1>
          <p className="text-sm text-muted-foreground">
            {data.access.scope === "all" ? "Personas nuevas y su seguimiento." : "Las personas que tienes asignadas."}
          </p>
        </div>
        {data.access.canRegister && (
          <Button onClick={() => setRegisterOpen(true)}>
            <UserPlus className="size-4" />
            Registrar persona
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Recibidos", value: s.received, tone: "text-info-ink" },
          { label: "En seguimiento", value: s.following, tone: "text-warning-ink" },
          { label: "Canalizados", value: s.channeled, tone: "text-success-ink" },
          { label: "Sin asignar", value: s.unassigned, tone: "" },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl border bg-card p-3">
            <p className={cn("font-heading text-2xl font-semibold tabular-nums", t.tone)}>{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <Input
            type="search"
            inputMode="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            aria-label="Buscar persona"
            className="pl-9 md:pl-9 desk:pl-9"
          />
        </div>
      </div>
      <SegmentedFilter<Filter>
        ariaLabel="Filtrar por estado"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Todos", count: data.cases.length },
          { value: "received", label: "Recibidos", count: s.received },
          { value: "following", label: "En seguimiento", count: s.following },
          { value: "overdue", label: "Vencidos", count: s.overdue, countTone: "danger" },
          { value: "channeled", label: "Canalizados", count: s.channeled },
          { value: "closed", label: "Cerrados", count: s.closed },
        ]}
      />

      {cases.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title={data.cases.length === 0 ? "Aún no hay personas registradas" : "Sin resultados"}
          description={
            data.cases.length === 0
              ? data.access.canRegister
                ? "Registra a quien llegó por primera vez para darle seguimiento."
                : "Cuando te asignen personas aparecerán aquí."
              : "Prueba con otro filtro o búsqueda."
          }
        />
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {cases.map((c) => (
            <CaseRow key={c.id} c={c} onOpen={() => setOpenId(c.id)} />
          ))}
        </ul>
      )}

      <RegisterDialog
        ministryId={ministryId}
        open={registerOpen}
        canManage={data.access.canManage}
        followers={data.followers}
        onClose={() => setRegisterOpen(false)}
        onDone={load}
      />
      <CaseDialog caseId={openId} followers={data.followers} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  )
}

function CaseRow({ c, onOpen }: { c: CaseDto; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn("press flex w-full flex-col gap-1.5 rounded-2xl border bg-card p-3 text-left hover:border-primary/40", c.mine && "ring-1 ring-primary/30")}
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.fullName}</span>
          {c.overdue && (
            <StatusPill tone="danger" dot={false}>
              <AlarmClock className="size-3" /> Vencido
            </StatusPill>
          )}
          <StatusPill tone={STATUS_TONE[c.status]}>{CASE_STATUS_LABEL[c.status]}</StatusPill>
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>Visitó el {fmtDate(c.visitedAt)}</span>
          {c.serviceLabel && <span>{c.serviceLabel}</span>}
          {c.acceptedChrist && <span className="text-success-ink">Aceptó a Cristo</span>}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{c.assignedName ? `Lo atiende ${c.assignedName}` : "Sin asignar"}</span>
          <span>{c.contactCount === 0 ? "Sin contactos" : `${c.contactCount} contacto${c.contactCount === 1 ? "" : "s"}`}</span>
          {c.status === "channeled" && c.outcome && <span>{OUTCOME_LABEL[c.outcome]}</span>}
        </span>
      </button>
    </li>
  )
}

// ── Registro ──────────────────────────────────────────────────────────────────

const registerSchema = yup.object({
  fullName: yup.string().trim().required("Escribe el nombre").max(150),
  phone: yup.string().trim().max(30).default(""),
  email: yup.string().trim().email("Correo inválido").max(150).default(""),
  gender: yup.string().default(""),
  birthDate: yup.date().nullable().default(null),
  address: yup.string().trim().max(255).default(""),
  invitedByName: yup.string().trim().max(150).default(""),
  contactSchedule: yup.string().trim().max(150).default(""),
  serviceLabel: yup.string().trim().max(80).default(""),
  acceptedChrist: yup.boolean().default(false),
  notes: yup.string().trim().max(2000).default(""),
  assignedMemberId: yup.string().default(""),
})
type RegisterValues = yup.InferType<typeof registerSchema>

function RegisterDialog({
  ministryId,
  open,
  canManage,
  followers,
  onClose,
  onDone,
}: {
  ministryId: string
  open: boolean
  canManage: boolean
  followers: { memberId: string; fullName: string }[]
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: yupResolver(registerSchema) as never })

  useEffect(() => {
    if (open) {
      reset(registerSchema.getDefault() as unknown as RegisterValues)
      setGps(null)
    }
  }, [open, reset])

  const submit = async (v: RegisterValues, useExisting = false) => {
    const body = {
      ...v,
      gender: v.gender || null,
      birthDate: v.birthDate ? ymdOf(v.birthDate) : null,
      assignedMemberId: v.assignedMemberId || null,
      latitude: gps?.lat ?? null,
      longitude: gps?.lon ?? null,
      assignToMe: !canManage,
      useExisting,
    }
    try {
      await apiJson(`/api/consolidation/${ministryId}/cases`, { method: "POST", body: JSON.stringify(body) })
      notify.success("Persona registrada")
      onClose()
      await onDone()
    } catch (err) {
      if (err instanceof ApiError && err.field === "duplicate") {
        const same = await swalConfirm("¿Es la misma persona?", err.message, { confirmText: "Sí, usar su ficha", cancelText: "No, revisar", icon: "question" })
        if (same) await submit(v, true)
        return
      }
      if (err instanceof ApiError && err.field && err.field in v) setError(err.field as keyof RegisterValues, { message: err.message })
      else swalError("No se pudo registrar", errorMessage(err))
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Registrar persona"
      description="Datos de quien llegó por primera vez, para darle seguimiento."
      className="max-w-[90vw]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Registrar
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={handleSubmit((v) => submit(v), (e) => focusFirstInvalid(e, formId))}
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="sm:col-span-2" data-form-field="fullName">
          <InputGroupField id="fullName" label="Nombre completo" required autoComplete="off" error={errors.fullName?.message} {...register("fullName")} />
        </div>
        <div data-form-field="phone">
          <InputGroupField id="phone" label="Teléfono" type="tel" inputMode="tel" autoComplete="off" error={errors.phone?.message} {...register("phone")} />
        </div>
        <div data-form-field="email">
          <InputGroupField id="email" label="Correo" type="email" inputMode="email" autoComplete="off" error={errors.email?.message} {...register("email")} />
        </div>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <FormCombobox label="Género" options={GENDER_OPTIONS} value={field.value} onChange={field.onChange} onClear={() => field.onChange("")} placeholder="—" />
          )}
        />
        <Controller
          control={control}
          name="birthDate"
          render={({ field }) => (
            <DatePicker
              label="Fecha de nacimiento"
              value={field.value ?? null}
              onChange={field.onChange}
              onClear={() => field.onChange(null)}
              disabledAfter={new Date()}
              toYear={new Date().getFullYear()}
              fromYear={1920}
            />
          )}
        />
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="address"
            render={({ field }) => (
              <AddressField
                label="Dirección"
                address={field.value ?? ""}
                onAddressChange={field.onChange}
                latitude={gps?.lat ?? null}
                longitude={gps?.lon ?? null}
                onGpsChange={setGps}
                helper="Con la ubicación se le canaliza a la célula más cercana."
              />
            )}
          />
        </div>
        <InputGroupField id="invitedByName" label="¿Quién lo invitó?" {...register("invitedByName")} />
        <InputGroupField id="contactSchedule" label="Mejor horario para contactarlo" placeholder="Ej. Tardes" {...register("contactSchedule")} />
        <InputGroupField id="serviceLabel" label="Reunión a la que llegó" placeholder="Ej. Domingo 10:00" {...register("serviceLabel")} />
        {canManage && (
          <Controller
            control={control}
            name="assignedMemberId"
            render={({ field }) => (
              <FormCombobox
                label="Quién le da seguimiento"
                options={followers.map((f) => ({ value: f.memberId, label: f.fullName }))}
                value={field.value}
                onChange={field.onChange}
                onClear={() => field.onChange("")}
                placeholder="Sin asignar"
              />
            )}
          />
        )}
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="acceptedChrist"
            render={({ field }) => (
              <SwitchField
                label="Hizo la invitación a ser hijo de Dios"
                description="Márcalo si recibió a Cristo en la reunión."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" rows={3} {...register("notes")} />
        </div>
        {!canManage && <p className="text-xs text-muted-foreground sm:col-span-2">Quedará asignada a ti para el seguimiento.</p>}
      </form>
    </DialogComponent>
  )
}

// ── Detalle y seguimiento ─────────────────────────────────────────────────────

const contactSchema = yup.object({
  channel: yup.string().oneOf([...CHANNELS]).required("Elige el medio"),
  summary: yup.string().trim().required("Anota qué hablaron").max(2000),
  interest: yup.string().default(""),
  nextContactAt: yup.date().nullable().default(null),
})
type ContactValues = yup.InferType<typeof contactSchema>

function CaseDialog({
  caseId,
  followers,
  onClose,
  onChanged,
}: {
  caseId: string | null
  followers: { memberId: string; fullName: string }[]
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [detail, setDetail] = useState<CaseDetailDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<OutcomeKey | "">("")
  const [outcomeNote, setOutcomeNote] = useState("")
  const [channeling, setChanneling] = useState(false)

  const load = useCallback(async () => {
    if (!caseId) return
    try {
      const d = await apiJson<{ case: CaseDetailDto }>(`/api/consolidation/cases/${caseId}`)
      setDetail(d.case)
      setOutcome(d.case.outcome ?? "")
      setOutcomeNote(d.case.outcomeNote ?? "")
    } catch (e) {
      swalError("No se pudo abrir el caso", errorMessage(e))
      onClose()
    }
  }, [caseId, onClose])

  useEffect(() => {
    setDetail(null)
    setChanneling(false)
    void load()
  }, [load])

  const patch = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    try {
      await apiJson(`/api/consolidation/cases/${caseId}`, { method: "PATCH", body: JSON.stringify(body) })
      notify.success(ok)
      await load()
      await onChanged()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const close = async () => {
    const yes = await swalConfirm("¿Cerrar el seguimiento?", "Se da por concluido sin canalizarlo. El líder puede reabrirlo.", { confirmText: "Cerrar caso", danger: true })
    if (yes) await patch({ status: "closed", outcome: "none", outcomeNote: outcomeNote || "Sin continuidad" }, "Caso cerrado")
  }

  return (
    <DialogComponent
      open={caseId !== null}
      onOpenChange={(o) => !o && onClose()}
      title={detail?.fullName ?? "Seguimiento"}
      description={detail ? `Visitó el ${fmtDate(detail.visitedAt)}${detail.serviceLabel ? ` · ${detail.serviceLabel}` : ""}` : undefined}
      className="max-w-[90vw]"
    >
      {!detail ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={STATUS_TONE[detail.status]}>{CASE_STATUS_LABEL[detail.status]}</StatusPill>
            {detail.acceptedChrist && <StatusPill tone="success">Aceptó a Cristo</StatusPill>}
            {detail.overdue && <StatusPill tone="danger">Seguimiento vencido</StatusPill>}
            {detail.status === "channeled" && detail.outcome && (
              <StatusPill tone="neutral" dot={false}>
                {OUTCOME_LABEL[detail.outcome]}
                {detail.outcomeNote ? ` · ${detail.outcomeNote}` : ""}
              </StatusPill>
            )}
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {detail.phone && (
              <a href={`tel:${detail.phone}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 hover:border-primary/40">
                <Phone className="size-4 text-muted-foreground" /> {detail.phone}
              </a>
            )}
            {detail.email && (
              <a href={`mailto:${detail.email}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 hover:border-primary/40">
                <Mail className="size-4 text-muted-foreground" /> <span className="truncate">{detail.email}</span>
              </a>
            )}
            {(detail.person.street || detail.person.neighborhood || detail.person.city) && (
              <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">{[detail.person.street, detail.person.neighborhood, detail.person.city].filter(Boolean).join(", ")}</span>
                {detail.person.latitude !== null && detail.person.longitude !== null && (
                  <a
                    href={`https://www.google.com/maps?q=${detail.person.latitude},${detail.person.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Ver mapa
                  </a>
                )}
              </p>
            )}
            {detail.person.contactSchedule && <p className="rounded-xl bg-muted/60 px-3 py-2">Mejor horario: {detail.person.contactSchedule}</p>}
            {detail.person.invitedByName && <p className="rounded-xl bg-muted/60 px-3 py-2">Lo invitó: {detail.person.invitedByName}</p>}
          </div>
          {detail.notes && <p className="rounded-xl bg-muted/60 p-3 text-sm whitespace-pre-line">{detail.notes}</p>}

          {detail.canManage && (
            <FormCombobox
              label="Quién le da seguimiento"
              options={followers.map((f) => ({ value: f.memberId, label: f.fullName }))}
              value={detail.assignedMemberId ?? ""}
              onChange={(v) => void patch({ assignedMemberId: v || null }, "Asignación guardada")}
              onClear={() => void patch({ assignedMemberId: null }, "Asignación quitada")}
              placeholder="Sin asignar"
            />
          )}
          {!detail.canManage && detail.assignedName && <p className="text-sm text-muted-foreground">Lo atiende {detail.assignedName}.</p>}

          {detail.canWork && detail.status !== "closed" && detail.status !== "channeled" && (
            <NearbyCells caseDetail={detail} onChanged={async () => { await load(); await onChanged() }} />
          )}

          {detail.canWork && detail.status !== "closed" && (
            <section className="space-y-3 rounded-2xl border p-3">
              <h3 className="text-sm font-semibold">Registrar contacto</h3>
              <ContactForm caseId={detail.id} onDone={async () => { await load(); await onChanged() }} />
            </section>
          )}

          {detail.canWork && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Estado del seguimiento</h3>
              {channeling ? (
                <div className="space-y-3 rounded-2xl border p-3">
                  <FormCombobox
                    label="¿A dónde lo canalizas?"
                    options={OUTCOMES.filter((o) => o !== "none").map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))}
                    value={outcome}
                    onChange={(v) => setOutcome(v as OutcomeKey)}
                    clearable={false}
                  />
                  <InputGroupField label="Detalle (célula, día, lugar…)" value={outcomeNote} maxLength={300} onChange={(e) => setOutcomeNote(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setChanneling(false)} disabled={busy}>
                      Cancelar
                    </Button>
                    <Button disabled={busy || !outcome} onClick={() => void patch({ status: "channeled", outcome, outcomeNote }, "Persona canalizada")}>
                      <Check className="size-4" /> Canalizar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detail.status !== "channeled" && detail.status !== "closed" && (
                    <>
                      <Button variant="outline" onClick={() => setChanneling(true)}>
                        Canalizar a célula o reunión
                      </Button>
                      <Button variant="ghost" onClick={() => void close()} disabled={busy}>
                        Cerrar sin continuidad
                      </Button>
                    </>
                  )}
                  {(detail.status === "channeled" || detail.status === "closed") && detail.canManage && (
                    <Button variant="outline" disabled={busy} onClick={() => void patch({ status: "following" }, "Caso reabierto")}>
                      Reabrir seguimiento
                    </Button>
                  )}
                </div>
              )}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Historial de contactos</h3>
            {detail.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay contactos registrados.</p>
            ) : (
              <ol className="space-y-2 border-l pl-4">
                {detail.contacts.map((c) => (
                  <li key={c.id} className="relative">
                    <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary" />
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(c.contactedAt)} · {CHANNEL_LABEL[c.channel]}
                      {c.madeByName ? ` · ${c.madeByName}` : ""}
                    </p>
                    <p className="text-sm whitespace-pre-line">{c.summary}</p>
                    {(c.interest || c.nextContactAt) && (
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {c.interest && <span>{INTEREST_LABEL[c.interest]}</span>}
                        {c.nextContactAt && <span>Próximo contacto: {fmtDateTime(c.nextContactAt)}</span>}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </DialogComponent>
  )
}

function ContactForm({ caseId, onDone }: { caseId: string; onDone: () => Promise<void> }) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: yupResolver(contactSchema) as never,
    defaultValues: { channel: "call", summary: "", interest: "", nextContactAt: null },
  })

  const submit = async (v: ContactValues) => {
    try {
      await apiJson(`/api/consolidation/cases/${caseId}/contacts`, {
        method: "POST",
        body: JSON.stringify({ ...v, interest: v.interest || null, nextContactAt: v.nextContactAt?.toISOString() ?? null }),
      })
      notify.success("Contacto registrado")
      reset({ channel: "call", summary: "", interest: "", nextContactAt: null })
      await onDone()
    } catch (e) {
      swalError("No se pudo registrar", errorMessage(e))
    }
  }

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(submit, (e) => focusFirstInvalid(e, formId))} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Controller
          control={control}
          name="channel"
          render={({ field }) => (
            <FormCombobox
              label="¿Cómo lo contactaste?"
              options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
              value={field.value}
              onChange={field.onChange}
              clearable={false}
              error={errors.channel?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="interest"
          render={({ field }) => (
            <FormCombobox
              label="¿Seguirá asistiendo?"
              options={INTERESTS.map((i) => ({ value: i, label: INTEREST_LABEL[i] }))}
              value={field.value}
              onChange={field.onChange}
              onClear={() => field.onChange("")}
              placeholder="—"
            />
          )}
        />
      </div>
      <div className="space-y-1.5" data-form-field="summary">
        <Label htmlFor={`${formId}-summary`}>¿Qué hablaron?</Label>
        <Textarea id={`${formId}-summary`} rows={3} placeholder="Cómo ha estado, qué le pareció la reunión…" {...register("summary")} />
        {errors.summary && <p className="text-xs text-destructive">{errors.summary.message}</p>}
      </div>
      <Controller
        control={control}
        name="nextContactAt"
        render={({ field }) => (
          <DateTimePicker label="Próximo contacto (opcional)" value={field.value ?? null} onChange={(d) => field.onChange(d ?? null)} />
        )}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
          Guardar contacto
        </Button>
      </div>
    </form>
  )
}


// ── Células cercanas ──────────────────────────────────────────────────────────

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

function NearbyCells({ caseDetail, onChanged }: { caseDetail: CaseDetailDto; onChanged: () => Promise<void> }) {
  const [nearby, setNearby] = useState<NearbyCellsDto | null>(null)
  const [typeId, setTypeId] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [address, setAddress] = useState(caseDetail.person.street ?? "")
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(
    caseDetail.person.latitude !== null && caseDetail.person.longitude !== null ? { lat: caseDetail.person.latitude, lon: caseDetail.person.longitude } : null
  )
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const q = typeId ? `?typeId=${typeId}` : ""
      const d = await apiJson<{ nearby: NearbyCellsDto }>(`/api/consolidation/cases/${caseDetail.id}/nearest-cells${q}`)
      setNearby(d.nearby)
    } catch (e) {
      setNearby({ hasLocation: false, types: [], cells: [] })
      swalError("No se pudieron buscar células", errorMessage(e))
    }
  }, [caseDetail.id, typeId])
  const { latitude: personLat, longitude: personLng } = caseDetail.person
  useEffect(() => {
    // Al cambiar la ubicación de la persona se vuelven a buscar las células cercanas.
    void load()
  }, [load, personLat, personLng])

  const saveAddress = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/consolidation/cases/${caseDetail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ address, latitude: gps?.lat ?? null, longitude: gps?.lon ?? null }),
      })
      notify.success("Dirección guardada")
      setEditing(false)
      await onChanged()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const channel = async (cell: NearbyCellDto) => {
    const yes = await swalConfirm(`¿Canalizar a «${cell.name}»?`, "Se integrará a la célula y el caso quedará canalizado.", { confirmText: "Canalizar", icon: "question" })
    if (!yes) return
    setBusy(cell.id)
    try {
      await apiJson(`/api/consolidation/cases/${caseDetail.id}/channel`, { method: "POST", body: JSON.stringify({ cellId: cell.id }) })
      notify.success("Persona canalizada a la célula")
      await onChanged()
    } catch (e) {
      swalError("No se pudo canalizar", errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-sm font-semibold">Células cercanas</h3>
        <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
          <MapPin className="size-4" />
          {editing ? "Cancelar" : caseDetail.person.latitude !== null ? "Cambiar ubicación" : "Agregar ubicación"}
        </Button>
      </div>

      {editing && (
        <div className="space-y-3">
          <AddressField label="Dirección de la persona" address={address} onAddressChange={setAddress} latitude={gps?.lat ?? null} longitude={gps?.lon ?? null} onGpsChange={setGps} />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void saveAddress()} disabled={saving || !gps}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar dirección
            </Button>
          </div>
        </div>
      )}

      {!nearby ? (
        <Skeleton className="h-16 w-full" />
      ) : !nearby.hasLocation ? (
        <p className="text-sm text-muted-foreground">Agrega la dirección con su ubicación para sugerir la célula más cercana.</p>
      ) : (
        <>
          <FormCombobox
            label="Tipo de célula"
            options={nearby.types.map((t) => ({ value: t.id, label: t.name }))}
            value={typeId}
            onChange={setTypeId}
            onClear={() => setTypeId("")}
            placeholder="Todas (mujeres, matrimonios, jóvenes…)"
          />
          {nearby.cells.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay células con ubicación de ese tipo.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {nearby.cells.map((cell) => (
                <li key={cell.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{cell.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {cell.typeName ? `${cell.typeName} · ` : ""}
                      {DAY_NAMES[cell.dayOfWeek]} {cell.startTime} · {cell.members} integrante{cell.members === 1 ? "" : "s"}
                    </span>
                    {cell.leaders.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        Líder: {cell.leaders.map((l) => (l.phone ? `${l.name} (${l.phone})` : l.name)).join(", ")}
                      </span>
                    )}
                  </span>
                  <StatusPill tone="info" dot={false}>
                    {cell.distanceKm < 1 ? `${Math.round(cell.distanceKm * 1000)} m` : `${cell.distanceKm.toFixed(1)} km`}
                  </StatusPill>
                  <Button size="sm" disabled={busy !== null} onClick={() => void channel(cell)}>
                    {busy === cell.id && <Loader2 className="size-4 animate-spin" />}
                    Canalizar aquí
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
