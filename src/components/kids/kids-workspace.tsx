"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import {
  ArrowLeft,
  Ban,
  BellRing,
  Baby,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Loader2,
  LogOut,
  Plus,
  QrCode,
  ScanLine,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { SwitchField } from "@/components/base/switch-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { useFocusInvalid } from "@/hooks/use-focus-invalid"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { AttendanceDto, ChildDto, KidsOverviewDto, KidsReportDto, RoomDto, SessionDetailDto } from "@/lib/kids/server"
import type { WorkspaceDto } from "@/lib/ministries/server"
import { cn } from "@/lib/utils"
import { ChildFormDialog, GuardianPicker, QrImage, RELATION_OPTIONS, fmtTime, ymdOfLocal } from "./kids-shared"
import { KidsMessagesDialog } from "./kids-messages"
import { KidsScannerDialog } from "./kids-scanner"

// Espacio de Comunidad Kids para el personal: servicio en curso (salones, entradas y
// salidas), registro de niños, salones e historial. Pensado para tableta.

const SERVICE_PRESETS = ["Domingo 10:00", "Domingo 12:30", "Miércoles 19:30"]
const POLL_MS = 10000
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })

export function KidsWorkspace({ ministryId, backHref }: { ministryId: string; backHref: string }) {
  const [ws, setWs] = useState<WorkspaceDto | null>(null)
  const [overview, setOverview] = useState<KidsOverviewDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ workspace: WorkspaceDto }>(`/api/ministries/${ministryId}`)
      .then((d) => setWs(d.workspace))
      .catch((e) => setError(errorMessage(e, "No se pudo abrir Kids")))
  }, [ministryId])

  const loadOverview = useCallback(async () => {
    try {
      const d = await apiJson<{ overview: KidsOverviewDto }>(`/api/kids/${ministryId}`)
      setOverview(d.overview)
      setSessionId((cur) => (cur && d.overview.openSessions.some((s) => s.id === cur) ? cur : (d.overview.openSessions[0]?.id ?? null)))
    } catch (e) {
      setError(errorMessage(e, "No se pudo cargar Kids"))
    }
  }, [ministryId])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir Comunidad Kids" description={error} />
      </div>
    )
  }
  if (!ws || !overview) return <Skeleton className="h-64 w-full" />
  if (ws.ministry.kind !== "kids") {
    return <EmptyState icon={Ban} title="Este ministerio no es de Kids" description="Marca el ministerio como de Kids para usar este espacio." />
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`${backHref}/${ministryId}`}>
          <ArrowLeft className="size-4" />
          {ws.ministry.name}
        </Link>
      </Button>
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Baby className="size-5" />
        </span>
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">Comunidad Kids</h1>
          <p className="text-sm text-muted-foreground">
            {overview.childCount} niño{overview.childCount === 1 ? "" : "s"} registrado{overview.childCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="service">
        <TabsList>
          <TabsTrigger value="service">
            <ScanLine className="size-4" /> Servicio
          </TabsTrigger>
          <TabsTrigger value="children">
            <Users className="size-4" /> Niños
          </TabsTrigger>
          <TabsTrigger value="rooms">
            <Baby className="size-4" /> Salones
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" /> Asistencia
          </TabsTrigger>
        </TabsList>
        <TabsContent value="service">
          <ServiceTab ministryId={ministryId} overview={overview} sessionId={sessionId} onSelect={setSessionId} onChanged={loadOverview} />
        </TabsContent>
        <TabsContent value="children">
          <ChildrenTab ministryId={ministryId} rooms={overview.rooms} canManage={overview.access.canManage} onChanged={loadOverview} />
        </TabsContent>
        <TabsContent value="rooms">
          <RoomsTab ministryId={ministryId} rooms={overview.rooms} canManage={overview.access.canManage} onChanged={loadOverview} />
        </TabsContent>
        <TabsContent value="history">
          <ReportTab ministryId={ministryId} overview={overview} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Servicio en curso ─────────────────────────────────────────────────────────

function ServiceTab({
  ministryId,
  overview,
  sessionId,
  onSelect,
  onChanged,
}: {
  ministryId: string
  overview: KidsOverviewDto
  sessionId: string | null
  onSelect: (id: string) => void
  onChanged: () => Promise<void>
}) {
  const [label, setLabel] = useState("")
  const [opening, setOpening] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)

  const open = async (name: string, extra: Record<string, unknown> = {}) => {
    setOpening(true)
    try {
      const r = await apiJson<{ id: string }>(`/api/kids/${ministryId}/sessions`, { method: "POST", body: JSON.stringify({ label: name, ...extra }) })
      await onChanged()
      onSelect(r.id)
    } catch (e) {
      swalError("No se pudo abrir el servicio", errorMessage(e))
    } finally {
      setOpening(false)
    }
  }

  if (overview.openSessions.length === 0 || !sessionId) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon={ScanLine}
          title="No hay un servicio abierto"
          description={overview.access.canManage ? "Abre el servicio para dar entrada a los niños." : "La dirección de Kids abrirá el servicio."}
        />
        {overview.access.canManage && (
          <div className="space-y-2 rounded-2xl border p-3">
            <p className="text-sm font-medium">Abrir servicio de hoy</p>
            <div className="flex flex-wrap gap-2">
              {SERVICE_PRESETS.map((p) => (
                <Button key={p} variant="outline" size="sm" disabled={opening} onClick={() => void open(p)}>
                  {p}
                </Button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (label.trim()) void open(label.trim())
              }}
            >
              <div className="flex-1">
                <InputGroupField label="Otro servicio" placeholder="Ej. Domingo 18:00" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <Button type="submit" disabled={opening || !label.trim()}>
                {opening && <Loader2 className="size-4 animate-spin" />}
                Abrir
              </Button>
            </form>
            <div className="border-t pt-2">
              <Button variant="outline" size="sm" onClick={() => setEventOpen(true)}>
                <CalendarRange className="size-4" />
                Campamento o evento fuera de servicio
              </Button>
            </div>
          </div>
        )}
        <EventDialog
          open={eventOpen}
          onClose={() => setEventOpen(false)}
          onSubmit={async (v) => {
            await open(v.label, { kind: "event", date: v.date, endDate: v.endDate, location: v.location })
            setEventOpen(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {overview.access.canManage && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setEventOpen(true)}>
            <CalendarRange className="size-4" />
            Abrir campamento o evento
          </Button>
        </div>
      )}
      <EventDialog
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        onSubmit={async (v) => {
          await open(v.label, { kind: "event", date: v.date, endDate: v.endDate, location: v.location })
          setEventOpen(false)
        }}
      />
      {overview.openSessions.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {overview.openSessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn("press rounded-full border px-3 py-1.5 text-xs font-medium", s.id === sessionId ? "border-primary bg-primary/10 text-primary" : "hover:border-primary/40")}
            >
              {s.label} · {s.present}
            </button>
          ))}
        </div>
      )}
      <SessionView key={sessionId} sessionId={sessionId} rooms={overview.rooms} onChanged={onChanged} ministryId={ministryId} />
    </div>
  )
}

