"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CalendarClock, Loader2, Mail, Pencil, Plus, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DialogComponent } from "@/components/ui/dialog"
import { FormCombobox } from "@/components/base/form-combobox"
import { StatusPill } from "@/components/base/status-pill"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { ScheduleDto } from "@/lib/reports/schedules"
import type { ReportCatalogItem } from "@/lib/reports/types"

// Envío programado: elige reporte, frecuencia y destinatarios; el sistema lo manda
// por correo con el PDF adjunto al terminar cada semana o cada mes.

const DAYS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
]
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }))
const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Día ${i + 1}` }))

const fmt = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

export function ReportSchedules({ reports }: { reports: ReportCatalogItem[] }) {
  const [data, setData] = useState<{ schedules: ScheduleDto[]; mailReady: boolean } | null>(null)
  const [editing, setEditing] = useState<ScheduleDto | "new" | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await apiJson<{ schedules: ScheduleDto[]; mailReady: boolean }>("/api/reports/schedules"))
    } catch (e) {
      setData({ schedules: [], mailReady: false })
      swalError("No se pudieron cargar los envíos", errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const run = async (s: ScheduleDto) => {
    setBusy(s.id)
    try {
      await apiJson(`/api/reports/schedules/${s.id}/run`, { method: "POST" })
      notify.success("Reporte enviado")
    } catch (e) {
      swalError("No se pudo enviar", errorMessage(e))
    } finally {
      setBusy(null)
      await load()
    }
  }
  const toggle = async (s: ScheduleDto, isActive: boolean) => {
    try {
      await apiJson(`/api/reports/schedules/${s.id}`, { method: "PATCH", body: JSON.stringify({ isActive }) })
      await load()
    } catch (e) {
      swalError("No se pudo cambiar", errorMessage(e))
    }
  }
  const remove = async (s: ScheduleDto) => {
    if (!(await swalConfirm(`¿Eliminar el envío de «${s.reportTitle}»?`, undefined, { confirmText: "Eliminar", danger: true }))) return
    try {
      await apiJson(`/api/reports/schedules/${s.id}`, { method: "DELETE" })
      await load()
    } catch (e) {
      swalError("No se pudo eliminar", errorMessage(e))
    }
  }

  if (!data) return <Skeleton className="h-24 w-full" />
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex flex-1 items-center gap-2 font-heading text-base font-semibold">
          <CalendarClock className="size-5 text-primary" />
          Envío programado por correo
        </h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Programar envío
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Cada semana (el reporte de la semana que terminó) o cada mes (el del mes anterior), a la hora de tu iglesia, con el PDF adjunto.
      </p>
      {!data.mailReady && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
          El correo (SMTP) aún no está configurado en el servidor. Puedes dejar listas las programaciones; no se enviarán hasta configurarlo.
        </p>
      )}
      {data.schedules.length === 0 ? (
        <p className="rounded-xl bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">Aún no hay envíos programados.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {data.schedules.map((s) => (
            <li key={s.id} className="space-y-1.5 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.reportTitle}</span>
                  <span className="block text-xs text-muted-foreground">{s.label}</span>
                </span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={s.isActive} onCheckedChange={(v) => void toggle(s, v)} aria-label={`Activar envío de ${s.reportTitle}`} />
                  {s.isActive ? "Activo" : "En pausa"}
                </label>
                <Button size="icon-sm" variant="ghost" aria-label="Enviar ahora" disabled={busy === s.id} onClick={() => void run(s)}>
                  {busy === s.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(s)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Eliminar" onClick={() => void remove(s)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Mail className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 break-words">{s.recipients.join(", ")}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {s.isActive && s.nextRunAt && <span>Próximo envío: {fmt(s.nextRunAt)}</span>}
                {s.lastStatus === "sent" && s.lastRunAt && (
                  <StatusPill tone="success" dot={false}>
                    Último envío {fmt(s.lastRunAt)}
                  </StatusPill>
                )}
                {s.lastStatus === "error" && (
                  <StatusPill tone="danger" dot={false}>
                    Falló: {s.lastError ?? "error"}
                  </StatusPill>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ScheduleDialog value={editing} reports={reports} onClose={() => setEditing(null)} onSaved={load} />
    </section>
  )
}

function ScheduleDialog({
  value,
  reports,
  onClose,
  onSaved,
}: {
  value: ScheduleDto | "new" | null
  reports: ReportCatalogItem[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [reportId, setReportId] = useState("")
  const [frequency, setFrequency] = useState("weekly")
  const [dayOfWeek, setDayOfWeek] = useState("1")
  const [dayOfMonth, setDayOfMonth] = useState("1")
  const [hour, setHour] = useState("8")
  const [recipients, setRecipients] = useState("")
  const [includeCsv, setIncludeCsv] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (value === null) return
    const s = value === "new" ? null : value
    setReportId(s?.reportId ?? reports[0]?.id ?? "")
    setFrequency(s?.frequency ?? "weekly")
    setDayOfWeek(String(s?.dayOfWeek ?? 1))
    setDayOfMonth(String(s?.dayOfMonth ?? 1))
    setHour(String(s?.hour ?? 8))
    setRecipients(s?.recipients.join("\n") ?? "")
    setIncludeCsv(s?.includeCsv ?? false)
  }, [value, reports])

  const save = async () => {
    setSaving(true)
    try {
      const body = { reportId, frequency, dayOfWeek: Number(dayOfWeek), dayOfMonth: Number(dayOfMonth), hour: Number(hour), recipients, includeCsv }
      if (value === "new") await apiJson("/api/reports/schedules", { method: "POST", body: JSON.stringify(body) })
      else if (value) await apiJson(`/api/reports/schedules/${value.id}`, { method: "PATCH", body: JSON.stringify(body) })
      notify.success("Envío programado")
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
      open={value !== null}
      onOpenChange={(o) => !o && onClose()}
      size="xl"
      title={value === "new" ? "Programar envío" : "Editar envío"}
      description="El reporte llegará por correo con el PDF adjunto."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !reportId || !recipients.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormCombobox
          label="Reporte"
          options={reports.map((r) => ({ value: r.id, label: r.title }))}
          value={reportId}
          onChange={setReportId}
          clearable={false}
          disabled={value !== "new"}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <FormCombobox
            label="Frecuencia"
            options={[
              { value: "weekly", label: "Cada semana" },
              { value: "monthly", label: "Cada mes" },
            ]}
            value={frequency}
            onChange={setFrequency}
            clearable={false}
          />
          {frequency === "weekly" ? (
            <FormCombobox label="Día" options={DAYS} value={dayOfWeek} onChange={setDayOfWeek} clearable={false} />
          ) : (
            <FormCombobox label="Día del mes" options={MONTH_DAYS} value={dayOfMonth} onChange={setDayOfMonth} clearable={false} />
          )}
          <FormCombobox label="Hora" options={HOURS} value={hour} onChange={setHour} clearable={false} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sched-recipients">Correos (uno por línea o separados por coma, máximo 10)</Label>
          <Textarea id="sched-recipients" rows={3} inputMode="email" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="pastor@iglesia.org" />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={includeCsv} onCheckedChange={setIncludeCsv} />
          Adjuntar también el archivo CSV
        </label>
      </div>
    </DialogComponent>
  )
}
