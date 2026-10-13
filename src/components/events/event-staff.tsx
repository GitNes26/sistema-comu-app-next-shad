"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CalendarClock, Check, HandHeart, Loader2, MapPin, Plus, Trash2, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DialogComponent } from "@/components/ui/dialog"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { MinistryStaffDto, StaffRequestDto } from "@/lib/events/staffing"
import type { StaffStatus } from "@/lib/events/staffing-rules"
import { cn } from "@/lib/utils"

// Servidores para eventos: el organizador pide N servidores a un ministerio y su líder
// asigna a quién; cada asignado confirma, y los servidores también pueden ofrecerse.

const TONE: Record<StaffStatus, "success" | "warning" | "info" | "danger" | "neutral"> = {
  confirmed: "success",
  assigned: "warning",
  offered: "info",
  declined: "danger",
  rejected: "neutral",
}
const LABEL: Record<StaffStatus, string> = { confirmed: "Confirmado", assigned: "Por confirmar", offered: "Se ofreció", declined: "No puede", rejected: "No aceptado" }
const fmt = (iso: string) => new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

function Progress({ r }: { r: StaffRequestDto }) {
  const filled = r.confirmed + r.assigned
  const pct = Math.min(100, Math.round((filled / r.quantity) * 100))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {r.confirmed} confirmado{r.confirmed === 1 ? "" : "s"}
          {r.assigned > 0 ? ` · ${r.assigned} por confirmar` : ""}
          {r.offered > 0 ? ` · ${r.offered} ofrecimiento${r.offered === 1 ? "" : "s"}` : ""}
        </span>
        <span className="tabular-nums">
          {filled}/{r.quantity}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={r.quantity} aria-label="Servidores cubiertos">
        <div className={cn("h-full rounded-full", filled >= r.quantity ? "bg-emerald-600" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Organizador: pestaña del evento ───────────────────────────────────────────

export function EventStaffTab({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [rows, setRows] = useState<StaffRequestDto[] | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows((await apiJson<{ requests: StaffRequestDto[] }>(`/api/events/${eventId}/staff`)).requests)
    } catch (e) {
      setRows([])
      swalError("No se pudieron cargar los pedidos", errorMessage(e))
    }
  }, [eventId])
  useEffect(() => {
    void load()
  }, [load])

  const remove = async (r: StaffRequestDto) => {
    if (!(await swalConfirm(`¿Quitar el pedido a ${r.ministryName}?`, "Se avisará a quienes ya estaban asignados.", { confirmText: "Quitar", danger: true }))) return
    try {
      await apiJson(`/api/events/${eventId}/staff/${r.id}`, { method: "DELETE" })
      await load()
    } catch (e) {
      swalError("No se pudo quitar", errorMessage(e))
    }
  }

  if (!rows) return <Skeleton className="mt-3 h-40 w-full" />
  const totalNeeded = rows.reduce((s, r) => s + r.quantity, 0)
  const totalFilled = rows.reduce((s, r) => s + r.confirmed + r.assigned, 0)

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {rows.length === 0 ? "Pide servidores a los ministerios: cada líder asigna a su gente." : `${totalFilled} de ${totalNeeded} servidores cubiertos en ${rows.length} ministerio${rows.length === 1 ? "" : "s"}.`}
        </p>
        {canManage && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Pedir servidores
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={HandHeart} title="Aún no pides servidores" description="Por ejemplo: 5 ujieres, 3 de alabanza, 2 de audio." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 rounded-2xl border bg-card p-3">
              <div className="flex flex-wrap items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.ministryName}</span>
                  {r.notes && <span className="block text-xs text-muted-foreground">{r.notes}</span>}
                </span>
                {canManage && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Quitar pedido a ${r.ministryName}`} onClick={() => void remove(r)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <Progress r={r} />
              {r.assignments.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {r.assignments.map((a) => (
                    <li key={a.id}>
                      <StatusPill tone={TONE[a.status]} dot={false}>
                        {a.fullName} · {LABEL[a.status]}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <RequestDialog open={open} eventId={eventId} taken={rows.map((r) => r.ministryId)} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  )
}

function RequestDialog({ open, eventId, taken, onClose, onSaved }: { open: boolean; eventId: string; taken: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [ministries, setMinistries] = useState<{ id: string; name: string }[]>([])
  const [ministryId, setMinistryId] = useState("")
  const [quantity, setQuantity] = useState("5")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMinistryId("")
    setQuantity("5")
    setNotes("")
    apiJson<{ ministries: { id: string; name: string }[] }>("/api/events/ministries")
      .then((r) => setMinistries(r.ministries))
      .catch(() => setMinistries([]))
  }, [open])

  const save = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/events/${eventId}/staff`, { method: "POST", body: JSON.stringify({ ministryId, quantity: Number(quantity), notes }) })
      notify.success("Pedido enviado al líder del ministerio")
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
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Pedir servidores"
      description="El líder del ministerio recibe el aviso y asigna a quién."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !ministryId || !quantity}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Enviar pedido
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormCombobox
          label="Ministerio"
          options={ministries.map((m) => ({ value: m.id, label: taken.includes(m.id) ? `${m.name} (ajustar pedido)` : m.name }))}
          value={ministryId}
          onChange={setMinistryId}
          clearable={false}
        />
        <InputGroupField label="¿Cuántos servidores?" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} />
        <div className="space-y-1.5">
          <Label htmlFor="staff-notes">¿Qué harán? (opcional)</Label>
          <Textarea id="staff-notes" rows={3} value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Ujieres en la puerta principal desde las 8:30" />
        </div>
      </div>
    </DialogComponent>
  )
}

