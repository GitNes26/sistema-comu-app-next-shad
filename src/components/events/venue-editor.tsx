"use client"

import { useEffect, useMemo, useState } from "react"
import { Box, Copy, Loader2, MapPin, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogComponent } from "@/components/ui/dialog"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { computeSeats, sanitizeLayout, type Layout } from "@/lib/events/rules"
import { ZONE_COLORS, uid } from "@/lib/events/layout-tools"
import type { VenueDto } from "@/lib/events/server"
import { SeatMap } from "./seat-map"
import { VenueDesigner } from "./venue-designer"
import { cn } from "@/lib/utils"

// Áreas de la iglesia (Auditorio Principal, Auditorio Menor, Comunidad Kids…) y su editor
// de plano. El diseño vive en `venue-designer.tsx`; aquí están la lista y el guardado.

const EMPTY_LAYOUT = (): Layout => ({ sections: [{ id: uid("s"), name: "General", color: ZONE_COLORS[0] }], elements: [], blocked: [] })

export function VenuesPanel({ venues, canManage, onChanged }: { venues: VenueDto[]; canManage: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<VenueDto | "new" | null>(null)
  const [copying, setCopying] = useState<string | null>(null)

  const duplicate = async (v: VenueDto) => {
    setCopying(v.id)
    try {
      const names = new Set(venues.map((x) => x.name))
      let name = `${v.name} (copia)`
      for (let n = 2; names.has(name); n++) name = `${v.name} (copia ${n})`
      await apiJson("/api/events/venues", { method: "POST", body: JSON.stringify({ name: name.slice(0, 80), description: v.description ?? "", kind: v.kind, planWidth: v.planWidth, planHeight: v.planHeight, layout: v.layout }) })
      notify.success("Área duplicada")
      await onChanged()
    } catch (e) {
      swalError("No se pudo duplicar el área", errorMessage(e))
    } finally {
      setCopying(null)
    }
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Nueva área
          </Button>
        </div>
      )}
      {venues.length === 0 ? (
        <EmptyState icon={MapPin} title="Sin áreas" description="Registra las áreas donde se realizan los eventos y dibuja su plano." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {venues.map((v) => (
            <li key={v.id} className={cn("space-y-2 rounded-2xl border bg-card p-3", !v.isActive && "opacity-60")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{v.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.capacity > 0 ? `${v.capacity} lugares` : "Sin plano de asientos"}
                    {v.description ? ` · ${v.description}` : ""}
                  </p>
                </div>
                {canManage && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Duplicar ${v.name}`} title="Duplicar área" disabled={copying === v.id} onClick={() => void duplicate(v)}>
                    {copying === v.id ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                  {canManage ? <Pencil className="size-4" /> : <Box className="size-4" />}
                  {canManage ? "Editar" : "Ver"}
                </Button>
              </div>
              <SeatMap width={v.planWidth} height={v.planHeight} layout={v.layout} className="pointer-events-none max-h-44" zoomable={false} />
            </li>
          ))}
        </ul>
      )}
      <VenueEditorDialog venue={editing} canManage={canManage} onClose={() => setEditing(null)} onSaved={onChanged} />
    </div>
  )
}

function VenueEditorDialog({ venue, canManage, onClose, onSaved }: { venue: VenueDto | "new" | null; canManage: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const current = venue && venue !== "new" ? venue : null
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [kind, setKind] = useState("auditorium")
  const [planWidth, setPlanWidth] = useState(1000)
  const [planHeight, setPlanHeight] = useState(600)
  const [layout, setLayout] = useState<Layout>(EMPTY_LAYOUT)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (venue === null) return
    setName(current?.name ?? "")
    setDescription(current?.description ?? "")
    setKind(current?.kind ?? "auditorium")
    setPlanWidth(current?.planWidth ?? 1000)
    setPlanHeight(current?.planHeight ?? 600)
    setLayout(current?.layout ?? EMPTY_LAYOUT())
    setDirty(false)
  }, [venue, current])

  const seatsCount = useMemo(() => computeSeats(layout).length - layout.blocked.length, [layout])

  const close = async () => {
    if (dirty && canManage) {
      const yes = await swalConfirm("¿Salir sin guardar?", "Hay cambios en el plano que no se han guardado.", { confirmText: "Salir sin guardar", danger: true })
      if (!yes) return
    }
    onClose()
  }

  const save = async () => {
    setSaving(true)
    try {
      // Validación local con las mismas reglas del servidor (códigos únicos, límites).
      const clean = sanitizeLayout(layout, planWidth, planHeight)
      const body = JSON.stringify({ name, description, kind, planWidth, planHeight, layout: clean })
      if (current) await apiJson(`/api/events/venues/${current.id}`, { method: "PUT", body })
      else await apiJson("/api/events/venues", { method: "POST", body })
      notify.success("Área guardada")
      setDirty(false)
      onClose()
      await onSaved()
    } catch (e) {
      swalError("No se pudo guardar el área", errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogComponent
      open={venue !== null}
      onOpenChange={(o) => !o && void close()}
      size="full"
      className="h-[calc(100dvh-1rem)] max-h-none"
      title={current ? (canManage ? "Editar área" : current.name) : "Nueva área"}
      description="Diseña el plano: filas, secciones, zonas de color y servicios. Los asientos se numeran solos."
      footer={
        canManage ? (
          <>
            <span className="mr-auto hidden text-xs text-muted-foreground tabular-nums sm:inline">{seatsCount} lugares a la venta</span>
            <Button variant="ghost" onClick={() => void close()} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-3 pb-2">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_12rem]">
          <InputGroupField label="Nombre" required value={name} maxLength={80} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
          <InputGroupField label="Descripción" value={description} maxLength={500} disabled={!canManage} onChange={(e) => setDescription(e.target.value)} />
          <FormCombobox
            label="Tipo"
            options={[
              { value: "auditorium", label: "Auditorio" },
              { value: "kids", label: "Comunidad Kids" },
              { value: "other", label: "Otra" },
            ]}
            value={kind}
            onChange={setKind}
            clearable={false}
            disabled={!canManage}
          />
        </div>
        <VenueDesigner
          layout={layout}
          onLayoutChange={(l) => {
            setLayout(l)
            setDirty(true)
          }}
          planWidth={planWidth}
          planHeight={planHeight}
          onPlanSize={(w, h) => {
            setPlanWidth(w)
            setPlanHeight(h)
            setDirty(true)
          }}
          canManage={canManage}
        />
      </div>
    </DialogComponent>
  )
}
