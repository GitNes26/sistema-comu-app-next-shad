"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Ban, Car, Droplets, FileCheck2, Loader2, MapPinned, Plus, Trash2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogComponent } from "@/components/ui/dialog"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { StatusPill, type StatusTone } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { VehicleDetailDto, VehicleRowDto } from "@/lib/finance/server"
import { cn } from "@/lib/utils"

// Control vehicular: bitácora de uso, mantenimiento, combustible, y seguro,
// verificación y demás documentos con su vencimiento. El costo de cada servicio,
// carga o documento se registra también como gasto (Finanzas) ligado al vehículo.

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
const fmtDay = (ymd: string | null) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—")
const ymdOfLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const DOC_TONE: Record<string, StatusTone> = { ok: "success", soon: "warning", expired: "danger", none: "neutral" }
const DOC_STATUS: Record<string, string> = { ok: "Vigente", soon: "Por vencer", expired: "Vencido", none: "Sin vencimiento" }

export function VehiclesAdmin({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<VehicleRowDto[] | null>(null)
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ vehicles: VehicleRowDto[] }>("/api/finance/vehicles")
      setRows(d.vehicles)
    } catch (e) {
      setRows([])
      swalError("No se pudieron cargar los vehículos", errorMessage(e))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Nuevo vehículo
          </Button>
        </div>
      )}
      {rows === null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Car} title="Sin vehículos" description="Registra los vehículos de la iglesia para llevar su bitácora, mantenimiento y documentos." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((v) => (
            <li key={v.id}>
              <Link href={`/admin/vehicles/${v.id}`} className={cn("press flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 hover:border-primary/40", !v.isActive && "opacity-60")}>
                <span className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Car className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{v.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[v.plate, v.year, `${v.odometer.toLocaleString("es-MX")} km`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </span>
                {v.alerts.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {v.alerts.map((a, i) => (
                      <StatusPill key={i} tone={a.status === "expired" ? "danger" : "warning"} dot={false}>
                        <AlertTriangle className="size-3" /> {a.label}: {a.status === "expired" ? "vencido" : a.status === "due" ? "toca servicio" : "por vencer"}
                      </StatusPill>
                    ))}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <VehicleDialog open={open} vehicle={null} onClose={() => setOpen(false)} onDone={load} />
    </div>
  )
}

// ── Detalle ───────────────────────────────────────────────────────────────────

export function VehicleWorkspace({ vehicleId, canManage }: { vehicleId: string; canManage: boolean }) {
  const [data, setData] = useState<VehicleDetailDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [entry, setEntry] = useState<"log" | "service" | "fuel" | "document" | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await apiJson<{ vehicle: VehicleDetailDto }>(`/api/finance/vehicles/${vehicleId}`)
      setData(d.vehicle)
    } catch (e) {
      setError(errorMessage(e, "No se pudo abrir el vehículo"))
    }
  }, [vehicleId])
  useEffect(() => {
    void load()
  }, [load])

  const remove = async (kind: string, id: string) => {
    const yes = await swalConfirm("¿Quitar este registro?", "Si generó un gasto, también se quita.", { confirmText: "Quitar", danger: true })
    if (!yes) return
    try {
      await apiJson(`/api/finance/vehicles/${vehicleId}/entries?kind=${kind}&id=${id}`, { method: "DELETE" })
      await load()
    } catch (e) {
      swalError("No se pudo quitar", errorMessage(e))
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/vehicles">
            <ArrowLeft className="size-4" />
            Vehículos
          </Link>
        </Button>
        <EmptyState icon={Ban} title="No se pudo abrir el vehículo" description={error} />
      </div>
    )
  }
  if (!data) return <Skeleton className="h-64 w-full" />
  const v = data.vehicle
  const del = (kind: string, id: string) =>
    canManage && (
      <Button size="icon-sm" variant="ghost" aria-label="Quitar registro" onClick={() => void remove(kind, id)}>
        <Trash2 className="size-4" />
      </Button>
    )

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/vehicles">
          <ArrowLeft className="size-4" />
          Vehículos
        </Link>
      </Button>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">{v.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[v.make, v.model, v.year, v.plate, `${v.odometer.toLocaleString("es-MX")} km`, v.capacity ? `${v.capacity} lugares` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        {data.serviceDue && <StatusPill tone="warning">Toca servicio</StatusPill>}
        {!v.isActive && <StatusPill tone="neutral">Inactivo</StatusPill>}
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Mantenimiento", value: money(data.totals.services) },
          { label: "Combustible", value: money(data.totals.fuel) },
          { label: "Documentos", value: money(data.totals.documents) },
          { label: "Costo total", value: money(data.totals.all) },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl border bg-card p-3">
            <p className="font-heading text-lg font-semibold tabular-nums">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="docs">
        <TabsList>
          <TabsTrigger value="docs">
            <FileCheck2 className="size-4" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="service">
            <Wrench className="size-4" /> Mantenimiento
          </TabsTrigger>
          <TabsTrigger value="fuel">
            <Droplets className="size-4" /> Combustible
          </TabsTrigger>
          <TabsTrigger value="log">
            <MapPinned className="size-4" /> Bitácora
          </TabsTrigger>
        </TabsList>

        {(
          [
            ["docs", "document", "Agregar documento", data.documents.length],
            ["service", "service", "Registrar servicio", data.services.length],
            ["fuel", "fuel", "Cargar combustible", data.fuels.length],
            ["log", "log", "Registrar uso", data.logs.length],
          ] as const
        ).map(([tab, type, label, count]) => (
          <TabsContent key={tab} value={tab}>
            <div className="space-y-3 pt-2">
              {canManage && (
                <div className="flex justify-end">
                  <Button onClick={() => setEntry(type)}>
                    <Plus className="size-4" />
                    {label}
                  </Button>
                </div>
              )}
              {count === 0 && <p className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">Aún no hay registros.</p>}
              <ul className="space-y-2">
                {tab === "docs" &&
                  data.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {d.label}
                          {d.number ? ` · ${d.number}` : ""}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[d.provider, d.expiresAt ? `Vence ${fmtDay(d.expiresAt)}` : null, d.cost > 0 ? money(d.cost) : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <StatusPill tone={DOC_TONE[d.status]}>{DOC_STATUS[d.status]}</StatusPill>
                      {del("document", d.id)}
                    </li>
                  ))}
                {tab === "service" &&
                  data.services.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.description}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[fmtDay(s.date), s.vendor, s.odometer !== null ? `${s.odometer.toLocaleString("es-MX")} km` : null, s.nextDueDate ? `Próximo: ${fmtDay(s.nextDueDate)}` : null, s.nextDueOdometer ? `o a los ${s.nextDueOdometer.toLocaleString("es-MX")} km` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{money(s.cost)}</span>
                      {del("service", s.id)}
                    </li>
                  ))}
                {tab === "fuel" &&
                  data.fuels.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {f.liters.toFixed(1)} L · {fmtDay(f.date)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[f.station, f.odometer !== null ? `${f.odometer.toLocaleString("es-MX")} km` : null, f.kmPerLiter ? `${f.kmPerLiter} km/L` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{money(f.cost)}</span>
                      {del("fuel", f.id)}
                    </li>
                  ))}
                {tab === "log" &&
                  data.logs.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{l.purpose}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[fmtDay(l.date), l.driver, l.destination, l.km !== null ? `${l.km} km` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {del("log", l.id)}
                    </li>
                  ))}
              </ul>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <VehicleDialog open={editOpen} vehicle={v} onClose={() => setEditOpen(false)} onDone={load} />
      <EntryDialog vehicleId={vehicleId} type={entry} odometer={v.odometer} onClose={() => setEntry(null)} onDone={load} />
    </div>
  )
}