// ── Ministerio: eventos que piden servidores ──────────────────────────────────

export function MinistryStaffSection({ ministryId }: { ministryId: string }) {
  const [data, setData] = useState<MinistryStaffDto | null>(null)
  const [assignFor, setAssignFor] = useState<StaffRequestDto | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<MinistryStaffDto>(`/api/ministries/${ministryId}/staff-requests`))
    } catch (e) {
      setData({ canAssign: false, requests: [], roster: [] })
      swalError("No se pudieron cargar los pedidos de servidores", errorMessage(e))
    }
  }, [ministryId])
  useEffect(() => {
    void load()
  }, [load])

  const act = async (r: StaffRequestDto, body: Record<string, unknown>, ok?: string) => {
    setBusy(r.id)
    try {
      await apiJson(`/api/staff-requests/${r.id}`, { method: "POST", body: JSON.stringify(body) })
      if (ok) notify.success(ok)
      await load()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (!data) return <Skeleton className="h-24 w-full" />
  if (data.requests.length === 0) return null

  return (
    <section className="space-y-2 pt-3">
      <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
        <HandHeart className="size-5 text-primary" />
        Eventos que piden servidores
      </h3>
      <ul className="space-y-3">
        {data.requests.map((r) => {
          const pendingOffers = r.assignments.filter((a) => a.status === "offered")
          return (
            <li key={r.id} className="space-y-2.5 rounded-2xl border bg-card p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">
                  {r.eventName} <span className="font-normal text-muted-foreground">· piden {r.quantity}</span>
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    {fmt(r.eventStartsAt)}
                  </span>
                  {r.eventLocation && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {r.eventLocation}
                    </span>
                  )}
                </p>
                {r.notes && <p className="text-sm">{r.notes}</p>}
              </div>
              <Progress r={r} />

              {/* Lo propio */}
              {(r.mine || r.canOffer) && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-2.5 py-2 text-sm">
                  {r.mine && <StatusPill tone={TONE[r.mine]}>{LABEL[r.mine]}</StatusPill>}
                  {r.mine === "assigned" && !r.closed && (
                    <>
                      <Button size="sm" disabled={busy === r.id} onClick={() => void act(r, { action: "confirm" }, "Confirmaste tu servicio")}>
                        <Check className="size-4" />
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void act(r, { action: "decline" }, "Avisamos a tu líder")}>
                        <X className="size-4" />
                        No puedo
                      </Button>
                    </>
                  )}
                  {(r.mine === "confirmed" || r.mine === "offered") && !r.closed && (
                    <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => void act(r, { action: "withdraw" })}>
                      {r.mine === "offered" ? "Retirar ofrecimiento" : "Ya no puedo"}
                    </Button>
                  )}
                  {r.canOffer && (
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => void act(r, { action: "offer" }, "Tu líder verá tu ofrecimiento")}>
                      <HandHeart className="size-4" />
                      Me ofrezco
                    </Button>
                  )}
                </div>
              )}

              {/* Equipo */}
              {r.assignments.length > 0 && (
                <ul className="divide-y rounded-xl border">
                  {r.assignments.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">{a.fullName}</span>
                      <StatusPill tone={TONE[a.status]} dot={false}>
                        {LABEL[a.status]}
                      </StatusPill>
                      {r.canAssign && a.status === "offered" && (
                        <>
                          <Button size="sm" disabled={busy === r.id || r.remaining === 0} onClick={() => void act(r, { action: "approve", assignmentId: a.id }, "Aceptado")}>
                            Aceptar
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => void act(r, { action: "reject", assignmentId: a.id })}>
                            No
                          </Button>
                        </>
                      )}
                      {r.canAssign && (a.status === "assigned" || a.status === "confirmed") && (
                        <Button size="icon-sm" variant="ghost" aria-label={`Quitar a ${a.fullName}`} disabled={busy === r.id} onClick={() => void act(r, { action: "remove", assignmentId: a.id })}>
                          <X className="size-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {r.canAssign && pendingOffers.length > 0 && r.remaining === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3.5" />
                  El pedido está completo; para aceptar un ofrecimiento libera un lugar.
                </p>
              )}

              {r.canAssign && !r.closed && (
                <Button size="sm" variant="outline" disabled={r.remaining === 0} onClick={() => setAssignFor(r)}>
                  <UserPlus className="size-4" />
                  {r.remaining === 0 ? "Equipo completo" : `Asignar servidores (faltan ${r.remaining})`}
                </Button>
              )}
              {r.closed && <p className="text-xs text-muted-foreground">El evento ya pasó o se canceló.</p>}
            </li>
          )
        })}
      </ul>
      <AssignDialog request={assignFor} roster={data.roster} onClose={() => setAssignFor(null)} onSaved={load} />
    </section>
  )
}

