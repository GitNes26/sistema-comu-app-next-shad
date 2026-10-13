"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Box, Grid3x3, Loader2, Lock, MapPin, Pencil, Plus, Square, Table2, Trash2, Type } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogComponent } from "@/components/ui/dialog"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { EmptyState } from "@/components/shared/empty-state"
import { notify } from "@/lib/notify"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { LIMITS, computeSeats, sanitizeLayout, type BlockElement, type DecorElement, type Layout, type LayoutElement, type TableElement } from "@/lib/events/rules"
import type { VenueDto } from "@/lib/events/server"
import { SeatLegend, SeatMap } from "./seat-map"
import { cn } from "@/lib/utils"

// Áreas de la iglesia (Auditorio Principal, Auditorio Menor, Comunidad Kids…) y
// editor de su plano: bloques de asientos, mesas, escenario, puertas y secciones.
// El plano se ve en 2D o inclinado en 3D.

const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 7)}`
const SECTION_COLORS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2"]

export function VenuesPanel({ venues, canManage, onChanged }: { venues: VenueDto[]; canManage: boolean; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<VenueDto | "new" | null>(null)
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
                <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                  {canManage ? <Pencil className="size-4" /> : <Box className="size-4" />}
                  {canManage ? "Editar" : "Ver"}
                </Button>
              </div>
              <SeatMap width={v.planWidth} height={v.planHeight} layout={v.layout} className="pointer-events-none max-h-44" />
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
  const [layout, setLayout] = useState<Layout>({ sections: [], elements: [], blocked: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view3d, setView3d] = useState(false)
  const [blockMode, setBlockMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)

  useEffect(() => {
    if (venue === null) return
    setName(current?.name ?? "")
    setDescription(current?.description ?? "")
    setKind(current?.kind ?? "auditorium")
    setPlanWidth(current?.planWidth ?? 1000)
    setPlanHeight(current?.planHeight ?? 600)
    setLayout(current?.layout ?? { sections: [{ id: uid("s"), name: "General", color: SECTION_COLORS[0] }], elements: [], blocked: [] })
    setSelectedId(null)
    setView3d(false)
    setBlockMode(false)
  }, [venue, current])

  const seatsCount = useMemo(() => computeSeats(layout).length - layout.blocked.length, [layout])
  const selected = layout.elements.find((e) => e.id === selectedId) ?? null
  const patch = useCallback((id: string, changes: Partial<LayoutElement>) => {
    setLayout((l) => ({ ...l, elements: l.elements.map((e) => (e.id === id ? ({ ...e, ...changes } as LayoutElement) : e)) }))
  }, [])

  // Arrastre de elementos sobre el plano (con ajuste a cuadrícula de 10).
  const onElementPointerDown = (el: LayoutElement, e: React.PointerEvent) => {
    if (blockMode || !canManage) return
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    drag.current = { id: el.id, dx: p.x - el.x, dy: p.y - el.y }
    setSelectedId(el.id)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      const svg = svgRef.current
      if (!d || !svg) return
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      const snap = (v: number) => Math.round(v / 10) * 10
      patch(d.id, { x: Math.max(0, Math.min(planWidth, snap(p.x - d.dx))), y: Math.max(0, Math.min(planHeight, snap(p.y - d.dy))) })
    }
    const up = () => {
      drag.current = null
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  }, [patch, planWidth, planHeight])

  const add = (el: LayoutElement) => {
    setLayout((l) => ({ ...l, elements: [...l.elements, el] }))
    setSelectedId(el.id)
  }
  const firstSection = layout.sections[0]?.id
  const nextCode = () => {
    const used = new Set(computeSeats(layout).map((s) => s.code))
    let n = layout.elements.filter((e) => e.type === "table").length + 1
    while (used.has(`M${n}-1`)) n += 1
    return `M${n}`
  }
  const addBlock = () =>
    add({ id: uid("b"), type: "block", x: 80, y: 120, rows: 5, cols: 8, prefix: `B${layout.elements.filter((e) => e.type === "block").length + 1}`, sectionId: firstSection, label: "Bloque" })
  const addTable = () => add({ id: uid("t"), type: "table", x: 200, y: 200, code: nextCode(), seats: 6, shape: "round", sectionId: firstSection })
  const addDecor = (type: DecorElement["type"]) => {
    const defs = { stage: { w: 300, h: 60, label: "Plataforma" }, door: { w: 100, h: 24, label: "Entrada" }, wall: { w: 200, h: 14, label: "" }, label: { w: 160, h: 28, label: "Texto" } }
    add({ id: uid("d"), type, x: 100, y: 20, ...defs[type] })
  }
  const remove = () => {
    if (!selected) return
    setLayout((l) => ({ ...l, elements: l.elements.filter((e) => e.id !== selected.id) }))
    setSelectedId(null)
  }
  const toggleBlocked = (code: string) =>
    setLayout((l) => ({ ...l, blocked: l.blocked.includes(code) ? l.blocked.filter((c) => c !== code) : [...l.blocked, code] }))

  const save = async () => {
    setSaving(true)
    try {
      // Validación local con las mismas reglas del servidor (códigos únicos, límites).
      const clean = sanitizeLayout(layout, planWidth, planHeight)
      const body = JSON.stringify({ name, description, kind, planWidth, planHeight, layout: clean })
      if (current) await apiJson(`/api/events/venues/${current.id}`, { method: "PUT", body })
      else await apiJson("/api/events/venues", { method: "POST", body })
      notify.success("Área guardada")
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
      onOpenChange={(o) => !o && onClose()}
      title={current ? (canManage ? "Editar área" : current.name) : "Nueva área"}
      description="Dibuja el plano: arrastra los elementos; los asientos se numeran solos."
      className="max-w-[96vw] md:max-w-5xl"
      footer={
        canManage ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
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
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <InputGroupField label="Nombre" required value={name} maxLength={80} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
          </div>
          <InputGroupField label="Ancho del plano" inputMode="numeric" value={String(planWidth)} disabled={!canManage} onChange={(e) => setPlanWidth(Number(e.target.value.replace(/\D/g, "")) || 0)} />
          <InputGroupField label="Alto del plano" inputMode="numeric" value={String(planHeight)} disabled={!canManage} onChange={(e) => setPlanHeight(Number(e.target.value.replace(/\D/g, "")) || 0)} />
          <div className="sm:col-span-3">
            <InputGroupField label="Descripción" value={description} maxLength={500} disabled={!canManage} onChange={(e) => setDescription(e.target.value)} />
          </div>
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

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button size="sm" variant="outline" onClick={addBlock}>
                <Grid3x3 className="size-4" /> Bloque de asientos
              </Button>
              <Button size="sm" variant="outline" onClick={addTable}>
                <Table2 className="size-4" /> Mesa
              </Button>
              <Button size="sm" variant="outline" onClick={() => addDecor("stage")}>
                <Square className="size-4" /> Escenario
              </Button>
              <Button size="sm" variant="outline" onClick={() => addDecor("door")}>
                Puerta
              </Button>
              <Button size="sm" variant="outline" onClick={() => addDecor("wall")}>
                Pared
              </Button>
              <Button size="sm" variant="outline" onClick={() => addDecor("label")}>
                <Type className="size-4" /> Texto
              </Button>
              <Button size="sm" variant={blockMode ? "default" : "outline"} onClick={() => setBlockMode((b) => !b)}>
                <Lock className="size-4" /> {blockMode ? "Toca los asientos a bloquear" : "Bloquear asientos"}
              </Button>
            </>
          )}
          <Button size="sm" variant={view3d ? "default" : "ghost"} className="ml-auto" onClick={() => setView3d((v) => !v)}>
            <Box className="size-4" /> {view3d ? "Vista 2D" : "Vista 3D"}
          </Button>
        </div>

        <SeatMap
          ref={svgRef}
          width={planWidth || 1000}
          height={planHeight || 600}
          layout={layout}
          view3d={view3d}
          interactive={blockMode && canManage}
          onSeatClick={blockMode ? toggleBlocked : undefined}
          onElementPointerDown={canManage && !view3d ? onElementPointerDown : undefined}
          selectedElementId={selectedId}
          className="max-h-[56vh]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <SeatLegend sections={layout.sections} />
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {seatsCount} lugares a la venta (máx. {LIMITS.seats})
          </span>
        </div>

        {canManage && selected && (
          <ElementInspector element={selected} sections={layout.sections} onChange={(c) => patch(selected.id, c)} onRemove={remove} />
        )}

        {canManage && (
          <fieldset className="space-y-2 rounded-2xl border p-3">
            <legend className="px-1 text-sm font-semibold">Secciones</legend>
            <ul className="space-y-2">
              {layout.sections.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`Color de ${s.name}`}
                    value={s.color}
                    onChange={(e) => setLayout((l) => ({ ...l, sections: l.sections.map((x) => (x.id === s.id ? { ...x, color: e.target.value } : x)) }))}
                    className="size-10 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
                  />
                  <div className="min-w-0 flex-1">
                    <InputGroupField
                      aria-label="Nombre de la sección"
                      value={s.name}
                      maxLength={40}
                      onChange={(e) => setLayout((l) => ({ ...l, sections: l.sections.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) }))}
                    />
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Quitar ${s.name}`}
                    onClick={() =>
                      setLayout((l) => ({
                        ...l,
                        sections: l.sections.filter((x) => x.id !== s.id),
                        elements: l.elements.map((e) => (("sectionId" in e && e.sectionId === s.id ? { ...e, sectionId: undefined } : e) as LayoutElement)),
                      }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="outline"
              disabled={layout.sections.length >= LIMITS.sections}
              onClick={() => setLayout((l) => ({ ...l, sections: [...l.sections, { id: uid("s"), name: `Sección ${l.sections.length + 1}`, color: SECTION_COLORS[l.sections.length % SECTION_COLORS.length] }] }))}
            >
              <Plus className="size-4" /> Agregar sección
            </Button>
          </fieldset>
        )}
      </div>
    </DialogComponent>
  )
}