function VehicleDialog({ open, vehicle, onClose, onDone }: { open: boolean; vehicle: VehicleDetailDto["vehicle"] | null; onClose: () => void; onDone: () => Promise<void> }) {
  const [v, setV] = useState({ name: "", plate: "", make: "", model: "", year: "", kind: "auto", capacity: "", odometer: "", notes: "", isActive: true })
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    setV({
      name: vehicle?.name ?? "",
      plate: vehicle?.plate ?? "",
      make: vehicle?.make ?? "",
      model: vehicle?.model ?? "",
      year: vehicle?.year ? String(vehicle.year) : "",
      kind: vehicle?.kind ?? "auto",
      capacity: vehicle?.capacity ? String(vehicle.capacity) : "",
      odometer: vehicle ? String(vehicle.odometer) : "",
      notes: vehicle?.notes ?? "",
      isActive: vehicle?.isActive ?? true,
    })
  }, [open, vehicle])
  const set = (k: keyof typeof v, val: string | boolean) => setV((c) => ({ ...c, [k]: val }))

  const save = async () => {
    setSaving(true)
    try {
      if (vehicle) await apiJson(`/api/finance/vehicles/${vehicle.id}`, { method: "PUT", body: JSON.stringify(v) })
      else await apiJson("/api/finance/vehicles", { method: "POST", body: JSON.stringify(v) })
      notify.success("Vehículo guardado")
      onClose()
      await onDone()
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
      title={vehicle ? "Editar vehículo" : "Nuevo vehículo"}
      description="Datos del vehículo para su bitácora, mantenimiento y documentos."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !v.name.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <InputGroupField label="Nombre" required placeholder="Ej. Camioneta blanca" value={v.name} maxLength={100} onChange={(e) => set("name", e.target.value)} />
        </div>
        <InputGroupField label="Placas" value={v.plate} maxLength={20} onChange={(e) => set("plate", e.target.value)} />
        <FormCombobox
          label="Tipo"
          options={["auto", "camioneta", "van", "autobús", "moto", "otro"].map((k) => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))}
          value={v.kind}
          onChange={(k) => set("kind", k)}
          clearable={false}
        />
        <InputGroupField label="Marca" value={v.make} maxLength={60} onChange={(e) => set("make", e.target.value)} />
        <InputGroupField label="Modelo" value={v.model} maxLength={60} onChange={(e) => set("model", e.target.value)} />
        <InputGroupField label="Año" inputMode="numeric" value={v.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, ""))} />
        <InputGroupField label="Capacidad (personas)" inputMode="numeric" value={v.capacity} onChange={(e) => set("capacity", e.target.value.replace(/\D/g, ""))} />
        <InputGroupField label="Kilometraje actual" inputMode="numeric" value={v.odometer} onChange={(e) => set("odometer", e.target.value.replace(/\D/g, ""))} />
        <div className="self-end">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={v.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            Activo
          </label>
        </div>
      </div>
    </DialogComponent>
  )
}

