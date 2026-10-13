"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import QRCode from "qrcode"
import {
  ArrowLeft,
  Ban,
  Box,
  Check,
  CircleDollarSign,
  Receipt,
  ClipboardList,
  Clock,
  HandHeart,
  Loader2,
  LogIn,
  Map as MapIcon,
  Plus,
  ScanLine,
  Settings2,
  Ticket,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { Attachment } from "@/components/base/attachment"
import { DatePicker } from "@/components/base/date-picker"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { uploadFile } from "@/lib/uploads"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { EventDetailDto, ExpenseDto, ItineraryDto, TicketDto, VenueDto } from "@/lib/events/server"
import { EventFormDialog, STATUS_LABEL, STATUS_TONE, money } from "./events-admin"
import { SeatLegend, SeatMap } from "./seat-map"
import { EventStaffTab } from "./event-staff"
import { cn } from "@/lib/utils"
import { GROWTH_CHECK_LABEL, growthCheckForEventKind } from "@/lib/school/growth-rules"
import type { GrowthResultDto } from "@/lib/school/growth"
import type { EventGroupDto } from "@/lib/events/server"

// Un evento: el personal (o el líder del grupo) lo configura, arma el itinerario y
// el material, emite boletos, cobra, acomoda y da entrada con QR. Quien asiste ve
// la información, aparta su boleto y, si el evento lo permite, elige su lugar.

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
const KIND_LABEL = { activity: "Actividad", clinic: "Clínica", break: "Pausa", meal: "Comida" } as const
const METHOD_LABEL = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", other: "Otro" } as const

export function EventWorkspace({ eventId, backHref }: { eventId: string; backHref: string }) {
  const [event, setEvent] = useState<EventDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [venues, setVenues] = useState<VenueDto[]>([])
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ event: EventDetailDto }>(`/api/events/${eventId}`)
      setEvent(d.event)
    } catch (e) {
      setError(errorMessage(e, "No se pudo abrir el evento"))
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = async () => {
    try {
      const d = await apiJson<{ venues: VenueDto[] }>("/api/events/venues")
      setVenues(d.venues)
    } catch {
      setVenues([])
    }
    setEditOpen(true)
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
        <EmptyState icon={Ban} title="No se pudo abrir el evento" description={error} />
      </div>
    )
  }
  if (!event) return <Skeleton className="h-64 w-full" />

  const staff = event.tickets !== null || event.access.canManage

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={backHref}>
          <ArrowLeft className="size-4" />
          Eventos
        </Link>
      </Button>

      <div className="flex flex-wrap items-start gap-3">
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Ticket className="size-7" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">{event.name}</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{fmtDateTime(event.startsAt)}</p>
          <p className="text-xs text-muted-foreground">
            {[event.kind, event.groupName, event.venueName ?? event.location, event.scope === "external" ? "Externo" : "Interno"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusPill tone={STATUS_TONE[event.status]}>{STATUS_LABEL[event.status]}</StatusPill>
        {event.access.canManage && (
          <Button variant="outline" size="sm" onClick={() => void openEdit()}>
            <Settings2 className="size-4" />
            Configurar
          </Button>
        )}
      </div>

      {staff ? <StaffTabs event={event} onChanged={load} /> : <AttendeeView event={event} onChanged={load} />}

      <EventFormDialog open={editOpen} event={event} venues={venues} onClose={() => setEditOpen(false)} onSaved={load} />
    </div>
  )
}

// ── Vista del personal ────────────────────────────────────────────────────────

