"use client"

import { TextareaField } from "@/components/base/textarea-field"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import {
  ArrowLeft,
  Baby,
  Ban,
  CalendarDays,
  Check,
  ClipboardCheck,
  ClipboardList,
  Crown,
  HandHeart,
  HeartHandshake,
  Loader2,
  Music,
  Package,
  Plus,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MinistryServiceTab } from "@/components/gatherings/service-sheet"
import { DialogComponent } from "@/components/ui/dialog"
import { InputGroupField } from "@/components/base/input-group-field"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { RowActions, StatusPill, type StatusTone } from "@/components/base"
import { EmptyState } from "@/components/shared/empty-state"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { dateToYmd, ymdToDate } from "@/lib/date-input"
import {
  ATTENDANCE_LABEL,
  MEETING_KINDS,
  MEETING_KIND_LABEL,
  MINISTRY_ROLES,
  MINISTRY_ROLE_LABEL,
  REQUEST_STATUS_LABEL,
  type AttendanceStatusKey,
  type MinistryRoleKey,
  type RequestStatusKey,
} from "@/lib/ministries/rules"
import type { AttendanceSheet, WorkspaceDto } from "@/lib/ministries/server"
import { cn } from "@/lib/utils"

// Espacio de trabajo de un ministerio. Lo usan el panel (/admin/ministries/[id]) y
// «Mi espacio» (/mi/ministerios/[id]). Qué puede hacer cada quien lo decide el
// servidor (`workspace.access`); la interfaz solo refleja esas banderas.

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } })
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) throw new Error(data?.error ?? "Error de red")
  return data as T
}

const ROLE_TONE: Record<MinistryRoleKey, StatusTone> = { leader: "primary", assistant: "info", servant: "neutral" }
const REQUEST_TONE: Record<RequestStatusKey, StatusTone> = {
  pending: "warning",
  approved: "info",
  rejected: "danger",
  delivered: "success",
  cancelled: "neutral",
}
const ATTENDANCE_TONE: Record<AttendanceStatusKey, StatusTone> = { present: "success", absent: "danger", excused: "warning" }

const ROLE_OPTIONS = MINISTRY_ROLES.map((r) => ({ value: r, label: MINISTRY_ROLE_LABEL[r] }))
const KIND_OPTIONS = MEETING_KINDS.map((k) => ({ value: k, label: MEETING_KIND_LABEL[k] }))

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

