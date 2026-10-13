"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarCheck, Check, ClipboardCheck, Loader2, UserRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { MinistryStaffSection } from "@/components/events/event-staff"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { MinistryServiceRowDto, ServiceSheetDto, ServiceStatus } from "@/lib/gatherings/service"
import { cn } from "@/lib/utils"

// Asistencia de los servidores a una reunión general en la que su ministerio estuvo en servicio.

const LABEL: Record<ServiceStatus, string> = { present: "Asistió", absent: "Faltó", excused: "Justificó" }
const TONE: Record<ServiceStatus, "success" | "danger" | "warning"> = { present: "success", absent: "danger", excused: "warning" }
const ROLE: Record<string, string> = { leader: "Líder", assistant: "Apoyo", servant: "Servidor" }
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })

export function ServiceSheetDialog({
  gatheringId,
  ministryId,
  open,
  onClose,
  onSaved,
}: {
  gatheringId: string | null
  ministryId: string | null
  open: boolean
  onClose: () => void
  onSaved?: () => void | Promise<void>
}) {
  const [sheet, setSheet] = useState<ServiceSheetDto | null>(null)
  const [marks, setMarks] = useState<Record<string, ServiceStatus | null>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!gatheringId || !ministryId) return
    try {
      const r = await apiJson<{ sheet: ServiceSheetDto }>(`/api/gatherings/${gatheringId}/service?ministryId=${ministryId}`)
      setSheet(r.sheet)
      setMarks(Object.fromEntries(r.sheet.people.map((p) => [p.memberId, p.status])))
    } catch (e) {
      swalError("No se pudo abrir la lista", errorMessage(e))
      onClose()
    }
  }, [gatheringId, ministryId, onClose])

  useEffect(() => {
    if (!open) return
    setSheet(null)
    void load()
  }, [open, load])

  const set = (memberId: string, status: ServiceStatus) =>
    setMarks((m) => ({ ...m, [memberId]: m[memberId] === status ? null : status }))
  const allPresent = () => setMarks(Object.fromEntries((sheet?.people ?? []).map((p) => [p.memberId, "present" as ServiceStatus])))

  const save = async () => {
    if (!sheet || !gatheringId || !ministryId) return
    setSaving(true)
    try {
      await apiJson(`/api/gatherings/${gatheringId}/service`, {
        method: "PUT",
        body: JSON.stringify({ ministryId, records: sheet.people.map((p) => ({ memberId: p.memberId, status: marks[p.memberId] ?? null })) }),
      })
      notify.success("Asistencia guardada")
      onClose()
      await onSaved?.()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const counts = (s: ServiceStatus | null) => (sheet?.people ?? []).filter((p) => (marks[p.memberId] ?? null) === s).length
  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={sheet ? `Servidores de ${sheet.ministry.name}` : "Asistencia de servidores"}
      description={sheet ? `${sheet.gathering.label} · ${fmtDay(sheet.gathering.date)}` : undefined}
      footer={
        sheet?.canEdit ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar asistencia
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Cerrar</Button>
        )
      }
    >
      {!sheet ? (
        <Skeleton className="h-48 w-full" />
      ) : sheet.people.length === 0 ? (
        <EmptyState icon={UserRound} title="Sin servidores" description="Este ministerio aún no tiene integrantes activos." />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusPill tone="success" dot={false}>{counts("present")} asistieron</StatusPill>
            <StatusPill tone="danger" dot={false}>{counts("absent")} faltaron</StatusPill>
            <StatusPill tone="warning" dot={false}>{counts("excused")} justificaron</StatusPill>
            <span className="text-xs text-muted-foreground">{counts(null)} sin marcar</span>
            {sheet.canEdit && (
              <Button size="sm" variant="outline" className="ml-auto" onClick={allPresent}>
                <Check className="size-4" />
                Todos asistieron
              </Button>
            )}
          </div>
          <ul className="divide-y rounded-2xl border">
            {sheet.people.map((p) => {
              const current = marks[p.memberId] ?? null
              return (
                <li key={p.memberId} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="block truncate text-sm font-medium">{p.fullName}</span>
                    <span className="block text-xs text-muted-foreground">{p.positionTitle ?? ROLE[p.role]}</span>
                  </span>
                  {sheet.canEdit ? (
                    <span role="group" aria-label={`Asistencia de ${p.fullName}`} className="flex gap-1">
                      {(["present", "absent", "excused"] as const).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          size="sm"
                          variant={current === s ? "default" : "outline"}
                          aria-pressed={current === s}
                          className={cn("min-w-20", current === s && s === "absent" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                          onClick={() => set(p.memberId, s)}
                        >
                          {s === "absent" && current === s && <X className="size-3.5" />}
                          {LABEL[s]}
                        </Button>
                      ))}
                    </span>
                  ) : current ? (
                    <StatusPill tone={TONE[current]}>{LABEL[current]}</StatusPill>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin marcar</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </DialogComponent>
  )
}

/** Pestaña «Servicio» del ministerio: reuniones generales en que sirvió y su asistencia. */
export function MinistryServiceTab({ ministryId }: { ministryId: string }) {
  const [data, setData] = useState<{ canEdit: boolean; rows: MinistryServiceRowDto[] } | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<{ canEdit: boolean; rows: MinistryServiceRowDto[] }>(`/api/ministries/${ministryId}/services`))
    } catch (e) {
      setData({ canEdit: false, rows: [] })
      swalError("No se pudieron cargar las reuniones", errorMessage(e))
    }
  }, [ministryId])
  useEffect(() => {
    void load()
  }, [load])

  if (!data) return <Skeleton className="mt-3 h-40 w-full" />
  if (data.rows.length === 0) {
    return (
      <div>
        <MinistryStaffSection ministryId={ministryId} />
        <EmptyState
        icon={CalendarCheck}
        title="Aún sin servicio en reuniones generales"
        description="Cuando la secretaría registre a este ministerio «en servicio» en una reunión general, aparecerá aquí para pasar lista."
      />
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <MinistryStaffSection ministryId={ministryId} />
      <h3 className="flex items-center gap-2 pt-3 font-heading text-base font-semibold">
        <CalendarCheck className="size-5 text-primary" />
        Reuniones generales
      </h3>
      <ul className="space-y-2">
        {data.rows.map((r) => (
          <li key={r.gatheringId}>
            <button
              type="button"
              onClick={() => setOpen(r.gatheringId)}
              className="press flex w-full flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:border-primary/40"
            >
              <span className="min-w-0 flex-1 basis-44">
                <span className="block text-sm font-semibold first-letter:uppercase">{fmtDay(r.date)}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.topic ? `${r.label} · ${r.topic}` : r.label}</span>
              </span>
              {r.mine && <StatusPill tone={TONE[r.mine]}>{LABEL[r.mine]}</StatusPill>}
              <span className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">{r.present} ✓</span>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-400">{r.absent} ✗</span>
                {r.excused > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400">{r.excused} just.</span>}
                {r.upcoming ? <span className="text-muted-foreground">próxima</span> : r.unmarked > 0 && data.canEdit && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <ClipboardCheck className="size-3.5" />
                    {r.unmarked} sin marcar
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <ServiceSheetDialog gatheringId={open} ministryId={ministryId} open={open !== null} onClose={() => setOpen(null)} onSaved={load} />
    </div>
  )
}