function SessionView({ sessionId, onChanged, ministryId }: { sessionId: string; rooms: RoomDto[]; onChanged: () => Promise<void>; ministryId: string }) {
  const [detail, setDetail] = useState<SessionDetailDto | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [preset, setPreset] = useState<{ childId: string } | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  const [chat, setChat] = useState<{ childId: string; name: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ detail: SessionDetailDto }>(`/api/kids/sessions/${sessionId}`)
      setDetail(d.detail)
    } catch (e) {
      swalError("No se pudo cargar el servicio", errorMessage(e))
    }
  }, [sessionId])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const refresh = useCallback(async () => {
    await Promise.all([load(), onChanged()])
  }, [load, onChanged])

  const close = async () => {
    const yes = await swalConfirm("¿Cerrar el servicio?", "Ya no se podrán registrar entradas ni salidas.", { confirmText: "Cerrar servicio", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/kids/sessions/${sessionId}`, { method: "PATCH", body: JSON.stringify({ action: "close" }) })
      notify.success("Servicio cerrado")
      await onChanged()
    } catch (e) {
      swalError("No se pudo cerrar", errorMessage(e))
    }
  }

  const assign = async (roomId: string, memberId: string, role: "teacher" | "support", remove = false) => {
    try {
      await apiJson(`/api/kids/sessions/${sessionId}/staff`, { method: "POST", body: JSON.stringify({ roomId, memberId, role, remove }) })
      await load()
    } catch (e) {
      swalError("No se pudo asignar", errorMessage(e))
    }
  }

  const byRoom = useMemo(() => {
    const map = new Map<string, AttendanceDto[]>()
    for (const a of detail?.attendance ?? []) map.set(a.roomId, [...(map.get(a.roomId) ?? []), a])
    return map
  }, [detail])

  if (!detail) return <Skeleton className="h-56 w-full" />
  const inside = detail.attendance.filter((a) => !a.checkOutAt).length
  const left = detail.attendance.length - inside
  const activeRooms = detail.rooms.filter((r) => r.isActive || byRoom.has(r.id))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{detail.session.label}</p>
          <p className="text-xs text-muted-foreground first-letter:uppercase">
            {fmtDay(detail.session.date)}
            {detail.session.endDate ? ` al ${fmtDay(detail.session.endDate)}` : ""} · {inside} dentro · {left} salieron
            {detail.session.location ? ` · ${detail.session.location}` : ""}
          </p>
        </div>
        <Button
          onClick={() => {
            setPreset(null)
            setScanOpen(true)
          }}
        >
          <ScanLine className="size-4" />
          Escanear QR
        </Button>
        <Button variant="outline" onClick={() => setPickOpen(true)}>
          <UserPlus className="size-4" />
          Dar entrada
        </Button>
        {detail.access.canManage && (
          <Button variant="ghost" onClick={() => void close()}>
            Cerrar servicio
          </Button>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {activeRooms.map((room) => {
          const rows = byRoom.get(room.id) ?? []
          const present = rows.filter((r) => !r.checkOutAt)
          const gone = rows.filter((r) => r.checkOutAt)
          const teacher = detail.staff.find((s) => s.roomId === room.id && s.role === "teacher")
          const support = detail.staff.find((s) => s.roomId === room.id && s.role === "support")
          const team = detail.team.map((t) => ({ value: t.memberId, label: t.fullName }))
          return (
            <section key={room.id} className="space-y-2 rounded-2xl border bg-card p-3">
              <div className="flex items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{room.name}</h3>
                <StatusPill tone={present.length > 0 ? "success" : "neutral"} dot={false}>
                  {present.length} dentro
                </StatusPill>
              </div>
              {detail.access.canManage ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <FormCombobox
                    ariaLabel={`Maestro de ${room.name}`}
                    label="Maestro"
                    options={team}
                    value={teacher?.memberId ?? ""}
                    placeholder="Sin asignar"
                    onChange={(v) => void assign(room.id, v, "teacher")}
                    onClear={() => teacher && void assign(room.id, teacher.memberId, "teacher", true)}
                  />
                  <FormCombobox
                    ariaLabel={`Apoyo de ${room.name}`}
                    label="Apoyo"
                    options={team}
                    value={support?.memberId ?? ""}
                    placeholder="Sin asignar"
                    onChange={(v) => void assign(room.id, v, "support")}
                    onClear={() => support && void assign(room.id, support.memberId, "support", true)}
                  />
                </div>
              ) : (
                (teacher || support) && (
                  <p className="text-xs text-muted-foreground">
                    {[teacher && `Maestro: ${teacher.fullName}`, support && `Apoyo: ${support.fullName}`].filter(Boolean).join(" · ")}
                  </p>
                )
              )}
              {present.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Sin niños dentro.</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {present.map((a) => (
                    <PresentRow
                      key={a.id}
                      a={a}
                      canExit={detail.access.canAuthorizeExit}
                      onExit={() => {
                        setPreset({ childId: a.childId })
                        setScanOpen(true)
                      }}
                      onChat={() => setChat({ childId: a.childId, name: a.fullName })}
                    />
                  ))}
                </ul>
              )}
              {gone.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Salieron: {gone.map((g) => `${g.fullName} (${fmtTime(g.checkOutAt!)})`).join(", ")}
                </p>
              )}
            </section>
          )
        })}
      </div>

      <KidsScannerDialog
        sessionId={sessionId}
        open={scanOpen}
        preset={preset}
        canAuthorizeExit={detail.access.canAuthorizeExit}
        rooms={detail.rooms}
        onClose={() => {
          setScanOpen(false)
          setPreset(null)
        }}
        onDone={refresh}
      />
      <ChildPickerDialog
        ministryId={ministryId}
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        onPick={(childId) => {
          setPickOpen(false)
          setPreset({ childId })
          setScanOpen(true)
        }}
      />
      <KidsMessagesDialog
        staff
        open={chat !== null}
        childId={chat?.childId ?? null}
        childName={chat?.name ?? ""}
        sessionId={sessionId}
        onClose={() => setChat(null)}
        onChanged={undefined}
      />
    </div>
  )
}

function PresentRow({ a, canExit, onExit, onChat }: { a: AttendanceDto; canExit: boolean; onExit: () => void; onChat: () => void }) {
  const [open, setOpen] = useState(false)
  const checked = Object.entries(a.checklist).filter(([, v]) => v).map(([k]) => k)
  return (
    <li className="p-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{a.fullName}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {a.ageLabel} · entró {fmtTime(a.checkInAt)}
            </span>
          </span>
          {a.indications && <ShieldAlert className="size-4 shrink-0 text-warning-ink" aria-label="Tiene indicaciones" />}
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        <Button size="icon-sm" variant="ghost" aria-label={`Avisar a los papás de ${a.fullName}`} onClick={onChat} className="relative">
          <BellRing className="size-4" />
          {a.unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-destructive text-[0.6rem] text-white">{a.unread}</span>}
        </Button>
        {canExit && (
          <Button size="icon-sm" variant="outline" aria-label={`Salida de ${a.fullName}`} onClick={onExit}>
            <LogOut className="size-4" />
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-1 space-y-1.5 rounded-xl bg-muted/60 p-2.5 text-xs">
          {a.indications && (
            <p className="whitespace-pre-line">
              <span className="font-semibold">Indicaciones:</span> {a.indications}
            </p>
          )}
          {a.section === "baby" && (
            <p>
              <span className="font-semibold">Trajo:</span> {checked.length > 0 ? checked.join(", ") : "—"}
            </p>
          )}
          {a.note && (
            <p>
              <span className="font-semibold">Nota:</span> {a.note}
            </p>
          )}
          <p>
            <span className="font-semibold">Papás:</span> {a.guardians.map((g) => `${g.fullName}${g.phone ? ` (${g.phone})` : ""}`).join(", ") || "—"}
          </p>
        </div>
      )}
    </li>
  )
}

function ChildPickerDialog({ ministryId, open, onClose, onPick }: { ministryId: string; open: boolean; onClose: () => void; onPick: (childId: string) => void }) {
  const [q, setQ] = useState("")
  const [rows, setRows] = useState<ChildDto[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const d = await apiJson<{ children: ChildDto[] }>(`/api/kids/${ministryId}/children?q=${encodeURIComponent(q)}`)
        setRows(d.children.filter((c) => c.isActive))
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, open, ministryId])

  return (
    <DialogComponent open={open} onOpenChange={(o) => !o && onClose()} title="Dar entrada sin QR" description="Busca al niño por su nombre.">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del niño…" aria-label="Buscar niño" className="pl-9 md:pl-9 desk:pl-9" autoFocus />
        </div>
        <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border">
          {loading && (
            <li className="flex justify-center p-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </li>
          )}
          {!loading && rows.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin resultados.</li>}
          {rows.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c.id)} className="flex min-h-12 w-full flex-col items-start justify-center px-3 py-2 text-left hover:bg-muted">
                <span className="text-sm font-medium">{c.fullName}</span>
                <span className="text-xs text-muted-foreground">
                  {c.ageLabel}
                  {c.roomName ? ` · ${c.roomName}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </DialogComponent>
  )
}

// ── Niños ─────────────────────────────────────────────────────────────────────

function ChildrenTab({ ministryId, rooms, canManage, onChanged }: { ministryId: string; rooms: RoomDto[]; canManage: boolean; onChanged: () => Promise<void> }) {
  const [children, setChildren] = useState<ChildDto[] | null>(null)
  const [q, setQ] = useState("")
  const [form, setForm] = useState<ChildDto | "new" | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ children: ChildDto[] }>(`/api/kids/${ministryId}/children?q=${encodeURIComponent(q)}`)
      setChildren(d.children)
    } catch (e) {
      setChildren([])
      swalError("No se pudieron cargar los niños", errorMessage(e))
    }
  }, [ministryId, q])

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const detail = children?.find((c) => c.id === detailId) ?? null
  const refresh = async () => {
    await Promise.all([load(), onChanged()])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar niño…" aria-label="Buscar niño" className="pl-9 md:pl-9 desk:pl-9" />
        </div>
        <Button className="ml-auto" onClick={() => setForm("new")}>
          <Plus className="size-4" />
          Registrar niño
        </Button>
      </div>

      {children === null ? (
        <Skeleton className="h-40 w-full" />
      ) : children.length === 0 ? (
        <EmptyState icon={Baby} title="Aún no hay niños" description="Registra a los niños con su papá, mamá o tutor para generar su QR." />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {children.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setDetailId(c.id)}
                className={cn("press flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left hover:border-primary/40", !c.isActive && "opacity-60")}
              >
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Baby className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.fullName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.ageLabel}
                    {c.roomName ? ` · ${c.roomName}` : " · sin salón"}
                    {!c.isActive ? " · de baja" : ""}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{c.guardians.map((g) => g.fullName).join(", ") || "Sin tutor"}</span>
                </span>
                {c.indications && <ShieldAlert className="size-4 shrink-0 text-warning-ink" aria-label="Tiene indicaciones" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ChildFormDialog
        mode="staff"
        ministryId={ministryId}
        child={form === "new" ? null : form}
        open={form !== null}
        rooms={rooms.filter((r) => r.isActive)}
        onClose={() => setForm(null)}
        onSaved={refresh}
      />
      <ChildDetailDialog
        ministryId={ministryId}
        child={detail}
        canManage={canManage}
        onClose={() => setDetailId(null)}
        onEdit={(c) => {
          setDetailId(null)
          setForm(c)
        }}
        onChanged={refresh}
      />
    </div>
  )
}

function ChildDetailDialog({
  ministryId,
  child,
  canManage,
  onClose,
  onEdit,
  onChanged,
}: {
  ministryId: string
  child: ChildDto | null
  canManage: boolean
  onClose: () => void
  onEdit: (c: ChildDto) => void
  onChanged: () => Promise<void>
}) {
  const [relation, setRelation] = useState("Padre/Madre")

  const addGuardian = async (memberId: string) => {
    if (!child) return
    try {
      await apiJson(`/api/kids/children/${child.id}/guardians`, { method: "POST", body: JSON.stringify({ memberId, relation }) })
      notify.success("Tutor vinculado")
      await onChanged()
    } catch (e) {
      swalError("No se pudo vincular", errorMessage(e))
    }
  }
  const removeGuardian = async (memberId: string, name: string) => {
    if (!child) return
    const yes = await swalConfirm(`¿Quitar a «${name}» como tutor?`, undefined, { confirmText: "Quitar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/kids/children/${child.id}/guardians?memberId=${memberId}`, { method: "DELETE" })
      await onChanged()
    } catch (e) {
      swalError("No se pudo quitar", errorMessage(e))
    }
  }
  const toggleActive = async () => {
    if (!child) return
    try {
      await apiJson(`/api/kids/children/${child.id}`, { method: "PUT", body: JSON.stringify({ isActive: !child.isActive }) })
      await onChanged()
    } catch (e) {
      swalError("No se pudo actualizar", errorMessage(e))
    }
  }

  return (
    <DialogComponent
      open={child !== null}
      onOpenChange={(o) => !o && onClose()}
      title={child?.fullName ?? "Niño"}
      description={child ? `${child.ageLabel}${child.roomName ? ` · ${child.roomName}` : ""}` : undefined}
      className="max-w-[90vw]"
    >
      {child && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-1 rounded-2xl border bg-white p-3">
            <QrImage token={child.qrToken} size={200} />
            <p className="text-xs text-neutral-600">QR para entrada y salida</p>
          </div>
          {child.indications && (
            <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" />
              <span className="whitespace-pre-line">{child.indications}</span>
            </p>
          )}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Papás o tutores</h3>
            {child.guardians.length === 0 && <p className="text-sm text-muted-foreground">Sin tutor vinculado.</p>}
            <ul className="space-y-1.5">
              {child.guardians.map((g) => (
                <li key={g.memberId} className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {g.relation}
                      {g.phone ? ` · ${g.phone}` : ""}
                      {!g.hasAccess ? " · sin acceso a la app" : ""}
                    </span>
                  </span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Quitar a ${g.fullName}`} onClick={() => void removeGuardian(g.memberId, g.fullName)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="space-y-2 rounded-xl bg-muted/50 p-2.5">
              <FormCombobox label="Parentesco" options={RELATION_OPTIONS} value={relation} onChange={setRelation} clearable={false} />
              <GuardianPicker ministryId={ministryId} onPick={(m) => void addGuardian(m.id)} />
            </div>
          </section>
          <div className="flex flex-wrap justify-end gap-2">
            {canManage && (
              <Button variant="ghost" onClick={() => void toggleActive()}>
                {child.isActive ? "Dar de baja" : "Reactivar"}
              </Button>
            )}
            <Button variant="outline" onClick={() => onEdit(child)}>
              Editar datos
            </Button>
          </div>
        </div>
      )}
    </DialogComponent>
  )
}

// ── Salones ───────────────────────────────────────────────────────────────────

const roomSchema = yup.object({
  name: yup.string().trim().required("Escribe el nombre").max(60),
  section: yup.string().oneOf(["baby", "child"]).required(),
  minAgeMonths: yup.number().typeError("Número").integer().min(0, "Mínimo 0").required("Requerido"),
  maxAgeMonths: yup
    .number()
    .typeError("Número")
    .integer()
    .required("Requerido")
    .when("minAgeMonths", ([min], s) => s.min(Number(min) || 0, "Debe ser mayor o igual al inicio")),
  isActive: yup.boolean().default(true),
})
type RoomValues = yup.InferType<typeof roomSchema>

function RoomsTab({ ministryId, rooms, canManage, onChanged }: { ministryId: string; rooms: RoomDto[]; canManage: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<RoomDto | "new" | null>(null)
  const yearsText = (m: number) => (m < 24 ? `${m} m` : `${(m / 12).toFixed(m % 12 === 0 ? 0 : 1)} años`)
  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Nuevo salón
          </Button>
        </div>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {rooms.map((r) => (
          <li key={r.id} className={cn("flex items-center gap-3 rounded-2xl border bg-card p-3", !r.isActive && "opacity-60")}>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{r.name}</span>
              <span className="block text-xs text-muted-foreground">
                De {yearsText(r.minAgeMonths)} a {yearsText(r.maxAgeMonths + 1)} · {r.section === "baby" ? "Bebés (con lista de verificación)" : "Niños"}
                {!r.isActive ? " · inactivo" : ""}
              </span>
            </span>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                Editar
              </Button>
            )}
          </li>
        ))}
      </ul>
      <RoomDialog ministryId={ministryId} room={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  )
}

function RoomDialog({ ministryId, room, onClose, onSaved }: { ministryId: string; room: RoomDto | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const formId = useId()
  const { focusFirstInvalid } = useFocusInvalid()
  const current = room && room !== "new" ? room : null
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RoomValues>({ resolver: yupResolver(roomSchema) as never })

  useEffect(() => {
    if (room === null) return
    reset({
      name: current?.name ?? "",
      section: current?.section ?? "child",
      minAgeMonths: current?.minAgeMonths ?? 0,
      maxAgeMonths: current?.maxAgeMonths ?? 0,
      isActive: current?.isActive ?? true,
    })
  }, [room, current, reset])

  const submit = async (v: RoomValues) => {
    try {
      await apiJson(`/api/kids/${ministryId}/rooms`, { method: "POST", body: JSON.stringify({ ...v, id: current?.id, sortOrder: current?.sortOrder ?? 99 }) })
      notify.success("Salón guardado")
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    }
  }

  return (
    <DialogComponent
      open={room !== null}
      onOpenChange={(o) => !o && onClose()}
      title={current ? "Editar salón" : "Nuevo salón"}
      description="El salón de cada niño se deduce por su edad (en meses)."
      footer={
        <>
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
        <div className="sm:col-span-2" data-form-field="name">
          <InputGroupField id="name" label="Nombre" required error={errors.name?.message} {...register("name")} />
        </div>
        <div data-form-field="minAgeMonths">
          <InputGroupField id="minAgeMonths" label="Desde (meses)" inputMode="numeric" error={errors.minAgeMonths?.message} {...register("minAgeMonths")} />
        </div>
        <div data-form-field="maxAgeMonths">
          <InputGroupField id="maxAgeMonths" label="Hasta (meses)" inputMode="numeric" helper="12 meses = 1 año" error={errors.maxAgeMonths?.message} {...register("maxAgeMonths")} />
        </div>
        <div className="sm:col-span-2">
          <Controller
            control={control}
            name="section"
            render={({ field }) => (
              <FormCombobox
                label="Tipo"
                options={[
                  { value: "baby", label: "Bebés (pide lista de verificación)" },
                  { value: "child", label: "Niños" },
                ]}
                value={field.value}
                onChange={field.onChange}
                clearable={false}
              />
            )}
          />
        </div>
        {current && (
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => <SwitchField label="Activo" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
        )}
      </form>
    </DialogComponent>
  )
}

// ── Evento fuera de servicio ──────────────────────────────────────────────────

function EventDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (v: { label: string; date: string; endDate: string | null; location: string | null }) => Promise<void>
}) {
  const [label, setLabel] = useState("")
  const [location, setLocation] = useState("")
  const [date, setDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setLabel("")
      setLocation("")
      setDate(new Date())
      setEndDate(null)
    }
  }, [open])

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Campamento o evento"
      description="Actividad de Kids fuera de un servicio. Se registra la entrada y la salida igual que en un servicio."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !label.trim() || !date}
            onClick={async () => {
              setSaving(true)
              try {
                await onSubmit({ label: label.trim(), date: ymdOfLocal(date!), endDate: endDate ? ymdOfLocal(endDate) : null, location: location.trim() || null })
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Abrir evento
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <InputGroupField label="Nombre" required placeholder="Ej. Campamento de verano" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <DatePicker label="Inicia" required value={date} onChange={setDate} />
        <DatePicker label="Termina (opcional)" value={endDate} onChange={setEndDate} onClear={() => setEndDate(null)} disabledBefore={date ?? undefined} />
        <div className="sm:col-span-2">
          <InputGroupField label="Lugar" placeholder="Ej. Campamento Los Pinos" value={location} maxLength={150} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
    </DialogComponent>
  )
}

// ── Asistencia (reporte mensual por salón) ────────────────────────────────────

function ReportTab({ ministryId, overview }: { ministryId: string; overview: KidsOverviewDto }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [report, setReport] = useState<KidsReportDto | null>(null)

  useEffect(() => {
    let alive = true
    apiJson<{ report: KidsReportDto }>(`/api/kids/${ministryId}/report?month=${month}`)
      .then((d) => alive && setReport(d.report))
      .catch((e) => {
        if (alive) {
          setReport(null)
          swalError("No se pudo cargar el reporte", errorMessage(e))
        }
      })
    return () => {
      alive = false
    }
  }, [ministryId, month, overview])

  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number)
    setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7))
  }
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString("es-MX", { month: "long", year: "numeric" })

  const exportCsv = () => {
    if (!report) return
    const head = ["Fecha", "Servicio", "Tipo", ...report.rooms.map((r) => r.name), "Total"]
    const lines = report.sessions.map((x) => [x.date, x.label, x.kind === "event" ? "Evento" : "Servicio", ...report.rooms.map((r) => x.byRoom[r.id] ?? 0), x.total])
    lines.push(["", "Total del mes", "", ...report.rooms.map((r) => report.totalsByRoom[r.id] ?? 0), report.totalAttendances])
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const csv = "\uFEFF" + [head, ...lines].map((l) => l.map(esc).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `kids-asistencia-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="outline" aria-label="Mes anterior" onClick={() => shift(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-0 flex-1 text-center font-heading text-sm font-semibold first-letter:uppercase">{monthLabel}</p>
        <Button size="icon-sm" variant="outline" aria-label="Mes siguiente" onClick={() => shift(1)}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={!report || report.sessions.length === 0} onClick={exportCsv}>
          <Download className="size-4" />
          CSV
        </Button>
      </div>

      {!report ? (
        <Skeleton className="h-40 w-full" />
      ) : report.sessions.length === 0 ? (
        <EmptyState icon={QrCode} title="Sin servicios este mes" description="Aquí verás la asistencia de cada servicio por salón." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Asistencias", value: report.totalAttendances },
              { label: "Niños distintos", value: report.uniqueChildren },
              { label: "Promedio por servicio", value: report.averagePerSession },
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
                  <th className="px-3 py-2 text-left font-medium">Servicio</th>
                  {report.rooms.map((r) => (
                    <th key={r.id} className="px-3 py-2 text-right font-medium">
                      {r.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.sessions.map((x) => (
                  <tr key={x.id}>
                    <td className="px-3 py-2">
                      <span className="block font-medium">{x.label}</span>
                      <span className="block text-xs text-muted-foreground first-letter:uppercase">
                        {fmtDay(x.date)}
                        {x.kind === "event" ? " · evento" : ""}
                      </span>
                    </td>
                    {report.rooms.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-right tabular-nums">
                        {x.byRoom[r.id] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{x.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-semibold">
                <tr>
                  <td className="px-3 py-2">Total del mes</td>
                  {report.rooms.map((r) => (
                    <td key={r.id} className="px-3 py-2 text-right tabular-nums">
                      {report.totalsByRoom[r.id] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums">{report.totalAttendances}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