export function MinistryWorkspace({
  ministryId,
  backHref,
  backLabel,
}: {
  ministryId: string
  backHref: string
  backLabel: string
}) {
  const [ws, setWs] = useState<WorkspaceDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [sheetMeetingId, setSheetMeetingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<{ workspace: WorkspaceDto }>(`/api/ministries/${ministryId}`)
      setWs(data.workspace)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el ministerio")
    }
  }, [ministryId])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir el ministerio" description={error} />
      </div>
    )
  }
  if (!ws) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const { ministry, access, members, meetings, requests } = ws
  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusyId(key)
    try {
      await fn()
      if (ok) notify.success(ok)
      await load()
    } catch (err) {
      swalError("No se pudo completar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  const changeRole = (membershipId: string, role: MinistryRoleKey) =>
    run(membershipId, () => api(`/api/ministries/${ministryId}/members/${membershipId}`, { method: "PATCH", body: JSON.stringify({ role }) }), "Papel actualizado")

  const removeMember = async (membershipId: string, name: string) => {
    const ok = await swalConfirm(`¿Quitar a «${name}» del ministerio?`, "Conserva su historial de asistencia. Puedes volver a agregarlo.", {
      confirmText: "Quitar",
      danger: true,
    })
    if (ok) await run(membershipId, () => api(`/api/ministries/${ministryId}/members/${membershipId}`, { method: "DELETE" }), "Servidor quitado")
  }

  const deleteMeeting = async (id: string, title: string) => {
    const ok = await swalConfirm(`¿Eliminar «${title}»?`, "Solo se puede eliminar si aún no tiene asistencia.", { confirmText: "Eliminar", danger: true })
    if (ok) await run(id, () => api(`/api/ministries/meetings/${id}`, { method: "DELETE" }), "Reunión eliminada")
  }

  const setRequestStatus = (id: string, status: RequestStatusKey, okMsg: string) =>
    run(id, () => api(`/api/ministries/requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }), okMsg)

  const upcoming = meetings.filter((m) => new Date(m.startsAt) >= new Date())

  return (
    <div className="space-y-4">
      {!backHref.startsWith("/mi") && (
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        </Button>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 bg-gradient-to-br from-primary/20 via-accent to-info/10 px-5 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-1 ring-1 ring-border">
            <Users className="size-3.5" /> {members.length} servidor(es)
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-1 ring-1 ring-border">
            <CalendarDays className="size-3.5" /> {upcoming.length} reunión(es) próxima(s)
          </span>
          {ministry.children.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-1 ring-1 ring-border">
              <HeartHandshake className="size-3.5" /> {ministry.children.length} equipo(s)
            </span>
          )}
        </div>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-3xl bg-primary/10 text-primary">
              <HandHeart className="size-7" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-xl font-semibold tracking-tight">{ministry.name}</h1>
              {ministry.parent && (
                <p className="text-sm text-muted-foreground">
                  Parte de{" "}
                  <Link href={`${backHref.replace(/\/$/, "")}/${ministry.parent.id}`} className="font-medium text-foreground hover:underline">
                    {ministry.parent.name}
                  </Link>
                </p>
              )}
            </div>
            {access.myRole && <StatusPill tone={ROLE_TONE[access.myRole]}>Tu papel: {MINISTRY_ROLE_LABEL[access.myRole]}</StatusPill>}
            {!ministry.isActive && <StatusPill tone="neutral">Inactivo</StatusPill>}
          </div>
          {ministry.description && <p className="text-sm text-muted-foreground">{ministry.description}</p>}
          {ministry.requirements && (
            <div className="rounded-xl bg-muted/60 p-3 text-sm">
              <p className="mb-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Requisitos</p>
              <p className="whitespace-pre-line">{ministry.requirements}</p>
            </div>
          )}
          {ministry.kind === "worship" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${backHref.replace(/\/$/, "")}/${ministry.id}/alabanza`}>
                <Music className="size-4" />
                Programa, rol y canciones
              </Link>
            </Button>
          )}
          {ministry.kind === "consolidation" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${backHref.replace(/\/$/, "")}/${ministry.id}/consolidacion`}>
                <HeartHandshake className="size-4" />
                Seguimiento de nuevos
              </Link>
            </Button>
          )}
          {ministry.kind === "kids" && (
            <Button asChild variant="outline" size="sm">
              <Link href={`${backHref.replace(/\/$/, "")}/${ministry.id}/kids`}>
                <Baby className="size-4" />
                Servicio, niños y salones
              </Link>
            </Button>
          )}
          {ministry.children.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {ministry.children.map((c) => (
                <Link
                  key={c.id}
                  href={`${backHref.replace(/\/$/, "")}/${c.id}`}
                  className="press rounded-full border px-3 py-1.5 text-xs font-medium hover:border-primary/40"
                >
                  {c.name} · {c.memberCount}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="size-4" /> Servidores ({members.length})
          </TabsTrigger>
          <TabsTrigger value="meetings">
            <CalendarDays className="size-4" /> Reuniones
          </TabsTrigger>
          <TabsTrigger value="service">
            <ClipboardList className="size-4" /> Servicio
          </TabsTrigger>
          {requests && (
            <TabsTrigger value="requests">
              <Package className="size-4" /> Requisiciones
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Servicio en reuniones generales ─────────────────────────── */}
        <TabsContent value="service">
          <MinistryServiceTab ministryId={ministryId} />
        </TabsContent>

        {/* ── Servidores ─────────────────────────────────────────────── */}
        <TabsContent value="members" className="space-y-3">
          {access.canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="size-4" />
                Agregar servidor
              </Button>
            </div>
          )}
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aún no hay servidores"
              description={access.canManage ? "Agrega a los creyentes que sirven en este ministerio." : "Todavía no se registran servidores."}
            />
          ) : (
            <ul className="divide-y rounded-2xl border bg-card">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-heading text-sm font-semibold">
                    {m.fullName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                      <span className="truncate">{m.fullName}</span>
                      {m.role === "leader" && <Crown className="size-3.5 text-warning-ink" aria-label="Líder" />}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.positionTitle, m.phone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <StatusPill tone={ROLE_TONE[m.role]} dot={false}>
                    {MINISTRY_ROLE_LABEL[m.role]}
                  </StatusPill>
                  {access.canManage && (
                    <RowActions
                      name={m.fullName}
                      busy={busyId === m.id}
                      items={[
                        ...MINISTRY_ROLES.filter((r) => r !== m.role).map((r) => ({
                          label: `Cambiar a ${MINISTRY_ROLE_LABEL[r].toLowerCase()}`,
                          icon: Crown,
                          onSelect: () => void changeRole(m.id, r),
                        })),
                        { label: "Quitar del ministerio", icon: UserMinus, destructive: true, onSelect: () => void removeMember(m.id, m.fullName) },
                      ]}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* ── Reuniones ──────────────────────────────────────────────── */}
        <TabsContent value="meetings" className="space-y-3">
          {access.canManage && (
            <div className="flex justify-end">
              <Button onClick={() => setMeetingOpen(true)}>
                <Plus className="size-4" />
                Nueva reunión
              </Button>
            </div>
          )}
          {meetings.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Sin reuniones"
              description={access.canManage ? "Programa una junta, un ensayo o un servicio para pasar lista." : "Aún no hay reuniones programadas."}
            />
          ) : (
            <ul className="space-y-2">
              {meetings.map((m) => {
                const isUpcoming = upcoming.some((u) => u.id === m.id)
                return (
                  <li key={m.id} className="rounded-2xl border bg-card p-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDateTime(m.startsAt)}
                          {m.location ? ` · ${m.location}` : ""}
                        </p>
                      </div>
                      <StatusPill tone="neutral" dot={false}>
                        {MEETING_KIND_LABEL[m.kind]}
                      </StatusPill>
                      {isUpcoming && <StatusPill tone="info">Próxima</StatusPill>}
                      {m.myStatus && <StatusPill tone={ATTENDANCE_TONE[m.myStatus]}>{ATTENDANCE_LABEL[m.myStatus]}</StatusPill>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {m.attendance.total === 0
                          ? "Sin lista"
                          : `${m.attendance.present} asistieron · ${m.attendance.absent} faltaron · ${m.attendance.excused} justificados${m.attendance.rate !== null ? ` · ${m.attendance.rate}%` : ""}`}
                      </span>
                      <span className="ml-auto flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSheetMeetingId(m.id)}>
                          <ClipboardCheck className="size-4" />
                          {access.canTakeAttendance ? "Pasar lista" : "Ver lista"}
                        </Button>
                        {access.canManage && m.attendance.total === 0 && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Eliminar ${m.title}`}
                            disabled={busyId === m.id}
                            onClick={() => void deleteMeeting(m.id, m.title)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </TabsContent>

        {/* ── Requisiciones ──────────────────────────────────────────── */}
        {requests && (
          <TabsContent value="requests" className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setRequestOpen(true)}>
                <Plus className="size-4" />
                Nueva requisición
              </Button>
            </div>
            {requests.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sin requisiciones" description="Pide aquí lo que el ministerio necesita (material, equipo, etc.)." />
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-2xl border bg-card p-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {r.title}
                          {r.quantity ? <span className="ml-1 text-muted-foreground">× {r.quantity}</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pidió {r.requestedByName ?? "—"} · {new Date(r.createdAt).toLocaleDateString("es-MX")}
                          {r.neededBy ? ` · Para el ${new Date(`${r.neededBy}T12:00:00`).toLocaleDateString("es-MX")}` : ""}
                        </p>
                      </div>
                      <StatusPill tone={REQUEST_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</StatusPill>
                    </div>
                    {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
                    {r.decisionNote && <p className="mt-1 text-xs italic text-muted-foreground">«{r.decisionNote}»</p>}
                    <div className="mt-2 flex flex-wrap justify-end gap-1">
                      {access.canDecide && r.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => void setRequestStatus(r.id, "approved", "Requisición aprobada")}>
                            <Check className="size-4" /> Aprobar
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => void setRequestStatus(r.id, "rejected", "Requisición rechazada")}>
                            <X className="size-4" /> Rechazar
                          </Button>
                        </>
                      )}
                      {access.canDecide && r.status === "approved" && (
                        <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => void setRequestStatus(r.id, "delivered", "Marcada como entregada")}>
                          <Package className="size-4" /> Marcar entregada
                        </Button>
                      )}
                      {r.mine && r.status === "pending" && (
                        <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => void setRequestStatus(r.id, "cancelled", "Requisición cancelada")}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        )}
      </Tabs>

      <AddMemberDialog ministryId={ministryId} open={addOpen} onClose={() => setAddOpen(false)} onDone={load} />
      <MeetingDialog ministryId={ministryId} open={meetingOpen} onClose={() => setMeetingOpen(false)} onDone={load} />
      <RequestDialog ministryId={ministryId} open={requestOpen} onClose={() => setRequestOpen(false)} onDone={load} />
      <AttendanceDialog meetingId={sheetMeetingId} onClose={() => setSheetMeetingId(null)} onSaved={load} />
    </div>
  )
}