function AssignDialog({ request, roster, onClose, onSaved }: { request: StaffRequestDto | null; roster: MinistryStaffDto["roster"]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (request) setPicked(new Set())
  }, [request])
  if (!request) return <DialogComponent open={false} onOpenChange={() => {}} title="" />

  const day = request.eventStartsAt.slice(0, 10)
  const already = new Set(request.assignments.filter((a) => a.status === "assigned" || a.status === "confirmed").map((a) => a.memberId))
  const available = roster.filter((p) => !already.has(p.memberId))
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else if (next.size < request.remaining) next.add(id)
      return next
    })

  const save = async () => {
    setSaving(true)
    try {
      await apiJson(`/api/staff-requests/${request.id}`, { method: "POST", body: JSON.stringify({ action: "assign", memberIds: [...picked] }) })
      notify.success(`${picked.size} servidor${picked.size === 1 ? "" : "es"} asignado${picked.size === 1 ? "" : "s"}; se les avisó`)
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo asignar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={`Asignar a «${request.eventName}»`}
      description={`Elige hasta ${request.remaining} servidor${request.remaining === 1 ? "" : "es"}. Cada uno recibe un aviso y confirma.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || picked.size === 0}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Asignar {picked.size > 0 ? `(${picked.size})` : ""}
          </Button>
        </>
      }
    >
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todos los integrantes ya están asignados.</p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {available.map((p) => {
            const busy = p.busyWith[day]
            const checked = picked.has(p.memberId)
            return (
              <li key={p.memberId}>
                <label className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2", checked && "bg-primary/5")}>
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={checked} onChange={() => toggle(p.memberId)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.fullName}</span>
                    {busy && (
                      <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="size-3" />
                        Ya sirve ese día en «{busy}»
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </DialogComponent>
  )
}