function StaffTabs({ event, onChanged }: { event: EventDetailDto; onChanged: () => Promise<void> }) {
  const canManage = event.access.canManage
  return (
    <Tabs defaultValue="summary">
      <TabsList>
        <TabsTrigger value="summary">
          <ClipboardList className="size-4" /> Resumen
        </TabsTrigger>
        {event.access.canManage && (
          <TabsTrigger value="staff">
            <HandHeart className="size-4" /> Servidores
          </TabsTrigger>
        )}
        <TabsTrigger value="itinerary">
          <Clock className="size-4" /> Itinerario
        </TabsTrigger>
        <TabsTrigger value="tickets">
          <Ticket className="size-4" /> Boletos
        </TabsTrigger>
        {event.seating !== "free" && (
          <TabsTrigger value="seating">
            <MapIcon className="size-4" /> Acomodo
          </TabsTrigger>
        )}
        {canManage && (
          <TabsTrigger value="expenses">
            <Receipt className="size-4" /> Gastos
          </TabsTrigger>
        )}
        {event.access.canCheckin && (
          <TabsTrigger value="entry">
            <ScanLine className="size-4" /> Entrada
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="summary">
        <SummaryTab event={event} onChanged={onChanged} />
      </TabsContent>
      {event.access.canManage && (
        <TabsContent value="staff">
          <EventStaffTab eventId={event.id} canManage={event.access.canManage} />
        </TabsContent>
      )}
      <TabsContent value="itinerary">
        <ItineraryTab event={event} canManage={canManage} onChanged={onChanged} />
      </TabsContent>
      <TabsContent value="tickets">
        <TicketsTab event={event} canManage={canManage} onChanged={onChanged} />
      </TabsContent>
      {event.seating !== "free" && (
        <TabsContent value="seating">
          <SeatingTab event={event} canManage={canManage} onChanged={onChanged} />
        </TabsContent>
      )}
      {canManage && (
        <TabsContent value="expenses">
          <ExpensesTab event={event} onChanged={onChanged} />
        </TabsContent>
      )}
      {event.access.canCheckin && (
        <TabsContent value="entry">
          <EntryTab event={event} onChanged={onChanged} />
        </TabsContent>
      )}
    </Tabs>
  )
}

function SummaryTab({ event, onChanged }: { event: EventDetailDto; onChanged: () => Promise<void> }) {
  const s = event.stats
  const check = growthCheckForEventKind(event.kind)
  const isLaunch = check === "launch"
  const [finishing, setFinishing] = useState(false)
  const [growth, setGrowth] = useState<GrowthResultDto | null>(null)
  const finish = async () => {
    const yes = await swalConfirm(
      check ? `¿Finalizar «${GROWTH_CHECK_LABEL[check]}»?` : "¿Finalizar el evento?",
      check
        ? "Se marcará el avance en el crecimiento de quienes registraron su entrada" + (isLaunch ? " y se entregará el diploma a quienes completaron todos los libros." : ".")
        : undefined,
      { confirmText: "Finalizar" }
    )
    if (!yes) return
    setFinishing(true)
    try {
      const r = await apiJson<{ growth: GrowthResultDto | null }>(`/api/events/${event.id}/finish`, { method: "POST" })
      notify.success("Evento finalizado")
      if (r.growth) setGrowth(r.growth)
      await onChanged()
    } catch (e) {
      swalError("No se pudo finalizar", errorMessage(e))
    } finally {
      setFinishing(false)
    }
  }
  const setStatus = async (status: string, confirm?: string) => {
    if (confirm) {
      const yes = await swalConfirm(confirm, undefined, { confirmText: "Continuar", danger: status === "cancelled" })
      if (!yes) return
    }
    try {
      await apiJson(`/api/events/${event.id}/status`, { method: "POST", body: JSON.stringify({ status }) })
      notify.success("Estado actualizado")
      await onChanged()
    } catch (e) {
      swalError("No se pudo cambiar el estado", errorMessage(e))
    }
  }
  const tiles = [
    { label: "Boletos", value: event.effectiveCapacity ? `${s.taken} / ${event.effectiveCapacity}` : String(s.taken) },
    { label: "Liquidados", value: String(s.paid) },
    { label: "Entradas", value: String(s.checkedIn) },
    { label: "Por cobrar", value: money(s.pending) },
    ...(event.access.canManage ? [{ label: "Gastos", value: money(s.expenses) }, { label: "Resultado", value: money(s.net) }] : []),
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border bg-card p-3">
            <p className="font-heading text-xl font-semibold tabular-nums">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>
      {event.price > 0 && (
        <p className="text-sm text-muted-foreground">
          Esperado {money(s.expected)} · cobrado <span className="font-medium text-foreground">{money(s.collected)}</span> · pendiente {money(s.pending)}
        </p>
      )}
      <dl className="grid gap-3 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-2">
        <Info label="Costo" value={event.price > 0 ? money(event.price) : "Sin costo"} />
        <Info label="Público" value={{ open: "Abierto a todos", leaders: "Solo líderes", ministries: "Ministerios elegidos" }[event.audience]} />
        <Info label="Acomodo" value={{ free: "Libre", sections: "Por secciones", seats: "Asientos o mesas del plano" }[event.seating]} />
        <Info label="Registro en línea" value={event.selfRegistration ? "Activo" : "Solo con el personal"} />
        {event.topic && <Info label="Tema" value={event.topic} />}
        {event.description && <Info label="Descripción" value={event.description} wide />}
      </dl>
      {event.access.canManage && (
        <div className="flex flex-wrap gap-2">
          {event.status === "draft" && <Button onClick={() => void setStatus("published")}>Publicar evento</Button>}
          {event.status === "published" && (
            <Button variant="outline" onClick={() => void setStatus("closed", "¿Cerrar el registro del evento?")}>
              Cerrar registro
            </Button>
          )}
          {(event.status === "published" || (event.status === "closed" && check !== null)) && (
            <Button onClick={() => void finish()} disabled={finishing}>
              {finishing && <Loader2 className="size-4 animate-spin" />}
              {event.status === "closed"
                ? "Volver a verificar y marcar"
                : isLaunch
                  ? "Finalizar y entregar diplomas"
                  : check
                    ? "Finalizar y marcar el avance"
                    : "Finalizar evento"}
            </Button>
          )}
          {(event.status === "closed" || event.status === "cancelled") && (
            <Button variant="outline" onClick={() => void setStatus("published")}>
              Reabrir
            </Button>
          )}
          {event.status !== "cancelled" && event.status !== "draft" && (
            <Button variant="ghost" onClick={() => void setStatus("cancelled", "¿Cancelar el evento?")}>
              Cancelar evento
            </Button>
          )}
          {event.status === "published" && (
            <Button variant="ghost" onClick={() => void setStatus("draft")}>
              Volver a borrador
            </Button>
          )}
        </div>
      )}
      {check === "baptism" && event.access.canManage && <BaptismGroups eventId={event.id} />}
      <DialogComponent
        open={growth !== null}
        onOpenChange={(o) => !o && setGrowth(null)}
        size="lg"
        title={growth ? `${GROWTH_CHECK_LABEL[growth.check]}: resultado` : "Resultado"}
        footer={<Button onClick={() => setGrowth(null)}>Listo</Button>}
      >
        {growth && (
          <div className="space-y-4 text-sm">
            <p>
              Se marcó el avance a <span className="font-semibold">{growth.marked.length}</span> persona{growth.marked.length === 1 ? "" : "s"}
              {growth.already > 0 ? ` · ${growth.already} ya lo tenía${growth.already === 1 ? "" : "n"}` : ""}
              {growth.absent > 0 ? ` · ${growth.absent} con boleto sin entrada (no se marcan)` : ""}.
            </p>
            {growth.marked.length > 0 && (
              <ul className="divide-y rounded-xl border">
                {growth.marked.map((m) => (
                  <li key={m.memberId} className="px-3 py-2">
                    {m.name}
                  </li>
                ))}
              </ul>
            )}
            {growth.diplomas && (
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">{growth.diplomas.issued.length}</span> diploma{growth.diplomas.issued.length === 1 ? "" : "s"} entregado{growth.diplomas.issued.length === 1 ? "" : "s"}
                  {growth.diplomas.already > 0 ? ` · ${growth.diplomas.already} ya lo tenía${growth.diplomas.already === 1 ? "" : "n"}` : ""}.
                </p>
                {growth.diplomas.issued.length > 0 && (
                  <ul className="divide-y rounded-xl border">
                    {growth.diplomas.issued.map((i) => (
                      <li key={i.memberId} className="flex items-center gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate">{i.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{i.serial}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {growth.diplomas.pending.length > 0 && (
                  <>
                    <p className="font-medium">Asistieron pero aún no completan los libros</p>
                    <ul className="divide-y rounded-xl border">
                      {growth.diplomas.pending.map((p) => (
                        <li key={p.memberId} className="flex items-center gap-2 px-3 py-2">
                          <span className="min-w-0 flex-1 truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {p.passed}/{p.total} libros
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">Cuando aprueben el último libro, usa «Volver a verificar y marcar» para entregarles el diploma.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </DialogComponent>
    </div>
  )
}

/** Quién viene a bautizarse, agrupado por célula, para organizar el festejo. */
function BaptismGroups({ eventId }: { eventId: string }) {
  const [groups, setGroups] = useState<EventGroupDto[] | null>(null)
  useEffect(() => {
    apiJson<{ groups: EventGroupDto[] }>(`/api/events/${eventId}/groups`)
      .then((r) => setGroups(r.groups))
      .catch(() => setGroups([]))
  }, [eventId])
  if (!groups) return <Skeleton className="h-24 w-full" />
  if (groups.length === 0) return null
  return (
    <section className="space-y-2">
      <h3 className="font-heading text-base font-semibold">Bautizandos por célula</h3>
      <p className="text-sm text-muted-foreground">Para que cada célula organice su festejo breve.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.name} className="rounded-2xl border bg-card p-3">
            <p className="text-sm font-semibold">
              {g.name} <span className="font-normal text-muted-foreground">· {g.people.length}</span>
            </p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {g.people.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.checkedIn && <span className="text-xs text-emerald-700">Presente</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line">{value}</dd>
    </div>
  )
}

// ── Itinerario y material ─────────────────────────────────────────────────────

function ItineraryTab({ event, canManage, onChanged }: { event: EventDetailDto; canManage: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<ItineraryDto | "new" | null>(null)
  const [item, setItem] = useState("")
  const general = event.checklist.filter((c) => !c.itineraryId)
  const doneCount = event.checklist.filter((c) => c.isDone).length

  const toggle = async (id: string, isDone: boolean) => {
    try {
      await apiJson(`/api/events/${event.id}/checklist/${id}`, { method: "PATCH", body: JSON.stringify({ isDone }) })
      await onChanged()
    } catch (e) {
      swalError("No se pudo actualizar", errorMessage(e))
    }
  }
  const removeItem = async (id: string) => {
    try {
      await apiJson(`/api/events/${event.id}/checklist/${id}`, { method: "PATCH", body: JSON.stringify({ remove: true }) })
      await onChanged()
    } catch (e) {
      swalError("No se pudo quitar", errorMessage(e))
    }
  }
  const addItem = async (title: string, itineraryId: string | null) => {
    if (!title.trim()) return
    try {
      await apiJson(`/api/events/${event.id}/checklist`, { method: "POST", body: JSON.stringify({ title, itineraryId }) })
      await onChanged()
    } catch (e) {
      swalError("No se pudo agregar", errorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Agregar actividad
          </Button>
        </div>
      )}
      {event.itinerary.length === 0 ? (
        <EmptyState icon={Clock} title="Sin itinerario" description="Agrega las actividades, clínicas, pausas y comidas con su hora y responsable." />
      ) : (
        <ol className="space-y-2">
          {event.itinerary.map((i) => {
            const mine = event.checklist.filter((c) => c.itineraryId === i.id)
            return (
              <li key={i.id} className="space-y-2 rounded-2xl border bg-card p-3">
                <div className="flex items-start gap-3">
                  <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{fmtTime(i.startsAt)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {i.title}
                      <StatusPill tone={i.kind === "clinic" ? "info" : "neutral"} dot={false}>
                        {KIND_LABEL[i.kind]}
                      </StatusPill>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {i.durationMin} min{i.speakerName ? ` · ${i.speakerName}` : ""}
                      {i.location ? ` · ${i.location}` : ""}
                    </p>
                    {i.notes && <p className="mt-1 text-xs whitespace-pre-line">{i.notes}</p>}
                  </div>
                  {canManage && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
                      Editar
                    </Button>
                  )}
                </div>
                {canManage && i.kind === "clinic" && (
                  <ChecklistBox items={mine} title="Material de la clínica" onToggle={toggle} onRemove={removeItem} onAdd={(t) => addItem(t, i.id)} />
                )}
              </li>
            )
          })}
        </ol>
      )}
      {canManage && (
        <section className="space-y-2 rounded-2xl border p-3">
          <h3 className="text-sm font-semibold">
            Material y pendientes del evento{" "}
            <span className="font-normal text-muted-foreground">
              ({doneCount}/{event.checklist.length} listos)
            </span>
          </h3>
          <ChecklistBox items={general} title="" onToggle={toggle} onRemove={removeItem} onAdd={(t) => addItem(t, null)} value={item} onValue={setItem} />
        </section>
      )}
      <ItineraryDialog eventId={event.id} item={editing} defaultDate={event.startsAt} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  )
}

function ChecklistBox({
  items,
  title,
  onToggle,
  onRemove,
  onAdd,
  value,
  onValue,
}: {
  items: { id: string; title: string; isDone: boolean }[]
  title: string
  onToggle: (id: string, done: boolean) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onAdd: (title: string) => Promise<void>
  value?: string
  onValue?: (v: string) => void
}) {
  const [local, setLocal] = useState("")
  const text = value ?? local
  const setText = onValue ?? setLocal
  return (
    <div className="space-y-1.5 rounded-xl bg-muted/50 p-2.5">
      {title && <p className="text-xs font-semibold">{title}</p>}
      <ul className="space-y-1">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <label className="flex min-h-9 flex-1 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={c.isDone} onChange={(e) => void onToggle(c.id, e.target.checked)} />
              <span className={cn(c.isDone && "text-muted-foreground line-through")}>{c.title}</span>
            </label>
            <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${c.title}`} onClick={() => void onRemove(c.id)}>
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void onAdd(text).then(() => setText(""))
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Agregar material o pendiente…" aria-label="Nuevo material" maxLength={150} />
        <Button type="submit" size="sm" variant="outline" disabled={!text.trim()}>
          <Plus className="size-4" />
        </Button>
      </form>
    </div>
  )
}

function ItineraryDialog({
  eventId,
  item,
  defaultDate,
  onClose,
  onSaved,
}: {
  eventId: string
  item: ItineraryDto | "new" | null
  defaultDate: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const current = item && item !== "new" ? item : null
  const [title, setTitle] = useState("")
  const [startsAt, setStartsAt] = useState<Date | null>(null)
  const [duration, setDuration] = useState("30")
  const [kind, setKind] = useState("activity")
  const [speaker, setSpeaker] = useState("")
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item === null) return
    setTitle(current?.title ?? "")
    setStartsAt(current ? new Date(current.startsAt) : new Date(defaultDate))
    setDuration(String(current?.durationMin ?? 30))
    setKind(current?.kind ?? "activity")
    setSpeaker(current?.speakerName ?? "")
    setLocation(current?.location ?? "")
    setNotes(current?.notes ?? "")
  }, [item, current, defaultDate])

  const save = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/events/${eventId}/itinerary`, {
        method: "POST",
        body: JSON.stringify({ id: current?.id, title, startsAt: startsAt?.toISOString(), durationMin: Number(duration), kind, speakerName: speaker, location, notes }),
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
    if (!current) return
    const yes = await swalConfirm("¿Quitar esta actividad?", "También se quita su material.", { confirmText: "Quitar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/events/${eventId}/itinerary?id=${current.id}`, { method: "DELETE" })
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
      title={current ? "Editar actividad" : "Nueva actividad"}
      description="Una clínica es un tema con una actividad de ministración; puede llevar su material."
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
          <Button onClick={() => void save()} disabled={saving || !title.trim() || !startsAt}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <InputGroupField label="Actividad" required value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <DateTimePicker label="Inicia" required value={startsAt} onChange={setStartsAt} />
        <InputGroupField label="Duración (minutos)" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} />
        <FormCombobox
          label="Tipo"
          options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
          value={kind}
          onChange={setKind}
          clearable={false}
        />
        <InputGroupField label="Quién la da" value={speaker} maxLength={150} onChange={(e) => setSpeaker(e.target.value)} />
        <div className="sm:col-span-2">
          <InputGroupField label="Lugar o salón" value={location} maxLength={150} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="it-notes" className="text-sm font-medium">
            Notas
          </label>
          <Textarea id="it-notes" rows={2} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </DialogComponent>
  )
}

// ── Boletos y pagos ───────────────────────────────────────────────────────────

function TicketsTab({ event, canManage, onChanged }: { event: EventDetailDto; canManage: boolean; onChanged: () => Promise<void> }) {
  const [q, setQ] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [pay, setPay] = useState<TicketDto | null>(null)
  const tickets = (event.tickets ?? []).filter((t) => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()))

  const cancel = async (t: TicketDto) => {
    const yes = await swalConfirm(`¿Cancelar el boleto de ${t.name}?`, t.paid > 0 ? `Tiene ${money(t.paid)} pagados; quedan en el historial para su devolución.` : "Se libera su lugar.", {
      confirmText: "Cancelar boleto",
      danger: true,
    })
    if (!yes) return
    try {
      await apiJson(`/api/events/${event.id}/tickets/${t.id}`, { method: "DELETE" })
      await onChanged()
    } catch (e) {
      swalError("No se pudo cancelar", errorMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" aria-label="Buscar boleto" className="max-w-xs" />
        {canManage && (
          <Button className="ml-auto" onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" />
            Emitir boleto
          </Button>
        )}
      </div>
      {tickets.length === 0 ? (
        <EmptyState icon={Ticket} title="Sin boletos" description="Emite boletos a creyentes o invitados; quien tiene registro en línea también puede apartar el suyo." />
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id} className={cn("flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3", t.status === "cancelled" && "opacity-55")}>
              <span className="min-w-0 flex-1 basis-44">
                <span className="block truncate text-sm font-medium">{t.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[t.phone, t.seatLabel ?? t.sectionName, t.memberId ? null : "Invitado"].filter(Boolean).join(" · ") || "Sin lugar"}
                </span>
              </span>
              {t.checkedInAt && <StatusPill tone="success" dot={false}>Entró {fmtTime(t.checkedInAt)}</StatusPill>}
              <StatusPill tone={t.status === "paid" ? "success" : t.status === "reserved" ? "warning" : "neutral"}>
                {t.status === "paid" ? (t.price > 0 ? "Pagado" : "Sin costo") : t.status === "reserved" ? `Debe ${money(t.balance)}` : "Cancelado"}
              </StatusPill>
              {canManage && t.status !== "cancelled" && (
                <span className="flex shrink-0 gap-1">
                  {t.balance > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setPay(t)}>
                      <CircleDollarSign className="size-4" /> Abonar
                    </Button>
                  )}
                  {t.payments.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setPay(t)}>
                      Pagos
                    </Button>
                  )}
                  {!t.checkedInAt && (
                    <Button size="icon-sm" variant="ghost" aria-label={`Cancelar boleto de ${t.name}`} onClick={() => void cancel(t)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <NewTicketDialog event={event} open={addOpen} onClose={() => setAddOpen(false)} onDone={onChanged} />
      <PaymentDialog eventId={event.id} ticket={pay} canManage={canManage} onClose={() => setPay(null)} onDone={onChanged} />
    </div>
  )
}

function NewTicketDialog({ event, open, onClose, onDone }: { event: EventDetailDto; open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [q, setQ] = useState("")
  const [people, setPeople] = useState<{ id: string; fullName: string; phone: string | null }[]>([])
  const [person, setPerson] = useState<{ id: string; fullName: string } | null>(null)
  const [guest, setGuest] = useState("")
  const [phone, setPhone] = useState("")
  const [price, setPrice] = useState("")
  const [sectionId, setSectionId] = useState("")
  const [auto, setAuto] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setQ("")
    setPeople([])
    setPerson(null)
    setGuest("")
    setPhone("")
    setPrice(String(event.price))
    setSectionId(event.sections[0]?.id ?? "")
    setAuto(true)
  }, [open, event])

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setPeople([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const d = await apiJson<{ people: typeof people }>(`/api/events/${event.id}/people?q=${encodeURIComponent(q)}`)
        setPeople(d.people)
      } catch {
        setPeople([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, open, event.id])

  const save = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/events/${event.id}/tickets`, {
        method: "POST",
        body: JSON.stringify({
          memberId: person?.id,
          guestName: person ? undefined : guest,
          guestPhone: phone,
          price,
          sectionId: event.seating === "sections" ? sectionId : undefined,
          autoAssign: event.seating === "seats" && event.access.staffMayAssign && auto,
        }),
      })
      notify.success("Boleto emitido")
      onClose()
      await onDone()
    } catch (e) {
      swalError("No se pudo emitir", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Emitir boleto"
      description="Para un creyente del padrón o para un invitado."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || (!person && !guest.trim())}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Emitir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {person ? (
          <p className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{person.fullName}</span>
            <button type="button" aria-label="Quitar persona" onClick={() => setPerson(null)}>
              <X className="size-4" />
            </button>
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar creyente por nombre o teléfono…" aria-label="Buscar creyente" />
              {people.length > 0 && (
                <ul className="max-h-44 divide-y overflow-y-auto rounded-xl border">
                  {people.map((p) => (
                    <li key={p.id}>
                      <button type="button" className="flex min-h-11 w-full flex-col items-start justify-center px-3 text-left hover:bg-muted" onClick={() => setPerson(p)}>
                        <span className="text-sm font-medium">{p.fullName}</span>
                        {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InputGroupField label="…o nombre del invitado" value={guest} maxLength={150} onChange={(e) => setGuest(e.target.value)} />
              <InputGroupField label="Teléfono" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </>
        )}
        <InputGroupField label="Costo de este boleto" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} helper="0 para cortesía." />
        {event.seating === "sections" && (
          <FormCombobox
            label="Sección"
            options={event.sections.map((s) => ({ value: s.id, label: `${s.name} (${s.capacity - s.taken} libres)` }))}
            value={sectionId}
            onChange={setSectionId}
            clearable={false}
          />
        )}
        {event.seating === "seats" && event.access.staffMayAssign && (
          <label className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Asignar un lugar automáticamente (se puede cambiar en Acomodo)
          </label>
        )}
      </div>
    </DialogComponent>
  )
}

function PaymentDialog({ eventId, ticket, canManage, onClose, onDone }: { eventId: string; ticket: TicketDto | null; canManage: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!ticket) return
    setAmount(ticket.balance > 0 ? String(ticket.balance) : "")
    setMethod("cash")
    setReference("")
  }, [ticket])

  const save = async () => {
    if (!ticket) return
    setSaving(true)
    try {
      await apiJson(`/api/events/${eventId}/tickets/${ticket.id}/payments`, { method: "POST", body: JSON.stringify({ amount, method, reference }) })
      notify.success("Pago registrado")
      await onDone()
      onClose()
    } catch (e) {
      swalError("No se pudo registrar el pago", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={ticket !== null}
      onOpenChange={(o) => !o && onClose()}
      title={ticket ? `Pagos de ${ticket.name}` : "Pagos"}
      description={ticket ? `Costo ${money(ticket.price)} · pagado ${money(ticket.paid)} · saldo ${money(ticket.balance)}` : undefined}
    >
      {ticket && (
        <div className="space-y-4">
          {ticket.payments.length > 0 && (
            <ul className="divide-y rounded-xl border">
              {ticket.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {money(p.amount)} · {METHOD_LABEL[p.method as keyof typeof METHOD_LABEL] ?? p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
                </li>
              ))}
            </ul>
          )}
          {canManage && ticket.balance > 0 && (
            <div className="space-y-3 rounded-xl border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <InputGroupField label="Monto" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <FormCombobox
                  label="Forma de pago"
                  options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
                  value={method}
                  onChange={setMethod}
                  clearable={false}
                />
              </div>
              <InputGroupField label="Referencia (opcional)" value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} />
              <div className="flex justify-end">
                <Button onClick={() => void save()} disabled={saving || !amount}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Registrar pago
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </DialogComponent>
  )
}

// ── Acomodo ───────────────────────────────────────────────────────────────────

function SeatingTab({ event, canManage, onChanged }: { event: EventDetailDto; canManage: boolean; onChanged: () => Promise<void> }) {
  const [view3d, setView3d] = useState(false)
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
  const [ticketId, setTicketId] = useState("")
  const [busy, setBusy] = useState(false)

  const active = (event.tickets ?? []).filter((t) => t.status !== "cancelled")
  const unplaced = active.filter((t) => !t.seatCode)
  const occupants = useMemo(() => new Map(active.filter((t) => t.seatCode).map((t) => [t.seatCode as string, t.name])), [active])
  const byCode = useMemo(() => new Map(active.filter((t) => t.seatCode).map((t) => [t.seatCode as string, t])), [active])

  if (event.seating === "sections") {
    return (
      <div className="space-y-3">
        {event.sections.map((s) => {
          const pct = Math.min(100, Math.round((s.taken / s.capacity) * 100))
          return (
            <div key={s.id} className="space-y-1.5 rounded-2xl border bg-card p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 font-medium">{s.name}</span>
                <span className="tabular-nums">
                  {s.taken} / {s.capacity}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", pct >= 100 ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{s.capacity - s.taken > 0 ? `${s.capacity - s.taken} lugares libres` : "Llena"}</p>
            </div>
          )
        })}
        <p className="text-xs text-muted-foreground">El lugar por sección se elige al emitir o apartar el boleto.</p>
      </div>
    )
  }

  if (!event.plan) return <EmptyState icon={MapIcon} title="Sin plano" description="Elige un área con plano en la configuración del evento." />

  const place = async (ticket: string, seat: string | null, auto = false) => {
    setBusy(true)
    try {
      await apiJson(`/api/events/${event.id}/tickets/${ticket}`, {
        method: "PATCH",
        body: JSON.stringify(auto ? { autoAssign: true } : { seatCode: seat ?? "" }),
      })
      setSelectedSeat(null)
      await onChanged()
    } catch (e) {
      swalError("No se pudo acomodar", errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const autoAll = async () => {
    setBusy(true)
    try {
      for (const t of unplaced) await apiJson(`/api/events/${event.id}/tickets/${t.id}`, { method: "PATCH", body: JSON.stringify({ autoAssign: true }) })
      notify.success("Lugares asignados")
      await onChanged()
    } catch (e) {
      swalError("No se pudo asignar", errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const occupant = selectedSeat ? byCode.get(selectedSeat) : null
  const seatLabel = selectedSeat ? computeLabel(event, selectedSeat) : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="tabular-nums">
          {event.plan.takenSeats.length} ocupados · {unplaced.length} boleto{unplaced.length === 1 ? "" : "s"} sin lugar
        </span>
        <Button size="sm" variant={view3d ? "default" : "outline"} className="ml-auto" onClick={() => setView3d((v) => !v)}>
          <Box className="size-4" /> {view3d ? "Vista 2D" : "Vista 3D"}
        </Button>
        {canManage && event.access.staffMayAssign && unplaced.length > 0 && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void autoAll()}>
            Asignar a todos automáticamente
          </Button>
        )}
      </div>

      <SeatMap
        width={event.plan.width}
        height={event.plan.height}
        layout={event.plan.layout}
        taken={new Set(event.plan.takenSeats)}
        occupants={occupants}
        selected={selectedSeat}
        interactive
        view3d={view3d}
        onSeatClick={(code) => setSelectedSeat((cur) => (cur === code ? null : code))}
        className="max-h-[60vh]"
      />
      <SeatLegend sections={event.plan.layout.sections} />

      {selectedSeat && (
        <div className="space-y-2 rounded-2xl border bg-card p-3">
          <p className="text-sm font-medium">{seatLabel}</p>
          {occupant ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1">
                Ocupado por <span className="font-medium">{occupant.name}</span>
              </span>
              {canManage && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void place(occupant.id, null)}>
                  Liberar lugar
                </Button>
              )}
            </div>
          ) : canManage && event.access.staffMayAssign ? (
            unplaced.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay boletos sin lugar; emite uno primero.</p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1 basis-56">
                  <FormCombobox
                    label="Asignar a"
                    options={unplaced.map((t) => ({ value: t.id, label: t.name }))}
                    value={ticketId}
                    onChange={setTicketId}
                    clearable={false}
                  />
                </div>
                <Button disabled={!ticketId || busy} onClick={() => void place(ticketId, selectedSeat).then(() => setTicketId(""))}>
                  <Check className="size-4" /> Asignar
                </Button>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Lugar libre.</p>
          )}
        </div>
      )}
    </div>
  )
}

function computeLabel(event: EventDetailDto, code: string): string {
  const el = event.plan?.layout.elements
  if (!el) return code
  // La etiqueta legible se recompone igual que en el plano.
  for (const e of el) {
    if (e.type === "table" && code.startsWith(`${e.code}-`)) return `Mesa ${e.code} · lugar ${code.split("-")[1]}`
  }
  const m = /^([A-Z0-9]*?)([A-Z]+)-(\d+)$/.exec(code)
  return m ? `Fila ${m[2]} · asiento ${m[3]}` : code
}

// ── Gastos del evento ─────────────────────────────────────────────────────────

const EXPENSE_LABEL: Record<string, string> = { hotel: "Hotel", comida: "Comida", material: "Material", transporte: "Transporte", honorarios: "Honorarios", renta: "Renta", otro: "Otro" }

function ExpensesTab({ event, onChanged }: { event: EventDetailDto; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<ExpenseDto | "new" | null>(null)
  const total = event.stats.expenses
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          Estos gastos quedan ligados al evento y también los ve Finanzas. Total <span className="font-semibold text-foreground">{money(total)}</span> · cobrado{" "}
          {money(event.stats.collected)} · resultado <span className={cn("font-semibold", event.stats.net < 0 ? "text-destructive" : "text-foreground")}>{money(event.stats.net)}</span>
        </p>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Registrar gasto
        </Button>
      </div>
      {event.expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin gastos" description="Registra hotel, comida, material y demás gastos del evento." />
      ) : (
        <ul className="space-y-2">
          {event.expenses.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => setEditing(x)} className="press flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left hover:border-primary/40">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{x.concept}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[EXPENSE_LABEL[x.category] ?? x.category, x.vendor, new Date(`${x.spentAt}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="font-heading text-base font-semibold tabular-nums">{money(x.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ExpenseDialog eventId={event.id} expense={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  )
}

function ExpenseDialog({ eventId, expense, onClose, onSaved }: { eventId: string; expense: ExpenseDto | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const current = expense && expense !== "new" ? expense : null
  const [concept, setConcept] = useState("")
  const [category, setCategory] = useState("otro")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState<Date | null>(null)
  const [vendor, setVendor] = useState("")
  const [method, setMethod] = useState("")
  const [receipt, setReceipt] = useState("")
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
    setReceipt(current?.receiptUrl ?? "")
    setNotes(current?.notes ?? "")
  }, [expense, current])

  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const save = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/events/${eventId}/expenses`, {
        method: "POST",
        body: JSON.stringify({ id: current?.id, concept, category, amount, spentAt: date ? ymd(date) : "", vendor, paymentMethod: method || null, receiptUrl: receipt || null, notes }),
      })
      notify.success("Gasto guardado")
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
    const yes = await swalConfirm("¿Eliminar este gasto?", undefined, { confirmText: "Eliminar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/events/${eventId}/expenses?id=${current.id}`, { method: "DELETE" })
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }

  return (
    <DialogComponent
      open={expense !== null}
      onOpenChange={(o) => !o && onClose()}
      title={current ? "Editar gasto" : "Registrar gasto"}
      description="Queda ligado al evento y aparece también en Finanzas."
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
          <Button onClick={() => void save()} disabled={saving || !concept.trim() || !amount}>
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
        <FormCombobox label="Categoría" options={Object.entries(EXPENSE_LABEL).map(([value, label]) => ({ value, label }))} value={category} onChange={setCategory} clearable={false} />
        <InputGroupField label="Monto" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <DatePicker label="Fecha" required value={date} onChange={setDate} />
        <FormCombobox
          label="Forma de pago"
          options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
          value={method}
          onChange={setMethod}
          onClear={() => setMethod("")}
          placeholder="—"
        />
        <div className="sm:col-span-2">
          <InputGroupField label="Proveedor" value={vendor} maxLength={150} onChange={(e) => setVendor(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Attachment label="Comprobante (opcional)" value={receipt || null} onChange={(u) => setReceipt(u ?? "")} upload={uploadFile} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="exp-notes" className="text-sm font-medium">
            Notas
          </label>
          <Textarea id="exp-notes" rows={2} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </DialogComponent>
  )
}

// ── Entrada por QR ────────────────────────────────────────────────────────────

function EntryTab({ event, onChanged }: { event: EventDetailDto; onChanged: () => Promise<void> }) {
  const reader = useId().replace(/:/g, "")
  const [scanning, setScanning] = useState(false)
  const [manual, setManual] = useState("")
  const [last, setLast] = useState<{ ok: boolean; text: string } | null>(null)
  const busy = useRef(false)
  const [q, setQ] = useState("")

  const send = useCallback(
    async (input: { code?: string; ticketId?: string; allowUnpaid?: boolean }) => {
      if (busy.current) return
      busy.current = true
      try {
        const r = await apiJson<{ name: string; seatCode: string | null; balance: number }>(`/api/events/${event.id}/check-in`, { method: "POST", body: JSON.stringify(input) })
        setLast({ ok: true, text: `${r.name} · entrada registrada${r.seatCode ? ` · lugar ${r.seatCode}` : ""}` })
        notify.success(`${r.name} entró`)
        await onChanged()
      } catch (e) {
        const msg = errorMessage(e)
        if (/saldo pendiente/.test(msg) && input.code !== undefined) {
          const yes = await swalConfirm("Tiene saldo pendiente", `${msg}. ¿Permitir la entrada de todos modos?`, { confirmText: "Permitir entrada", icon: "question" })
          busy.current = false
          if (yes) await send({ ...input, allowUnpaid: true })
          return
        }
        setLast({ ok: false, text: msg })
      } finally {
        setTimeout(() => {
          busy.current = false
        }, 1500)
      }
    },
    [event.id, onChanged]
  )

  useEffect(() => {
    if (!scanning) return
    let stopped = false
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null
    ;(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode")
        await new Promise((r) => setTimeout(r, 150))
        if (stopped || !document.getElementById(reader)) return
        const s = new Html5Qrcode(reader)
        scanner = s
        await s.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, (text) => void send({ code: text }), () => {})
      } catch {
        if (!stopped) {
          setLast({ ok: false, text: "No se pudo usar la cámara. Escribe el código o elige el boleto en la lista." })
          setScanning(false)
        }
      }
    })()
    return () => {
      stopped = true
      const s = scanner
      scanner = null
      if (s) void s.stop().then(() => s.clear()).catch(() => {})
    }
  }, [scanning, reader, send])

  const pending = (event.tickets ?? []).filter((t) => t.status !== "cancelled" && !t.checkedInAt && (!q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase())))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setScanning((s) => !s)}>
          <ScanLine className="size-4" />
          {scanning ? "Detener cámara" : "Escanear boletos"}
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {event.stats.checkedIn} de {event.stats.taken} han entrado
        </span>
      </div>
      {scanning && (
        <div className="overflow-hidden rounded-2xl border bg-muted/40">
          <div id={reader} className="min-h-56 w-full" />
        </div>
      )}
      {last && (
        <p className={cn("flex items-start gap-2 rounded-xl p-3 text-sm", last.ok ? "bg-success/15 text-success-ink" : "bg-destructive/10 text-destructive")}>
          {last.ok ? <Check className="mt-0.5 size-4 shrink-0" /> : <Ban className="mt-0.5 size-4 shrink-0" />}
          {last.text}
        </p>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) void send({ code: manual.trim() }).then(() => setManual(""))
        }}
      >
        <div className="flex-1">
          <InputGroupField label="¿Sin cámara? Escribe el código del boleto" value={manual} onChange={(e) => setManual(e.target.value)} autoComplete="off" />
        </div>
        <Button type="submit" disabled={!manual.trim()}>
          Registrar
        </Button>
      </form>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold">Pendientes de entrar ({pending.length})</h3>
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar boleto" className="max-w-48" />
        </div>
        <ul className="max-h-96 divide-y overflow-y-auto rounded-2xl border">
          {pending.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Nadie pendiente.</li>}
          {pending.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t.seatLabel ?? t.sectionName ?? "Sin lugar"}
                  {t.balance > 0 ? ` · debe ${money(t.balance)}` : ""}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => void send({ ticketId: t.id, allowUnpaid: false })}>
                <LogIn className="size-4" /> Entrada
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ── Vista de quien asiste ─────────────────────────────────────────────────────

function EventQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(`comuapp-event:${code}`, { width: 480, margin: 1, errorCorrectionLevel: "M" })
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null))
    return () => {
      alive = false
    }
  }, [code])
  if (!src) return <div className="size-60" aria-busy />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Código QR de tu boleto" className="size-60" />
}

function AttendeeView({ event, onChanged }: { event: EventDetailDto; onChanged: () => Promise<void> }) {
  const [sectionId, setSectionId] = useState("")
  const [seat, setSeat] = useState<string | null>(null)
  const [view3d, setView3d] = useState(false)
  const [busy, setBusy] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  useEffect(() => {
    setSectionId(event.sections.find((s) => s.taken < s.capacity)?.id ?? "")
  }, [event.sections])

  const ticket = event.myTicket
  const mayChoose = event.access.mayChooseSeat

  const reserve = async () => {
    setBusy(true)
    try {
      await apiJson(`/api/events/${event.id}/reserve`, {
        method: "POST",
        body: JSON.stringify({ sectionId: event.seating === "sections" ? sectionId : undefined, seatCode: seat ?? undefined }),
      })
      notify.success("Boleto apartado")
      setSeat(null)
      await onChanged()
    } catch (e) {
      swalError("No se pudo apartar", errorMessage(e))
      await onChanged()
    } finally {
      setBusy(false)
    }
  }
  const chooseSeat = async () => {
    if (!ticket || !seat) return
    setBusy(true)
    try {
      await apiJson(`/api/events/${event.id}/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify({ seatCode: seat }) })
      notify.success("Lugar elegido")
      setSeat(null)
      await onChanged()
    } catch (e) {
      swalError("No se pudo elegir el lugar", errorMessage(e))
      await onChanged()
    } finally {
      setBusy(false)
    }
  }
  const cancel = async () => {
    if (!ticket) return
    const yes = await swalConfirm("¿Cancelar tu boleto?", "Se libera tu lugar.", { confirmText: "Cancelar boleto", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/events/${event.id}/tickets/${ticket.id}`, { method: "DELETE" })
      await onChanged()
    } catch (e) {
      swalError("No se pudo cancelar", errorMessage(e))
    }
  }

  const needsSeatPick = event.seating === "seats" && mayChoose && (!ticket || !ticket.seatCode) && (ticket || event.canRegister)

  return (
    <div className="space-y-4">
      {(event.topic || event.description) && (
        <div className="space-y-1 rounded-2xl border bg-card p-4">
          {event.topic && <p className="text-sm font-semibold">{event.topic}</p>}
          {event.description && <p className="text-sm whitespace-pre-line text-muted-foreground">{event.description}</p>}
        </div>
      )}
      <div className="rounded-2xl border bg-card p-4 text-sm">
        <p>
          <span className="font-medium">{event.price > 0 ? money(event.price) : "Sin costo"}</span>
          {event.effectiveCapacity ? ` · cupo ${event.effectiveCapacity}` : ""}
        </p>
        {event.price > 0 && <p className="text-xs text-muted-foreground">El pago se entrega al personal; tu boleto queda apartado con tu nombre.</p>}
      </div>

      {event.itinerary.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold">Itinerario</h2>
          <ol className="divide-y rounded-2xl border bg-card">
            {event.itinerary.map((i) => (
              <li key={i.id} className="flex gap-3 p-3 text-sm">
                <span className="w-16 shrink-0 font-semibold tabular-nums">{fmtTime(i.startsAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{i.title}</span>
                  <span className="block text-xs text-muted-foreground">{[i.speakerName, i.location].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {ticket ? (
        <section className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 font-heading text-base font-semibold">Tu boleto</h2>
            <StatusPill tone={ticket.status === "paid" ? "success" : "warning"}>
              {ticket.status === "paid" ? (event.price > 0 ? "Pagado" : "Confirmado") : `Debes ${money(ticket.balance)}`}
            </StatusPill>
          </div>
          {ticket.seatLabel ? (
            <p className="text-sm">
              Tu lugar: <span className="font-semibold">{ticket.seatLabel}</span>
            </p>
          ) : event.seating === "seats" ? (
            <p className="text-sm text-muted-foreground">{mayChoose ? "Elige tu lugar en el plano." : "El personal te asignará un lugar."}</p>
          ) : null}
          {ticket.checkedInAt ? (
            <p className="text-sm text-success-ink">Ya registraste tu entrada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setQrOpen(true)}>Mostrar mi QR</Button>
              <Button variant="ghost" onClick={() => void cancel()}>
                Cancelar mi boleto
              </Button>
            </div>
          )}
        </section>
      ) : event.canRegister ? (
        <section className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <h2 className="font-heading text-base font-semibold">Aparta tu lugar</h2>
          {event.seating === "sections" && (
            <FormCombobox
              label="Sección"
              options={event.sections.map((s) => ({ value: s.id, label: `${s.name} · ${Math.max(0, s.capacity - s.taken)} libres`, disabled: s.taken >= s.capacity }))}
              value={sectionId}
              onChange={setSectionId}
              clearable={false}
            />
          )}
          {event.seating === "seats" && !mayChoose && <p className="text-sm text-muted-foreground">El personal te asignará un lugar al confirmar tu boleto.</p>}
          <Button onClick={() => void reserve()} disabled={busy || (event.seating === "sections" && !sectionId) || (event.seating === "seats" && mayChoose && event.seatSelection === "self" && !seat)}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            <Ticket className="size-4" />
            Apartar mi boleto
          </Button>
        </section>
      ) : (
        <p className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          {event.status === "published" ? "El registro en línea no está disponible para este evento." : "Este evento aún no abre registro."}
        </p>
      )}

      {needsSeatPick && event.plan && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 font-heading text-base font-semibold">Elige tu lugar</h2>
            <Button size="sm" variant={view3d ? "default" : "outline"} onClick={() => setView3d((v) => !v)}>
              <Box className="size-4" /> {view3d ? "Vista 2D" : "Vista 3D"}
            </Button>
          </div>
          <SeatMap
            width={event.plan.width}
            height={event.plan.height}
            layout={event.plan.layout}
            taken={new Set(event.plan.takenSeats)}
            mine={event.plan.mySeat}
            selected={seat}
            interactive
            view3d={view3d}
            onSeatClick={(c) => setSeat((cur) => (cur === c ? null : c))}
            className="max-h-[60vh]"
          />
          <SeatLegend sections={event.plan.layout.sections} />
          {ticket && (
            <Button onClick={() => void chooseSeat()} disabled={!seat || busy}>
              Confirmar este lugar
            </Button>
          )}
          {!ticket && seat && <p className="text-sm text-muted-foreground">Lugar elegido: {seat}. Toca «Apartar mi boleto» para confirmarlo.</p>}
        </section>
      )}

      <DialogComponent open={qrOpen} onOpenChange={setQrOpen} title="Tu boleto" description="Muéstralo en la entrada.">
        {ticket && (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl bg-white p-3">
              <EventQr code={ticket.code} />
            </div>
            {ticket.seatLabel && <p className="text-sm font-medium">{ticket.seatLabel}</p>}
            <p className="text-xs text-muted-foreground">No compartas este código.</p>
          </div>
        )}
      </DialogComponent>
    </div>
  )
}