// ── Agregar servidor ───────────────────────────────────────────────────────────

function AddMemberDialog({ ministryId, open, onClose, onDone }: { ministryId: string; open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [q, setQ] = useState("")
  const [candidates, setCandidates] = useState<{ id: string; fullName: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<{ id: string; fullName: string } | null>(null)
  const [role, setRole] = useState<MinistryRoleKey>("servant")
  const [position, setPosition] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/ministries/${ministryId}/members?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        const data = (await res.json()) as { candidates?: { id: string; fullName: string }[] }
        setCandidates(data.candidates ?? [])
      } catch {
        /* cancelado */
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, open, ministryId])

  useEffect(() => {
    if (!open) {
      setQ("")
      setPicked(null)
      setRole("servant")
      setPosition("")
    }
  }, [open])

  const save = async () => {
    if (!picked) return
    setSaving(true)
    try {
      await api(`/api/ministries/${ministryId}/members`, {
        method: "POST",
        body: JSON.stringify({ memberId: picked.id, role, positionTitle: position }),
      })
      notify.success(`${picked.fullName} se agregó al ministerio`)
      onClose()
      await onDone()
    } catch (err) {
      swalError("No se pudo agregar", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Agregar servidor"
      description="Elige a un creyente del padrón y su papel en este ministerio."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!picked || saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Agregar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {picked ? (
          <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3">
            <span className="text-sm font-medium">{picked.fullName}</span>
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
              Cambiar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
              <Input
                type="search"
                inputMode="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre o teléfono…"
                aria-label="Buscar creyente"
                className="pl-9 md:pl-9 desk:pl-9"
                autoFocus
              />
            </div>
            <ul className="max-h-56 divide-y overflow-y-auto rounded-xl border">
              {loading && (
                <li className="flex justify-center p-4 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </li>
              )}
              {!loading && candidates.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin resultados</li>}
              {candidates.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setPicked(c)} className="flex min-h-11 w-full items-center px-3 text-left text-sm hover:bg-muted">
                    {c.fullName}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <FormCombobox
          label="Papel en el ministerio"
          options={ROLE_OPTIONS}
          value={role}
          onChange={(v) => setRole(v as MinistryRoleKey)}
          clearable={false}
          searchable={false}
        />
        <InputGroupField
          label="Responsabilidad (opcional)"
          helper="Describe qué hace dentro del ministerio; no da accesos."
          value={position}
          maxLength={100}
          onChange={(e) => setPosition(e.target.value)}
        />
      </div>
    </DialogComponent>
  )
}

// ── Nueva reunión ──────────────────────────────────────────────────────────────

const meetingSchema = yup.object({
  title: yup.string().trim().required("Escribe el título").max(150),
  kind: yup.string().oneOf([...MEETING_KINDS]).required(),
  startsAt: yup.date().typeError("Elige fecha y hora").required("Elige fecha y hora"),
  location: yup.string().trim().max(150).default(""),
  notes: yup.string().trim().max(1000).default(""),
})
type MeetingValues = yup.InferType<typeof meetingSchema>

function MeetingDialog({ ministryId, open, onClose, onDone }: { ministryId: string; open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MeetingValues>({
    resolver: yupResolver(meetingSchema) as never,
    defaultValues: { title: "", kind: "internal", startsAt: undefined, location: "", notes: "" },
  })
  useEffect(() => {
    if (open) reset({ title: "", kind: "internal", startsAt: undefined, location: "", notes: "" })
  }, [open, reset])

  const submit = async (v: MeetingValues) => {
    try {
      await api(`/api/ministries/${ministryId}/meetings`, {
        method: "POST",
        body: JSON.stringify({ ...v, startsAt: v.startsAt.toISOString() }),
      })
      notify.success("Reunión programada")
      onClose()
      await onDone()
    } catch (err) {
      swalError("No se pudo programar", err instanceof Error ? err.message : undefined)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Nueva reunión"
      description="Junta, ensayo o servicio en el que participa el ministerio."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Programar
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit(submit, (e) => focusFirstInvalid(e, formId))} className="space-y-4">
        <div data-form-field="title">
          <InputGroupField id="title" label="Título" required placeholder="Ej. Ensayo general" error={errors.title?.message} {...register("title")} />
        </div>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <FormCombobox label="Tipo" options={KIND_OPTIONS} value={field.value} onChange={field.onChange} clearable={false} searchable={false} />
          )}
        />
        <div data-form-field="startsAt">
          <Controller
            control={control}
            name="startsAt"
            render={({ field }) => (
              <DateTimePicker label="Fecha y hora" required value={field.value ?? null} onChange={(d) => field.onChange(d ?? undefined)} error={errors.startsAt?.message} />
            )}
          />
        </div>
        <InputGroupField id="location" label="Lugar (opcional)" error={errors.location?.message} {...register("location")} />
        <TextareaField id="notes" label="Notas (opcional)" rows={3} {...register("notes")} />
      </form>
    </DialogComponent>
  )
}

// ── Nueva requisición ──────────────────────────────────────────────────────────

const requestSchema = yup.object({
  title: yup.string().trim().required("Escribe qué se necesita").max(150),
  quantity: yup
    .number()
    .transform((v, o) => (o === "" || o === null ? undefined : v))
    .integer("Debe ser un número entero")
    .min(1, "Mínimo 1")
    .optional(),
  neededBy: yup.string().default(""),
  description: yup.string().trim().max(1000).default(""),
})
type RequestValues = yup.InferType<typeof requestSchema>

function RequestDialog({ ministryId, open, onClose, onDone }: { ministryId: string; open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RequestValues>({
    resolver: yupResolver(requestSchema) as never,
    defaultValues: { title: "", quantity: undefined, neededBy: "", description: "" },
  })
  useEffect(() => {
    if (open) reset({ title: "", quantity: undefined, neededBy: "", description: "" })
  }, [open, reset])

  const submit = async (v: RequestValues) => {
    try {
      await api(`/api/ministries/${ministryId}/requests`, { method: "POST", body: JSON.stringify(v) })
      notify.success("Requisición enviada")
      onClose()
      await onDone()
    } catch (err) {
      swalError("No se pudo enviar", err instanceof Error ? err.message : undefined)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Nueva requisición"
      description="Lo que el ministerio necesita; la administración la aprueba o rechaza."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Enviar
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit(submit, (e) => focusFirstInvalid(e, formId))} className="space-y-4">
        <div data-form-field="title">
          <InputGroupField id="title" label="¿Qué se necesita?" required error={errors.title?.message} {...register("title")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div data-form-field="quantity">
            <InputGroupField id="quantity" label="Cantidad" inputMode="numeric" error={errors.quantity?.message} {...register("quantity")} />
          </div>
          <Controller
            control={control}
            name="neededBy"
            render={({ field }) => (
              <DatePicker label="Para el día" value={ymdToDate(field.value)} onChange={(d) => field.onChange(dateToYmd(d))} />
            )}
          />
        </div>
        <TextareaField id="description" label="Detalle (opcional)" rows={3} {...register("description")} />
      </form>
    </DialogComponent>
  )
}

// ── Pase de lista ──────────────────────────────────────────────────────────────

function AttendanceDialog({ meetingId, onClose, onSaved }: { meetingId: string | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [sheet, setSheet] = useState<AttendanceSheet | null>(null)
  const [marks, setMarks] = useState<Record<string, AttendanceStatusKey | null>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!meetingId) {
      setSheet(null)
      return
    }
    let alive = true
    setLoading(true)
    api<{ sheet: AttendanceSheet }>(`/api/ministries/meetings/${meetingId}`)
      .then((d) => {
        if (!alive) return
        setSheet(d.sheet)
        setMarks(Object.fromEntries(d.sheet.rows.map((r) => [r.memberId, r.status])))
      })
      .catch((err) => {
        notify.error(err instanceof Error ? err.message : "No se pudo cargar la lista")
        onClose()
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId])

  const counts = useMemo(() => {
    const v = Object.values(marks)
    return {
      present: v.filter((s) => s === "present").length,
      absent: v.filter((s) => s === "absent").length,
      excused: v.filter((s) => s === "excused").length,
      pending: v.filter((s) => s === null).length,
    }
  }, [marks])

  const save = async () => {
    if (!sheet) return
    const records = Object.entries(marks)
      .filter((e): e is [string, AttendanceStatusKey] => e[1] !== null)
      .map(([memberId, status]) => ({ memberId, status }))
    if (records.length === 0) {
      notify.warning("Marca al menos a una persona")
      return
    }
    setSaving(true)
    try {
      await api(`/api/ministries/meetings/${sheet.meeting.id}`, { method: "PUT", body: JSON.stringify({ records }) })
      notify.success("Lista guardada")
      onClose()
      await onSaved()
    } catch (err) {
      swalError("No se pudo guardar la lista", err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const options: AttendanceStatusKey[] = ["present", "absent", "excused"]

  return (
    <DialogComponent
      open={meetingId !== null}
      onOpenChange={(o) => !o && onClose()}
      title={sheet ? sheet.meeting.title : "Lista de asistencia"}
      description={sheet ? fmtDateTime(sheet.meeting.startsAt) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {sheet?.canEdit ? "Cancelar" : "Cerrar"}
          </Button>
          {sheet?.canEdit && (
            <Button onClick={() => void save()} disabled={saving || loading}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar lista
            </Button>
          )}
        </>
      }
    >
      {loading || !sheet ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : sheet.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">El ministerio aún no tiene servidores.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <span>{counts.present} asistieron</span>·<span>{counts.absent} faltaron</span>·<span>{counts.excused} justificados</span>·
            <span>{counts.pending} sin marcar</span>
            {sheet.canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => setMarks(Object.fromEntries(sheet.rows.map((r) => [r.memberId, "present" as const])))}
              >
                Todos presentes
              </Button>
            )}
          </div>
          <ul className="divide-y rounded-xl border">
            {sheet.rows.map((r) => (
              <li key={r.memberId} className="flex flex-wrap items-center gap-2 p-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.fullName}</span>
                <div role="radiogroup" aria-label={`Asistencia de ${r.fullName}`} className="flex gap-1">
                  {options.map((s) => {
                    const active = marks[r.memberId] === s
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={!sheet.canEdit}
                        onClick={() => setMarks((m) => ({ ...m, [r.memberId]: active ? null : s }))}
                        className={cn(
                          "min-h-10 rounded-lg border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 desk:min-h-8",
                          active
                            ? s === "present"
                              ? "border-success/50 bg-success/15 text-success-ink"
                              : s === "absent"
                                ? "border-destructive/50 bg-destructive/12 text-destructive"
                                : "border-warning/50 bg-warning/20 text-warning-ink"
                            : "text-muted-foreground hover:bg-muted disabled:opacity-60"
                        )}
                      >
                        {ATTENDANCE_LABEL[s]}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DialogComponent>
  )
}