const DOC_KINDS = [
  { value: "insurance", label: "Seguro" },
  { value: "verification", label: "Verificación" },
  { value: "registration", label: "Tarjeta de circulación" },
  { value: "permit", label: "Permiso" },
  { value: "other", label: "Otro" },
]

function EntryDialog({ vehicleId, type, odometer, onClose, onDone }: { vehicleId: string; type: "log" | "service" | "fuel" | "document" | null; odometer: number; onClose: () => void; onDone: () => Promise<void> }) {
  const [v, setV] = useState<Record<string, string>>({})
  const [date, setDate] = useState<Date | null>(null)
  const [extra, setExtra] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!type) return
    setDate(new Date())
    setExtra(null)
    setV({ kind: type === "document" ? "insurance" : "service", odometer: type === "log" ? "" : String(odometer) })
  }, [type, odometer])
  const set = (k: string, val: string) => setV((c) => ({ ...c, [k]: val }))

  const titles = { log: "Registrar uso", service: "Registrar servicio", fuel: "Cargar combustible", document: "Agregar documento" } as const
  const save = async () => {
    if (!type) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { type, ...v }
      if (type === "document") {
        body.issuedAt = date ? ymdOfLocal(date) : null
        body.expiresAt = extra ? ymdOfLocal(extra) : null
      } else {
        body.date = date ? ymdOfLocal(date) : ""
        if (type === "service") body.nextDueDate = extra ? ymdOfLocal(extra) : null
      }
      await apiJson(`/api/finance/vehicles/${vehicleId}/entries`, { method: "POST", body: JSON.stringify(body) })
      notify.success("Registro guardado")
      onClose()
      await onDone()
    } catch (e) {
      swalError("No se pudo guardar", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={type !== null}
      onOpenChange={(o) => !o && onClose()}
      title={type ? titles[type] : ""}
      description="Cada costo registrado genera su gasto ligado al vehículo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !date}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      {type && (
        <div className="grid gap-4 sm:grid-cols-2">
          {type === "document" ? (
            <>
              <FormCombobox label="Documento" options={DOC_KINDS} value={v.kind ?? "insurance"} onChange={(k) => set("kind", k)} clearable={false} />
              <InputGroupField label="Número o póliza" value={v.number ?? ""} onChange={(e) => set("number", e.target.value)} />
              <DatePicker label="Expedición" value={date} onChange={setDate} />
              <DatePicker label="Vencimiento" value={extra} onChange={setExtra} onClear={() => setExtra(null)} />
              <InputGroupField label="Aseguradora o centro" value={v.provider ?? ""} onChange={(e) => set("provider", e.target.value)} />
              <InputGroupField label="Costo" inputMode="decimal" value={v.cost ?? ""} onChange={(e) => set("cost", e.target.value)} helper="Se registra también como gasto." />
            </>
          ) : (
            <>
              <DatePicker label="Fecha" required value={date} onChange={setDate} />
              {type === "log" && (
                <>
                  <InputGroupField label="Conductor" value={v.driverName ?? ""} onChange={(e) => set("driverName", e.target.value)} />
                  <div className="sm:col-span-2">
                    <InputGroupField label="Motivo del viaje" required value={v.purpose ?? ""} maxLength={200} onChange={(e) => set("purpose", e.target.value)} />
                  </div>
                  <InputGroupField label="Destino" value={v.destination ?? ""} onChange={(e) => set("destination", e.target.value)} />
                  <span />
                  <InputGroupField label="Kilometraje inicial" inputMode="numeric" value={v.odometerStart ?? ""} onChange={(e) => set("odometerStart", e.target.value.replace(/\D/g, ""))} />
                  <InputGroupField label="Kilometraje final" inputMode="numeric" value={v.odometerEnd ?? ""} onChange={(e) => set("odometerEnd", e.target.value.replace(/\D/g, ""))} />
                </>
              )}
              {type === "service" && (
                <>
                  <FormCombobox
                    label="Tipo"
                    options={[
                      { value: "service", label: "Servicio programado" },
                      { value: "repair", label: "Reparación" },
                      { value: "tires", label: "Llantas" },
                      { value: "other", label: "Otro" },
                    ]}
                    value={v.kind ?? "service"}
                    onChange={(k) => set("kind", k)}
                    clearable={false}
                  />
                  <div className="sm:col-span-2">
                    <InputGroupField label="Descripción" required value={v.description ?? ""} maxLength={200} onChange={(e) => set("description", e.target.value)} />
                  </div>
                  <InputGroupField label="Taller o proveedor" value={v.vendor ?? ""} onChange={(e) => set("vendor", e.target.value)} />
                  <InputGroupField label="Costo" inputMode="decimal" value={v.cost ?? ""} onChange={(e) => set("cost", e.target.value)} helper="Se registra también como gasto." />
                  <InputGroupField label="Kilometraje" inputMode="numeric" value={v.odometer ?? ""} onChange={(e) => set("odometer", e.target.value.replace(/\D/g, ""))} />
                  <span />
                  <DatePicker label="Próximo servicio (fecha)" value={extra} onChange={setExtra} onClear={() => setExtra(null)} />
                  <InputGroupField label="Próximo servicio (km)" inputMode="numeric" value={v.nextDueOdometer ?? ""} onChange={(e) => set("nextDueOdometer", e.target.value.replace(/\D/g, ""))} />
                </>
              )}
              {type === "fuel" && (
                <>
                  <InputGroupField label="Litros" required inputMode="decimal" value={v.liters ?? ""} onChange={(e) => set("liters", e.target.value)} />
                  <InputGroupField label="Importe" required inputMode="decimal" value={v.cost ?? ""} onChange={(e) => set("cost", e.target.value)} helper="Se registra también como gasto." />
                  <InputGroupField label="Kilometraje" inputMode="numeric" value={v.odometer ?? ""} onChange={(e) => set("odometer", e.target.value.replace(/\D/g, ""))} />
                  <InputGroupField label="Gasolinera" value={v.station ?? ""} onChange={(e) => set("station", e.target.value)} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </DialogComponent>
  )
}
