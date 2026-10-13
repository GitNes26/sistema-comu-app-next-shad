"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Cake,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Home,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Repeat,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { Attachment } from "@/components/base/attachment"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads"
import { ApiError, apiJson, errorMessage } from "@/lib/ministries/client"
import {
  CELL_ROLE_LABEL,
  DAY_LABEL,
  VISION_STAGES,
  VISION_STAGE_LABEL,
  timeLabel,
  type CellRoleKey,
  type VisionStageKey,
} from "@/lib/cells/rules"
import type { CellDetailDto, CellMemberDto, MeetingDetailDto, NetworkDto } from "@/lib/cells/server"
import { CellFormDialog } from "./cells-list"
import { cn } from "@/lib/utils"

// Espacio de una célula: resumen y cumpleañeros del mes, integrantes (con su avance
// en la visión, que actualiza el líder), reuniones con asistencia y traspasos.

const STAGE_OPTIONS = VISION_STAGES.map((s) => ({ value: s, label: VISION_STAGE_LABEL[s] }))
const ROLE_OPTIONS = (["leader", "support", "member"] as const).map((r) => ({ value: r, label: CELL_ROLE_LABEL[r] }))
const fmtLong = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
const fmtShort = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export function CellWorkspace({ cellId, backHref }: { cellId: string; backHref: string }) {
  const [cell, setCell] = useState<CellDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState<string | undefined>(undefined)
  const [editOpen, setEditOpen] = useState(false)
  const [catalogs, setCatalogs] = useState<{ networks: NetworkDto[]; types: { id: string; name: string; isActive: boolean }[] }>({ networks: [], types: [] })

  const load = useCallback(
    async (m?: string) => {
      try {
        const d = await apiJson<{ cell: CellDetailDto }>(`/api/cells/${cellId}${m ? `?month=${m}` : ""}`)
        setCell(d.cell)
      } catch (e) {
        setError(errorMessage(e, "No se pudo abrir la célula"))
      }
    },
    [cellId]
  )

  useEffect(() => {
    void load(month)
  }, [load, month])

  const openEdit = async () => {
    try {
      const [n, t] = await Promise.all([
        apiJson<{ networks: NetworkDto[] }>("/api/cells/networks").catch(() => ({ networks: [] as NetworkDto[] })),
        apiJson<{ types: { id: string; name: string; isActive: boolean }[] }>("/api/cells/types").catch(() => ({ types: [] })),
      ])
      setCatalogs({ networks: n.networks, types: t.types })
    } finally {
      setEditOpen(true)
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir la célula" description={error} />
      </div>
    )
  }
  if (!cell) return <Skeleton className="h-64 w-full" />

  const refresh = async () => load(month)
  const pendingForMe = cell.transfers.filter((t) => t.canDecide).length

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={backHref}>
          <ArrowLeft className="size-4" />
          Células
        </Link>
      </Button>

      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Home className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">{cell.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[cell.typeName, cell.networkName].filter(Boolean).join(" · ") || "Célula"}
          </p>
        </div>
        {cell.access.myRole && <StatusPill tone={cell.access.myRole === "leader" ? "success" : "info"}>Tu papel: {CELL_ROLE_LABEL[cell.access.myRole]}</StatusPill>}
        {!cell.isActive && <StatusPill tone="neutral">Inactiva</StatusPill>}
        {cell.access.canManage && (
          <Button variant="outline" size="sm" onClick={() => void openEdit()}>
            <Settings2 className="size-4" />
            Configurar
          </Button>
        )}
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">
            <CalendarClock className="size-4" /> Resumen
          </TabsTrigger>
          {cell.members && (
            <TabsTrigger value="members">
              <Users className="size-4" /> Integrantes
            </TabsTrigger>
          )}
          {cell.access.canTakeAttendance && (
            <TabsTrigger value="meetings">
              <ClipboardCheck className="size-4" /> Reuniones
            </TabsTrigger>
          )}
          {cell.members && (
            <TabsTrigger value="transfers" className="relative">
              <Repeat className="size-4" /> Traspasos
              {pendingForMe > 0 && <span className="ml-1 rounded-full bg-destructive px-1.5 text-[0.65rem] text-white">{pendingForMe}</span>}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="summary">
          <SummaryTab cell={cell} onMonth={(m) => setMonth(m)} />
        </TabsContent>
        {cell.members && (
          <TabsContent value="members">
            <MembersTab cell={cell} members={cell.members} onChanged={refresh} />
          </TabsContent>
        )}
        {cell.access.canTakeAttendance && (
          <TabsContent value="meetings">
            <MeetingsTab cell={cell} onChanged={refresh} />
          </TabsContent>
        )}
        {cell.members && (
          <TabsContent value="transfers">
            <TransfersTab cell={cell} onChanged={refresh} />
          </TabsContent>
        )}
      </Tabs>

      <CellFormDialog
        open={editOpen}
        cell={{ ...cell, hostName: cell.hostName }}
        networks={catalogs.networks}
        types={catalogs.types}
        canChangeNetwork={catalogs.networks.length > 0}
        onClose={() => setEditOpen(false)}
        onSaved={refresh}
      />
    </div>
  )
}

// ── Resumen ───────────────────────────────────────────────────────────────────

function SummaryTab({ cell, onMonth }: { cell: CellDetailDto; onMonth: (m: string) => void }) {
  const address = [cell.street, cell.neighborhood, cell.city].filter(Boolean).join(", ")
  const mapsHref =
    cell.latitude !== null && cell.longitude !== null
      ? `https://www.google.com/maps?q=${cell.latitude},${cell.longitude}`
      : address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : null
  const shift = (delta: number) => {
    const [y, m] = cell.birthdayMonth.split("-").map(Number)
    onMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7))
  }
  const [y, m] = cell.birthdayMonth.split("-").map(Number)
  const monthLabel = new Date(Date.UTC(y, m - 1, 1, 12)).toLocaleDateString("es-MX", { month: "long", year: "numeric" })
  // El festejo es la última reunión del mes mostrado.
  const celebration = fmtLong(cell.celebrationDate)
  const celebrationDay = Number(cell.celebrationDate.slice(8, 10))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" />
            {DAY_LABEL[cell.dayOfWeek]} · {timeLabel(cell.startTime)}
          </p>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            Próxima reunión: {fmtLong(cell.nextMeeting)}
            {cell.nextTopic ? ` · ${cell.nextTopic}` : ""}
          </p>
          {(address || cell.reference) && (
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                {address}
                {cell.reference ? <span className="block text-xs text-muted-foreground">{cell.reference}</span> : null}
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">
                    Ver en el mapa
                  </a>
                )}
              </span>
            </p>
          )}
          {cell.hostName && (
            <p className="flex items-center gap-2 text-sm">
              <Home className="size-4 text-muted-foreground" /> Anfitrión: {cell.hostName}
            </p>
          )}
        </div>
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          <p className="text-sm font-semibold">Quienes la dirigen</p>
          {cell.leaders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin líder asignado.</p>
          ) : (
            <ul className="space-y-1">
              {cell.leaders.map((l) => (
                <li key={l.memberId} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{l.fullName}</span>
                  <StatusPill tone={l.role === "leader" ? "success" : "info"} dot={false}>
                    {CELL_ROLE_LABEL[l.role]}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            {cell.memberCount} persona{cell.memberCount === 1 ? "" : "s"} en la célula.
          </p>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Cake className="size-5 text-primary" />
          <h2 className="min-w-0 flex-1 font-heading text-base font-semibold">Cumpleañeros</h2>
          <Button size="icon-sm" variant="outline" aria-label="Mes anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="w-32 text-center text-sm font-medium first-letter:uppercase">{monthLabel}</span>
          <Button size="icon-sm" variant="outline" aria-label="Mes siguiente" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {cell.birthdays.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nadie cumple años este mes en la célula.</p>
        ) : (
          <>
            <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm">
              🎉 El festejo es en la última reunión del mes: <span className="font-semibold first-letter:uppercase">{celebration}</span>.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {cell.birthdays.map((b) => (
                <li key={b.memberId} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2", b.day <= celebrationDay ? "" : "")}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold tabular-nums text-primary">{b.day}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{b.fullName}</span>
                    <span className="block text-xs text-muted-foreground">{b.turns ? `Cumple ${b.turns} años` : "Cumpleaños"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {cell.notes && <p className="rounded-xl bg-muted/60 p-3 text-sm whitespace-pre-line">{cell.notes}</p>}
    </div>
  )
}

// ── Integrantes ───────────────────────────────────────────────────────────────

function MembersTab({ cell, members, onChanged }: { cell: CellDetailDto; members: CellMemberDto[]; onChanged: () => Promise<void> }) {
  const [addOpen, setAddOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [transfer, setTransfer] = useState<CellMemberDto | null>(null)
  const canManage = cell.access.canManage
  const canStage = cell.access.canUpdateStage
  const thisMonth = Number(cell.birthdayMonth.slice(5, 7))

  const setStage = async (m: CellMemberDto, stage: string) => {
    try {
      await apiJson(`/api/cells/${cell.id}/members/${m.memberId}/stage`, { method: "POST", body: JSON.stringify({ stage }) })
      notify.success(`Avance de ${m.fullName.split(" ")[0]} actualizado`)
      await onChanged()
    } catch (e) {
      swalError("No se pudo actualizar el avance", errorMessage(e))
    }
  }
  const setRole = async (m: CellMemberDto, role: string) => {
    try {
      await apiJson(`/api/cells/${cell.id}/members/${m.memberId}`, { method: "PATCH", body: JSON.stringify({ role }) })
      await onChanged()
    } catch (e) {
      swalError("No se pudo cambiar el papel", errorMessage(e))
    }
  }
  const remove = async (m: CellMemberDto) => {
    const yes = await swalConfirm(`¿Quitar a «${m.fullName}» de la célula?`, "Conserva su historial de asistencia.", { confirmText: "Quitar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/cells/${cell.id}/members/${m.memberId}`, { method: "DELETE" })
      await onChanged()
    } catch (e) {
      swalError("No se pudo quitar", errorMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setNewOpen(true)}>
            <UserPlus className="size-4" />
            Nuevo creyente
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Agregar del padrón
          </Button>
        </div>
      )}
      {!canStage && (
        <p className="text-xs text-muted-foreground">El avance en la visión lo actualiza el líder de la célula.</p>
      )}
      {members.length === 0 ? (
        <EmptyState icon={Users} title="Sin integrantes" description="Agrega a quienes asisten a esta célula." />
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.memberId} className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
              <span className="min-w-0 flex-1 basis-40">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{m.fullName}</span>
                  {m.birthDate && Number(m.birthDate.slice(5, 7)) === thisMonth && <Cake className="size-3.5 shrink-0 text-primary" aria-label="Cumple años este mes" />}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {m.role !== "member" && <span className="font-medium text-foreground">{CELL_ROLE_LABEL[m.role]}</span>}
                  {m.phone && (
                    <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 hover:underline">
                      <Phone className="size-3" /> {m.phone}
                    </a>
                  )}
                  {m.birthDate && <span>🎂 {fmtShort(m.birthDate)}</span>}
                </span>
              </span>
              <span className="w-40 shrink-0">
                {canStage ? (
                  <FormCombobox
                    ariaLabel={`Avance de ${m.fullName}`}
                    options={STAGE_OPTIONS}
                    value={m.stage}
                    clearable={false}
                    onChange={(v) => void setStage(m, v)}
                  />
                ) : (
                  <StatusPill tone="info" dot={false}>
                    {VISION_STAGE_LABEL[m.stage as VisionStageKey]}
                  </StatusPill>
                )}
              </span>
              {canManage && (
                <span className="flex shrink-0 items-center gap-1">
                  <span className="w-32">
                    <FormCombobox ariaLabel={`Papel de ${m.fullName}`} options={ROLE_OPTIONS} value={m.role} clearable={false} onChange={(v) => void setRole(m, v)} />
                  </span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Traspasar a ${m.fullName}`} onClick={() => setTransfer(m)}>
                    <Repeat className="size-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Quitar a ${m.fullName}`} onClick={() => void remove(m)}>
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <AddMemberDialog cellId={cell.id} open={addOpen} onClose={() => setAddOpen(false)} onDone={onChanged} />
      <NewBelieverDialog cellId={cell.id} open={newOpen} onClose={() => setNewOpen(false)} onDone={async () => void (await onChanged())} />
      <TransferDialog cellId={cell.id} member={transfer} onClose={() => setTransfer(null)} onDone={onChanged} />
    </div>
  )
}

function AddMemberDialog({ cellId, open, onClose, onDone }: { cellId: string; open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<{ id: string; fullName: string; phone: string | null }[]>([])
  const [role, setRole] = useState<CellRoleKey>("member")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const d = await apiJson<{ candidates: { id: string; fullName: string; phone: string | null }[] }>(`/api/cells/${cellId}/members?q=${encodeURIComponent(q)}`)
        setRows(d.candidates)
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, open, cellId])

  const add = async (memberId: string) => {
    try {
      await apiJson(`/api/cells/${cellId}/members`, { method: "POST", body: JSON.stringify({ memberId, role }) })
      notify.success("Integrante agregado")
      await onDone()
      setRows((cur) => cur.filter((r) => r.id !== memberId))
    } catch (e) {
      swalError("No se pudo agregar", errorMessage(e))
    }
  }

  return (
    <DialogComponent open={open} onOpenChange={(o) => !o && onClose()} title="Agregar integrante" description="Solo aparecen personas que aún no tienen célula.">
      <div className="space-y-3">
        <FormCombobox label="Papel" options={ROLE_OPTIONS} value={role} onChange={(v) => setRole(v as CellRoleKey)} clearable={false} />
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono…" aria-label="Buscar persona" className="pl-9 md:pl-9 desk:pl-9" />
        </div>
        <ul className="max-h-64 divide-y overflow-y-auto rounded-xl border">
          {loading && (
            <li className="flex justify-center p-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </li>
          )}
          {!loading && rows.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin resultados.</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => void add(r.id)} className="flex min-h-12 w-full flex-col items-start justify-center px-3 py-1.5 text-left hover:bg-muted">
                <span className="text-sm font-medium">{r.fullName}</span>
                {r.phone && <span className="text-xs text-muted-foreground">{r.phone}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DialogComponent>
  )
}

const believerSchema = yup.object({
  fullName: yup.string().trim().required("Escribe el nombre").max(150),
  phone: yup.string().trim().max(30).default(""),
  email: yup.string().trim().email("Correo inválido").max(150).default(""),
  gender: yup.string().default(""),
  birthDate: yup.date().nullable().default(null),
})
type BelieverValues = yup.InferType<typeof believerSchema>

function NewBelieverDialog({
  cellId,
  open,
  onClose,
  onDone,
}: {
  cellId: string
  open: boolean
  onClose: () => void
  onDone: (memberId: string, fullName: string) => Promise<void>
}) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BelieverValues>({ resolver: yupResolver(believerSchema) as never })

  useEffect(() => {
    if (open) reset(believerSchema.getDefault() as unknown as BelieverValues)
  }, [open, reset])

  const submit = async (v: BelieverValues, useExisting = false) => {
    try {
      const r = await apiJson<{ memberId: string }>(`/api/cells/${cellId}/new-believers`, {
        method: "POST",
        body: JSON.stringify({ ...v, gender: v.gender || null, birthDate: v.birthDate ? ymdOf(v.birthDate) : null, useExisting }),
      })
      notify.success("Nuevo creyente registrado")
      onClose()
      await onDone(r.memberId, v.fullName)
    } catch (err) {
      if (err instanceof ApiError && err.field === "duplicate" && err.status === 409 && /misma persona/.test(err.message)) {
        const same = await swalConfirm("¿Es la misma persona?", err.message, { confirmText: "Sí, usar su ficha", cancelText: "No, revisar", icon: "question" })
        if (same) await submit(v, true)
        return
      }
      if (err instanceof ApiError && err.field && err.field in v) setError(err.field as keyof BelieverValues, { message: err.message })
      else swalError("No se pudo registrar", errorMessage(err))
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Nuevo creyente"
      description="Quien llegó por primera vez a la célula. Entra a la etapa «Ganar» y a Consolidación."
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
      <form id={formId} noValidate onSubmit={handleSubmit((v) => submit(v), (e) => focusFirstInvalid(e, formId))} className="grid gap-4 sm:grid-cols-2">
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
            <FormCombobox
              label="Género"
              options={[
                { value: "female", label: "Mujer" },
                { value: "male", label: "Hombre" },
              ]}
              value={field.value}
              onChange={field.onChange}
              onClear={() => field.onChange("")}
              placeholder="—"
            />
          )}
        />
        <Controller
          control={control}
          name="birthDate"
          render={({ field }) => (
            <DatePicker
              label="Fecha de nacimiento (para el festejo)"
              value={field.value ?? null}
              onChange={field.onChange}
              onClear={() => field.onChange(null)}
              disabledAfter={new Date()}
              fromYear={1920}
              toYear={new Date().getFullYear()}
            />
          )}
        />
      </form>
    </DialogComponent>
  )
}

function TransferDialog({ cellId, member, onClose, onDone }: { cellId: string; member: CellMemberDto | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [targets, setTargets] = useState<{ id: string; name: string; dayOfWeek: number; startTime: string }[]>([])
  const [toCellId, setToCellId] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!member) return
    setToCellId("")
    setReason("")
    apiJson<{ cells: typeof targets }>(`/api/cells/${cellId}/transfer-targets`)
      .then((d) => setTargets(d.cells))
      .catch(() => setTargets([]))
  }, [member, cellId])

  const submit = async () => {
    if (!member) return
    setSaving(true)
    try {
      await apiJson("/api/cells/transfers", { method: "POST", body: JSON.stringify({ memberId: member.memberId, fromCellId: cellId, toCellId, reason }) })
      notify.success("Traspaso solicitado; lo aprueba la célula destino")
      onClose()
      await onDone()
    } catch (e) {
      swalError("No se pudo solicitar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={member !== null}
      onOpenChange={(o) => !o && onClose()}
      title={member ? `Traspasar a ${member.fullName}` : "Traspaso"}
      description="La célula destino debe aprobarlo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !toCellId}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Solicitar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormCombobox
          label="Célula destino"
          required
          options={targets.map((t) => ({ value: t.id, label: `${t.name} · ${DAY_LABEL[t.dayOfWeek]} ${timeLabel(t.startTime)}` }))}
          value={toCellId}
          onChange={setToCellId}
          clearable={false}
        />
        <InputGroupField label="Motivo (opcional)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      </div>
    </DialogComponent>
  )
}

// ── Reuniones y asistencia ────────────────────────────────────────────────────

function MeetingsTab({ cell, onChanged }: { cell: CellDetailDto; onChanged: () => Promise<void> }) {
  const [date, setDate] = useState<string | null>(null)

  // Fecha sugerida: la última vez que tocaba reunión (hoy o antes).
  const suggested = useMemo(() => {
    const now = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      if (d.getDay() === cell.dayOfWeek) return ymdOf(d)
    }
    return ymdOf(now)
  }, [cell.dayOfWeek])

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setDate(suggested)}>
          <ClipboardCheck className="size-4" />
          Registrar reunión
        </Button>
      </div>
      {cell.recentMeetings.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aún no hay reuniones registradas" description="Pasa lista, anota el tema y registra a quien llegó nuevo." />
      ) : (
        <ul className="space-y-2">
          {cell.recentMeetings.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setDate(m.date)} className="press flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left hover:border-primary/40">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium first-letter:uppercase">{fmtLong(m.date)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.topic ?? "Tema libre"}</span>
                </span>
                <span className="text-sm tabular-nums">
                  {m.present}/{m.total}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <MeetingDialog cell={cell} date={date} onClose={() => setDate(null)} onSaved={onChanged} />
    </div>
  )
}

function MeetingDialog({ cell, date, onClose, onSaved }: { cell: CellDetailDto; date: string | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [day, setDay] = useState<string | null>(date)
  const [meeting, setMeeting] = useState<MeetingDetailDto | null>(null)
  const [present, setPresent] = useState<Set<string>>(new Set())
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [topic, setTopic] = useState("")
  const [topicUrl, setTopicUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [evidence, setEvidence] = useState("")
  const [saving, setSaving] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  useEffect(() => {
    setDay(date)
  }, [date])

  const load = useCallback(
    async (target: string) => {
      try {
        const d = await apiJson<{ meeting: MeetingDetailDto }>(`/api/cells/${cell.id}/meeting?date=${target}`)
        setMeeting(d.meeting)
        // Reunión nueva: se parte con todos presentes para solo desmarcar a quien faltó.
        const isNew = d.meeting.id === null
        setPresent(new Set(d.meeting.attendance.filter((a) => (isNew ? true : a.present)).map((a) => a.memberId)))
        setFresh(new Set(d.meeting.attendance.filter((a) => a.isNew).map((a) => a.memberId)))
        setTopic(d.meeting.topic ?? "")
        setTopicUrl(d.meeting.topicUrl ?? "")
        setNotes(d.meeting.notes ?? "")
        setEvidence(d.meeting.evidenceUrls[0] ?? "")
      } catch (e) {
        swalError("No se pudo abrir la reunión", errorMessage(e))
        onClose()
      }
    },
    [cell.id, onClose]
  )

  useEffect(() => {
    if (day) void load(day)
    else setMeeting(null)
  }, [day, load])

  const toggle = (id: string) =>
    setPresent((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    if (!day) return
    setSaving(true)
    try {
      await apiJson(`/api/cells/${cell.id}/meetings`, {
        method: "POST",
        body: JSON.stringify({
          date: day,
          topic,
          topicUrl,
          notes,
          evidenceUrls: evidence ? [evidence] : [],
          presentMemberIds: [...present],
          newMemberIds: [...fresh],
        }),
      })
      notify.success("Reunión registrada")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const presentCount = meeting?.attendance.filter((a) => present.has(a.memberId)).length ?? 0

  return (
    <DialogComponent
      open={date !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Reunión de la célula"
      description={day ? `${fmtLong(day)} · ${presentCount} presentes` : undefined}
      className="max-w-[90vw]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !meeting}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Guardar
          </Button>
        </>
      }
    >
      {!meeting ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-4">
          <DatePicker
            label="Fecha"
            value={day ? new Date(`${day}T12:00:00`) : null}
            onChange={(d) => d && setDay(ymdOf(d))}
            disabledAfter={new Date()}
            clearable={false}
          />
          <InputGroupField label="Tema (opcional)" placeholder="Si lo mandó el pastor" value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} />
          <InputGroupField label="Enlace del tema (opcional)" type="url" inputMode="url" placeholder="https://…" value={topicUrl} onChange={(e) => setTopicUrl(e.target.value)} />

          <fieldset className="space-y-2">
            <legend className="flex w-full items-center text-sm font-semibold">
              <span className="flex-1">Asistencia</span>
              <Button type="button" size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                <UserPlus className="size-4" />
                Llegó alguien nuevo
              </Button>
            </legend>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {meeting.attendance.map((a) => (
                <li key={a.memberId}>
                  <label className={cn("flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm", present.has(a.memberId) && "border-primary bg-primary/5")}>
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={present.has(a.memberId)} onChange={() => toggle(a.memberId)} />
                    <span className="min-w-0 flex-1 truncate">{a.fullName}</span>
                    {a.birthday && <Cake className="size-3.5 shrink-0 text-primary" aria-label="Cumple años este mes" />}
                    {fresh.has(a.memberId) && <StatusPill tone="success" dot={false}>Nuevo</StatusPill>}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="meeting-notes">Notas</Label>
            <Textarea id="meeting-notes" rows={2} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Attachment label="Evidencia (foto, opcional)" value={evidence || null} onChange={(u) => setEvidence(u ?? "")} upload={uploadFile} accept={UPLOAD_IMAGE_ACCEPT} />
        </div>
      )}
      <NewBelieverDialog
        cellId={cell.id}
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onDone={async (memberId) => {
          // El nuevo creyente queda presente y marcado como nuevo en esta reunión.
          if (day) {
            const d = await apiJson<{ meeting: MeetingDetailDto }>(`/api/cells/${cell.id}/meeting?date=${day}`)
            setMeeting(d.meeting)
          }
          setPresent((cur) => new Set(cur).add(memberId))
          setFresh((cur) => new Set(cur).add(memberId))
        }}
      />
    </DialogComponent>
  )
}

// ── Traspasos ─────────────────────────────────────────────────────────────────

function TransfersTab({ cell, onChanged }: { cell: CellDetailDto; onChanged: () => Promise<void> }) {
  const decide = async (id: string, decision: "approve" | "reject" | "cancel") => {
    try {
      await apiJson(`/api/cells/transfers/${id}`, { method: "PATCH", body: JSON.stringify({ decision }) })
      notify.success(decision === "approve" ? "Traspaso aprobado" : decision === "reject" ? "Traspaso rechazado" : "Solicitud cancelada")
      await onChanged()
    } catch (e) {
      swalError("No se pudo registrar", errorMessage(e))
    }
  }
  if (cell.transfers.length === 0) {
    return <EmptyState icon={Repeat} title="Sin traspasos pendientes" description="Desde Integrantes puedes solicitar el traspaso de alguien a otra célula." />
  }
  return (
    <ul className="space-y-2">
      {cell.transfers.map((t) => (
        <li key={t.id} className="space-y-2 rounded-2xl border bg-card p-3">
          <p className="text-sm">
            <span className="font-medium">{t.memberName}</span> · de «{t.fromCellName}» a «{t.toCellName}»
          </p>
          {t.reason && <p className="text-xs text-muted-foreground">{t.reason}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {t.canDecide ? (
              <>
                <Button size="sm" onClick={() => void decide(t.id, "approve")}>
                  <Check className="size-4" /> Aprobar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void decide(t.id, "reject")}>
                  <X className="size-4" /> Rechazar
                </Button>
              </>
            ) : (
              cell.access.canManage && (
                <Button size="sm" variant="ghost" onClick={() => void decide(t.id, "cancel")}>
                  Cancelar solicitud
                </Button>
              )
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