function ElementInspector({
  element,
  sections,
  onChange,
  onRemove,
}: {
  element: LayoutElement
  sections: { id: string; name: string }[]
  onChange: (c: Partial<LayoutElement>) => void
  onRemove: () => void
}) {
  const sectionOptions = sections.map((s) => ({ value: s.id, label: s.name }))
  const numeric = (v: string) => Number(v.replace(/\D/g, "")) || 0
  return (
    <fieldset className="space-y-3 rounded-2xl border p-3">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        Elemento seleccionado
        <Button size="icon-sm" variant="ghost" aria-label="Eliminar elemento" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </legend>
      <div className="grid gap-3 sm:grid-cols-4">
        <InputGroupField label="Etiqueta" value={element.label ?? ""} maxLength={40} onChange={(e) => onChange({ label: e.target.value })} />
        {element.type === "block" && (
          <>
            <InputGroupField label="Filas" inputMode="numeric" value={String((element as BlockElement).rows)} onChange={(e) => onChange({ rows: Math.min(LIMITS.rows, Math.max(1, numeric(e.target.value))) } as Partial<LayoutElement>)} />
            <InputGroupField label="Asientos por fila" inputMode="numeric" value={String((element as BlockElement).cols)} onChange={(e) => onChange({ cols: Math.min(LIMITS.cols, Math.max(1, numeric(e.target.value))) } as Partial<LayoutElement>)} />
            <InputGroupField label="Prefijo del código" value={(element as BlockElement).prefix} maxLength={6} onChange={(e) => onChange({ prefix: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() } as Partial<LayoutElement>)} />
            <FormCombobox label="Sección" options={sectionOptions} value={(element as BlockElement).sectionId ?? ""} onChange={(v) => onChange({ sectionId: v } as Partial<LayoutElement>)} onClear={() => onChange({ sectionId: undefined } as Partial<LayoutElement>)} placeholder="Sin sección" />
          </>
        )}
        {element.type === "table" && (
          <>
            <InputGroupField label="Código de mesa" value={(element as TableElement).code} maxLength={6} onChange={(e) => onChange({ code: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() } as Partial<LayoutElement>)} />
            <InputGroupField label="Lugares" inputMode="numeric" value={String((element as TableElement).seats)} onChange={(e) => onChange({ seats: Math.min(LIMITS.tableSeats, Math.max(1, numeric(e.target.value))) } as Partial<LayoutElement>)} />
            <FormCombobox
              label="Forma"
              options={[
                { value: "round", label: "Redonda" },
                { value: "rect", label: "Rectangular" },
              ]}
              value={(element as TableElement).shape}
              onChange={(v) => onChange({ shape: v } as Partial<LayoutElement>)}
              clearable={false}
            />
            <FormCombobox label="Sección" options={sectionOptions} value={(element as TableElement).sectionId ?? ""} onChange={(v) => onChange({ sectionId: v } as Partial<LayoutElement>)} onClear={() => onChange({ sectionId: undefined } as Partial<LayoutElement>)} placeholder="Sin sección" />
          </>
        )}
        {(element.type === "stage" || element.type === "door" || element.type === "wall" || element.type === "label") && (
          <>
            <InputGroupField label="Ancho" inputMode="numeric" value={String((element as DecorElement).w)} onChange={(e) => onChange({ w: Math.max(10, numeric(e.target.value)) } as Partial<LayoutElement>)} />
            <InputGroupField label="Alto" inputMode="numeric" value={String((element as DecorElement).h)} onChange={(e) => onChange({ h: Math.max(10, numeric(e.target.value)) } as Partial<LayoutElement>)} />
          </>
        )}
      </div>
    </fieldset>
  )
}
