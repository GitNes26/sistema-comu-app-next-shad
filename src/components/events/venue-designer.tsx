"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Armchair,
  CircleDot,
  Columns3,
  Compass,
  ListOrdered,
  MoveHorizontal,
  MoveVertical,
  Spline,
  TrendingUp,
  Box,
  Copy,
  CopyPlus,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  Group,
  Hand,
  ImageIcon,
  Layers,
  Lock,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Rows3,
  Sparkles,
  Square,
  SquareDashedMousePointer,
  Table2,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Wand2,
  ClipboardPaste,
  Repeat,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DialogComponent } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Attachment } from "@/components/base/attachment"
import { FormCombobox } from "@/components/base/form-combobox"
import { InputGroupField } from "@/components/base/input-group-field"
import { NumberField } from "@/components/base/number-field"
import { SwitchField } from "@/components/base/switch-field"
import { notify } from "@/lib/notify"
import { swalConfirm } from "@/lib/swal"
import { uploadFile } from "@/lib/uploads"
import { LIMITS, ROW_PITCH, SEAT_PITCH, computeSeats, rowControl, rowLength, rowName, type BlockElement, type DecorElement, type Layout, type LayoutElement, type RowElement, type TableElement } from "@/lib/events/rules"
import {
  DEFAULT_TEMPLATE,
  TEMPLATE_INFO,
  ZONE_COLORS,
  alignElements,
  boxesIntersect,
  buildTemplate,
  cloneElements,
  elementBox,
  expandGroups,
  genArcSection,
  genBlockFromRect,
  genStraightSection,
  layoutSummary,
  makeRow,
  mirrorElement,
  moveElement,
  nextGroupName,
  nextPrefix,
  rotateElement,
  seatsInBox,
  uid,
  unionBox,
  type AlignMode,
  type Box as BBox,
  type Generated,
  type TemplateKind,
  type TemplateOpts,
} from "@/lib/events/layout-tools"
import { PlanScene } from "./plan-scene"
import { SeatLegend, SeatMap } from "./seat-map"
import { usePlanViewport } from "./use-plan-viewport"
import { cn } from "@/lib/utils"

// Editor visual de áreas: filas libres (rectas o curvas), secciones asistidas, zonas de
// color, asientos sueltos por zona, plantillas de recinto, copiar/espejo/repetir, deshacer,
// zoom y plano de fondo para calcar. El resultado se guarda como `Venue.layout`.

type Tool = "select" | "row" | "block" | "seats" | "hand"
type Mode = "edit" | "preview" | "3d"
type PanelTab = "props" | "zones" | "items" | "bg"
type Pt = { x: number; y: number }

let clipboard: { elements: LayoutElement[]; groups: { id: string; name: string }[] } | null = null

type Gesture =
  | { kind: "move"; ids: string[]; start: Pt; base: Layout; originals: Map<string, LayoutElement>; changed: boolean }
  | { kind: "marquee"; start: Pt; additive: boolean; seatsMode: boolean }
  | { kind: "draw-row"; start: Pt }
  | { kind: "draw-block"; start: Pt }
  | { kind: "handle"; handle: "start" | "end" | "bend" | "resize" | "rotate"; id: string; base: Layout; changed: boolean }

const numeric = (v: string, allowNegative = false) => {
  const n = Number(v.replace(allowNegative ? /[^\d-]/g : /\D/g, ""))
  return Number.isFinite(n) ? n : 0
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export interface VenueDesignerProps {
  layout: Layout
  onLayoutChange: (l: Layout) => void
  planWidth: number
  planHeight: number
  onPlanSize: (w: number, h: number) => void
  canManage: boolean
}

export function VenueDesigner({ layout, onLayoutChange, planWidth, planHeight, onPlanSize, canManage }: VenueDesignerProps) {
  const [tool, setTool] = useState<Tool>("select")
  const [mode, setMode] = useState<Mode>("edit")
  const [tab, setTab] = useState<PanelTab>("props")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set())
  const [snap, setSnap] = useState(true)
  const [keepSpacing, setKeepSpacing] = useState(true)
  const [activeZone, setActiveZone] = useState<string>(layout.sections[0]?.id ?? "")
  const [ghost, setGhost] = useState<{ kind: "row" | "block" | "marquee"; a: Pt; b: Pt; seats?: number } | null>(null)
  const [wizard, setWizard] = useState<"template" | "section" | "repeat" | null>(null)
  const [previewPick, setPreviewPick] = useState<string | null>(null)

  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const past = useRef<Layout[]>([])
  const future = useRef<Layout[]>([])
  const [, bump] = useState(0)
  const gesture = useRef<Gesture | null>(null)
  const session = useRef<{ prefix: string; groupId: string; groupName: string; count: number } | null>(null)

  const seats = useMemo(() => computeSeats(layout), [layout])
  const seatByCode = useMemo(() => new Map(seats.map((s) => [s.code, s])), [seats])
  const boxes = useMemo(() => new Map(layout.elements.map((e) => [e.id, elementBox(e, seats)])), [layout.elements, seats])
  const summary = useMemo(() => layoutSummary(layout), [layout])
  const selected = useMemo(() => layout.elements.filter((e) => selectedIds.includes(e.id)), [layout.elements, selectedIds])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const sectionOptions = useMemo(() => layout.sections.map((s) => ({ value: s.id, label: s.name })), [layout.sections])

  const vp = usePlanViewport({ width: planWidth || 1000, height: planHeight || 600, wheel: "always", panOnDrag: tool === "hand", maxZoom: 6, minZoom: 0.4 })

  // ── Historial ──────────────────────────────────────────────────────────────
  const record = useCallback((base: Layout) => {
    past.current.push(base)
    if (past.current.length > 80) past.current.shift()
    future.current = []
    bump((n) => n + 1)
  }, [])
  /** Cambio discreto: queda en el historial. */
  const commit = useCallback(
    (next: Layout | ((l: Layout) => Layout)) => {
      const cur = layoutRef.current
      const out = typeof next === "function" ? next(cur) : next
      if (out === cur) return
      record(cur)
      layoutRef.current = out
      onLayoutChange(out)
    },
    [onLayoutChange, record]
  )
  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(layoutRef.current)
    layoutRef.current = prev
    onLayoutChange(prev)
    setSelectedIds((ids) => ids.filter((id) => prev.elements.some((e) => e.id === id)))
    bump((n) => n + 1)
  }, [onLayoutChange])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(layoutRef.current)
    layoutRef.current = next
    onLayoutChange(next)
    bump((n) => n + 1)
  }, [onLayoutChange])

  const sn = useCallback((v: number) => (snap ? Math.round(v / 10) * 10 : Math.round(v)), [snap])
  const patchElements = useCallback(
    (ids: string[], fn: (e: LayoutElement) => LayoutElement) => commit((l) => ({ ...l, elements: l.elements.map((e) => (ids.includes(e.id) ? fn(e) : e)) })),
    [commit]
  )

  // ── Agregar ────────────────────────────────────────────────────────────────
  const viewCenter = useCallback((): Pt => ({ x: Math.round(vp.vb.x + vp.vb.w / 2), y: Math.round(vp.vb.y + vp.vb.h / 2) }), [vp.vb])

  const addGenerated = useCallback(
    (g: Generated) => {
      if (layoutRef.current.elements.length + g.elements.length > LIMITS.elements) {
        notify.error(`Máximo ${LIMITS.elements} elementos en el plano`)
        return false
      }
      commit((l) => ({ ...l, elements: [...l.elements, ...g.elements], groups: [...(l.groups ?? []), ...g.groups], sections: [...l.sections, ...g.sections] }))
      setSelectedIds(g.elements.map((e) => e.id))
      setTool("select")
      return true
    },
    [commit]
  )
  const addDecor = (type: DecorElement["type"]) => {
    const defs = {
      stage: { w: 320, h: 64, label: "Plataforma" },
      door: { w: 100, h: 24, label: "Entrada" },
      wall: { w: 240, h: 12, label: "" },
      area: { w: 220, h: 120, label: "Pasillo" },
      label: { w: 160, h: 28, label: "Texto" },
    } as const
    const c = viewCenter()
    const d = defs[type]
    const el: DecorElement = { id: uid("d"), type, x: sn(c.x - d.w / 2), y: sn(c.y - d.h / 2), ...d }
    commit((l) => ({ ...l, elements: [...l.elements, el] }))
    setSelectedIds([el.id])
    setTool("select")
  }
  const addTable = () => {
    const c = viewCenter()
    const used = new Set(seats.map((s) => s.code))
    let n = layout.elements.filter((e) => e.type === "table").length + 1
    while (used.has(`M${n}-1`)) n += 1
    const el: TableElement = { id: uid("t"), type: "table", x: sn(c.x), y: sn(c.y), code: `M${n}`, seats: 8, shape: "round", sectionId: activeZone || undefined }
    commit((l) => ({ ...l, elements: [...l.elements, el] }))
    setSelectedIds([el.id])
    setTool("select")
  }
  const addZone = () => {
    if (layout.sections.length >= LIMITS.sections) return
    const z = { id: uid("s"), name: `Zona ${layout.sections.length + 1}`, color: ZONE_COLORS[layout.sections.length % ZONE_COLORS.length] }
    commit((l) => ({ ...l, sections: [...l.sections, z] }))
    setActiveZone(z.id)
  }
  /** Hace falta al menos una zona para dibujar filas. */
  const ensureZone = (): string => {
    if (activeZone && layoutRef.current.sections.some((s) => s.id === activeZone)) return activeZone
    const first = layoutRef.current.sections[0]
    if (first) {
      setActiveZone(first.id)
      return first.id
    }
    const z = { id: uid("s"), name: "General", color: ZONE_COLORS[0] }
    commit((l) => ({ ...l, sections: [...l.sections, z] }))
    setActiveZone(z.id)
    return z.id
  }

  // ── Selección y acciones ───────────────────────────────────────────────────
  const selectionBox = (els: LayoutElement[]): BBox | null => unionBox(els.map((e) => boxes.get(e.id) ?? elementBox(e, seats)))
  const centerOf = (els: LayoutElement[]): Pt => {
    const b = selectionBox(els)
    return b ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : viewCenter()
  }

  const duplicate = useCallback(
    (offset = 30) => {
      const src = layoutRef.current.elements.filter((e) => selectedIds.includes(e.id))
      if (src.length === 0) return
      const c = cloneElements(src, layoutRef.current, { dx: offset, dy: offset })
      commit((l) => ({ ...l, elements: [...l.elements, ...c.elements], groups: [...(l.groups ?? []), ...c.groups] }))
      setSelectedIds(c.elements.map((e) => e.id))
    },
    [commit, selectedIds]
  )
  const copy = useCallback(() => {
    const src = layoutRef.current.elements.filter((e) => selectedIds.includes(e.id))
    if (src.length === 0) return
    clipboard = { elements: src, groups: (layoutRef.current.groups ?? []).filter((g) => src.some((e) => e.groupId === g.id)) }
    notify.success(`${src.length} elemento${src.length === 1 ? "" : "s"} copiado${src.length === 1 ? "" : "s"}`)
  }, [selectedIds])
  const paste = useCallback(() => {
    if (!clipboard) return
    const c = cloneElements(clipboard.elements, { ...layoutRef.current, groups: [...(layoutRef.current.groups ?? []), ...clipboard.groups] }, { dx: 40, dy: 40 })
    commit((l) => ({ ...l, elements: [...l.elements, ...c.elements], groups: [...(l.groups ?? []), ...c.groups] }))
    setSelectedIds(c.elements.map((e) => e.id))
  }, [commit])
  const remove = useCallback(() => {
    if (selectedIds.length === 0) return
    commit((l) => {
      const els = l.elements.filter((e) => !selectedIds.includes(e.id))
      return { ...l, elements: els, groups: (l.groups ?? []).filter((g) => els.some((e) => e.groupId === g.id)) }
    })
    setSelectedIds([])
  }, [commit, selectedIds])
  const mirror = (axis: "x" | "y") => {
    if (selected.length === 0) return
    const b = selectionBox(selected)
    if (!b) return
    // Espejo respecto al centro del plano: la copia queda del otro lado del escenario.
    const at = axis === "x" ? planWidth / 2 : planHeight / 2
    const c = cloneElements(selected, layoutRef.current, { dx: 0, dy: 0, transform: (e) => mirrorElement(e, axis, at) })
    commit((l) => ({ ...l, elements: [...l.elements, ...c.elements], groups: [...(l.groups ?? []), ...c.groups] }))
    setSelectedIds(c.elements.map((e) => e.id))
    notify.success("Copia en espejo creada")
  }
  const rotate = (deg: number) => {
    if (selected.length === 0) return
    const c = centerOf(selected)
    patchElements(selectedIds, (e) => rotateElement(e, deg, c.x, c.y))
  }
  const flip = (axis: "x" | "y") => {
    if (selected.length === 0) return
    const b = selectionBox(selected)
    if (!b) return
    const at = axis === "x" ? (b.minX + b.maxX) / 2 : (b.minY + b.maxY) / 2
    patchElements(selectedIds, (e) => mirrorElement(e, axis, at))
  }
  const align = (mode: AlignMode) => {
    if (selected.length < 2) return
    const out = alignElements(selected, mode, layoutRef.current.elements)
    const byId = new Map(out.map((e) => [e.id, e]))
    commit((l) => ({ ...l, elements: l.elements.map((e) => byId.get(e.id) ?? e) }))
  }
  const group = () => {
    if (selected.length < 2) return
    const g = { id: uid("g"), name: nextGroupName(layoutRef.current) }
    commit((l) => ({ ...l, groups: [...(l.groups ?? []), g], elements: l.elements.map((e) => (selectedIds.includes(e.id) ? { ...e, groupId: g.id } : e)) }))
  }
  const ungroup = () => {
    commit((l) => ({
      ...l,
      elements: l.elements.map((e) => (selectedIds.includes(e.id) ? { ...e, groupId: undefined } : e)),
      groups: (l.groups ?? []).filter((g) => l.elements.some((e) => e.groupId === g.id && !selectedIds.includes(e.id))),
    }))
  }
  const repeat = (n: number, dx: number, dy: number) => {
    const src = layoutRef.current.elements.filter((e) => selectedIds.includes(e.id))
    if (src.length === 0) return
    let working = layoutRef.current
    const created: LayoutElement[] = []
    const groups: { id: string; name: string }[] = []
    for (let i = 1; i <= n; i++) {
      const c = cloneElements(src, working, { dx: dx * i, dy: dy * i })
      working = { ...working, elements: [...working.elements, ...c.elements], groups: [...(working.groups ?? []), ...c.groups] }
      created.push(...c.elements)
      groups.push(...c.groups)
    }
    if (working.elements.length > LIMITS.elements) return notify.error(`Máximo ${LIMITS.elements} elementos en el plano`)
    commit(working)
    setSelectedIds(created.map((e) => e.id))
  }
  /** Asigna zona a los elementos elegidos (y limpia las excepciones de sus asientos). */
  const assignZone = (zoneId: string) => {
    const codes = new Set(seats.filter((s) => selectedIds.includes(s.elementId)).map((s) => s.code))
    commit((l) => {
      const zoneOf = Object.fromEntries(Object.entries(l.zoneOf ?? {}).filter(([c]) => !codes.has(c)))
      return { ...l, zoneOf: Object.keys(zoneOf).length ? zoneOf : undefined, elements: l.elements.map((e) => (selectedIds.includes(e.id) && (e.type === "row" || e.type === "block" || e.type === "table") ? { ...e, sectionId: zoneId } : e)) }
    })
  }
  const assignSeatsZone = (zoneId: string) => {
    if (selectedSeats.size === 0) return
    commit((l) => {
      const zoneOf = { ...(l.zoneOf ?? {}) }
      for (const code of selectedSeats) {
        const s = seatByCode.get(code)
        if (!s) continue
        const own = l.elements.find((e) => e.id === s.elementId)
        const ownZone = own && "sectionId" in own ? own.sectionId : undefined
        if (ownZone === zoneId) delete zoneOf[code]
        else zoneOf[code] = zoneId
      }
      return { ...l, zoneOf: Object.keys(zoneOf).length ? zoneOf : undefined }
    })
  }
  const toggleBlockSeats = () => {
    if (selectedSeats.size === 0) return
    commit((l) => {
      const allBlocked = [...selectedSeats].every((c) => l.blocked.includes(c))
      return { ...l, blocked: allBlocked ? l.blocked.filter((c) => !selectedSeats.has(c)) : [...new Set([...l.blocked, ...selectedSeats])] }
    })
  }
  const renumberRows = () => {
    // Nombra las filas seleccionadas A, B, C… de adelante hacia atrás (por posición vertical).
    const rows = selected.filter((e): e is RowElement => e.type === "row").sort((a, b) => a.y + a.y2 - (b.y + b.y2))
    if (rows.length < 2) return
    const labels = new Map(rows.map((r, i) => [r.id, rowName(i)]))
    patchElements(
      rows.map((r) => r.id),
      (e) => (e.type === "row" ? { ...e, rowLabel: labels.get(e.id) ?? e.rowLabel } : e)
    )
  }

  // ── Teclado ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canManage || mode !== "edit") return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest('[role="combobox"],[role="listbox"]'))) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && k === "y") {
        e.preventDefault()
        redo()
      } else if (mod && k === "c") copy()
      else if (mod && k === "v") {
        e.preventDefault()
        paste()
      } else if (mod && k === "d") {
        e.preventDefault()
        duplicate()
      } else if (mod && k === "a") {
        e.preventDefault()
        setSelectedIds(layoutRef.current.elements.map((x) => x.id))
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length) {
          e.preventDefault()
          remove()
        }
      } else if (e.key === "Escape") {
        setSelectedIds([])
        setSelectedSeats(new Set())
        setGhost(null)
        gesture.current = null
        setTool("select")
      } else if (e.key.startsWith("Arrow") && selectedIds.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
        patchElements(selectedIds, (el) => moveElement(el, dx, dy))
      } else if (!mod) {
        if (k === "v") setTool("select")
        else if (k === "r") setTool("row")
        else if (k === "b") setTool("block")
        else if (k === "s") setTool("seats")
        else if (k === "h") setTool("hand")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [canManage, mode, undo, redo, copy, paste, duplicate, remove, selectedIds, patchElements])

  // ── Gestos sobre el plano ──────────────────────────────────────────────────
  const hit = (target: EventTarget | null): { seat?: string; el?: string; handle?: string } => {
    const t = target as Element | null
    const h = t?.closest?.("[data-handle]")
    if (h) return { handle: h.getAttribute("data-handle") ?? undefined }
    const s = t?.closest?.("[data-seat]")
    if (s) {
      const code = s.getAttribute("data-seat") ?? ""
      return { seat: code, el: seatByCode.get(code)?.elementId }
    }
    const e = t?.closest?.("[data-el]")
    return e ? { el: e.getAttribute("data-el") ?? undefined } : {}
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canManage || mode !== "edit" || e.button !== 0 || vp.spaceDown.current || tool === "hand") return
    const p = vp.toPlan(e.clientX, e.clientY)
    const h = hit(e.target)
    try {
      ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
    } catch {
      // algunos navegadores no capturan punteros sintéticos; el gesto sigue funcionando
    }

    if (h.handle && selected.length === 1) {
      gesture.current = { kind: "handle", handle: h.handle as "start", id: selected[0].id, base: layoutRef.current, changed: false }
      return
    }
    if (tool === "row") {
      gesture.current = { kind: "draw-row", start: { x: sn(p.x), y: sn(p.y) } }
      return
    }
    if (tool === "block") {
      gesture.current = { kind: "draw-block", start: { x: sn(p.x), y: sn(p.y) } }
      return
    }
    if (tool === "seats") {
      if (h.seat) {
        const code = h.seat
        setSelectedSeats((cur) => {
          const next = new Set(e.shiftKey ? cur : [])
          if (cur.has(code) && e.shiftKey) next.delete(code)
          else next.add(code)
          return next
        })
        gesture.current = null
        return
      }
      gesture.current = { kind: "marquee", start: p, additive: e.shiftKey, seatsMode: true }
      return
    }
    // herramienta de selección
    if (h.el) {
      const id = h.el
      let ids = selectedIds
      if (e.shiftKey) {
        ids = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, ...expandGroups([id], layoutRef.current.elements)]
        setSelectedIds(ids)
        gesture.current = null
        return
      }
      if (!selectedIds.includes(id)) {
        ids = e.altKey ? [id] : expandGroups([id], layoutRef.current.elements)
        setSelectedIds(ids)
      }
      let base = layoutRef.current
      if (e.altKey) {
        // Alt + arrastrar: copia y mueve la copia
        const src = base.elements.filter((x) => ids.includes(x.id))
        const c = cloneElements(src, base, { dx: 0, dy: 0 })
        base = { ...base, elements: [...base.elements, ...c.elements], groups: [...(base.groups ?? []), ...c.groups] }
        ids = c.elements.map((x) => x.id)
        setSelectedIds(ids)
        layoutRef.current = base
        onLayoutChange(base)
      }
      gesture.current = { kind: "move", ids, start: p, base: layoutRef.current, originals: new Map(layoutRef.current.elements.filter((x) => ids.includes(x.id)).map((x) => [x.id, x])), changed: e.altKey }
      return
    }
    if (!e.shiftKey) {
      setSelectedIds([])
      setSelectedSeats(new Set())
    }
    gesture.current = { kind: "marquee", start: p, additive: e.shiftKey, seatsMode: false }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g) return
    const p = vp.toPlan(e.clientX, e.clientY)
    if (g.kind === "move") {
      const dx = sn(p.x - g.start.x)
      const dy = sn(p.y - g.start.y)
      if (!g.changed && dx === 0 && dy === 0) return
      g.changed = true
      const next = { ...g.base, elements: g.base.elements.map((el) => (g.originals.has(el.id) ? moveElement(g.originals.get(el.id) as LayoutElement, dx, dy) : el)) }
      layoutRef.current = next
      onLayoutChange(next)
    } else if (g.kind === "draw-row" || g.kind === "draw-block") {
      let b = { x: sn(p.x), y: sn(p.y) }
      if (g.kind === "draw-row" && e.shiftKey) {
        const ang = Math.round(Math.atan2(b.y - g.start.y, b.x - g.start.x) / (Math.PI / 12)) * (Math.PI / 12)
        const len = Math.hypot(b.x - g.start.x, b.y - g.start.y)
        b = { x: Math.round(g.start.x + Math.cos(ang) * len), y: Math.round(g.start.y + Math.sin(ang) * len) }
      }
      const seatsN = g.kind === "draw-row" ? Math.min(LIMITS.rowSeats, Math.floor(Math.hypot(b.x - g.start.x, b.y - g.start.y) / SEAT_PITCH) + 1) : undefined
      setGhost({ kind: g.kind === "draw-row" ? "row" : "block", a: g.start, b, seats: seatsN })
    } else if (g.kind === "marquee") {
      setGhost({ kind: "marquee", a: g.start, b: p })
    } else if (g.kind === "handle") {
      const cur = g.base.elements.find((x) => x.id === g.id)
      if (!cur) return
      g.changed = true
      let next: LayoutElement = cur
      if (cur.type === "row") {
        if (g.handle === "start" || g.handle === "end") {
          let q = { x: sn(p.x), y: sn(p.y) }
          const other = g.handle === "start" ? { x: cur.x2, y: cur.y2 } : { x: cur.x, y: cur.y }
          if (e.shiftKey) {
            const ang = Math.round(Math.atan2(q.y - other.y, q.x - other.x) / (Math.PI / 12)) * (Math.PI / 12)
            const len = Math.hypot(q.x - other.x, q.y - other.y)
            q = { x: Math.round(other.x + Math.cos(ang) * len), y: Math.round(other.y + Math.sin(ang) * len) }
          }
          const moved = g.handle === "start" ? { ...cur, x: q.x, y: q.y } : { ...cur, x2: q.x, y2: q.y }
          next = keepSpacing ? { ...moved, seats: clamp(Math.floor(rowLength(moved) / SEAT_PITCH) + 1, 1, LIMITS.rowSeats) } : moved
        } else if (g.handle === "bend") {
          const mx = (cur.x + cur.x2) / 2
          const my = (cur.y + cur.y2) / 2
          const len = Math.hypot(cur.x2 - cur.x, cur.y2 - cur.y) || 1
          const nx = -(cur.y2 - cur.y) / len
          const ny = (cur.x2 - cur.x) / len
          const bend = Math.round((p.x - mx) * nx + (p.y - my) * ny)
          const moved = { ...cur, bend: Math.abs(bend) < 6 ? 0 : bend }
          next = keepSpacing ? { ...moved, seats: clamp(Math.floor(rowLength(moved) / SEAT_PITCH) + 1, 1, LIMITS.rowSeats) } : moved
        }
      } else if (cur.type === "block") {
        if (g.handle === "rotate") {
          const cx = cur.x + ((cur.cols - 1) * SEAT_PITCH) / 2
          const cy = cur.y + ((cur.rows - 1) * SEAT_PITCH) / 2
          let deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90
          if (e.shiftKey || snap) deg = Math.round(deg / 15) * 15
          next = { ...cur, rotation: Math.round(deg) % 360 || undefined }
        }
      } else if (cur.type !== "table") {
        const d = cur as DecorElement
        const cx = d.x + d.w / 2
        const cy = d.y + d.h / 2
        if (g.handle === "rotate") {
          let deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90
          if (e.shiftKey || snap) deg = Math.round(deg / 15) * 15
          next = { ...d, rotation: Math.round(deg) % 360 || undefined }
        } else if (g.handle === "resize") {
          const r = ((-(d.rotation ?? 0)) * Math.PI) / 180
          const q = { x: cx + (p.x - cx) * Math.cos(r) - (p.y - cy) * Math.sin(r), y: cy + (p.x - cx) * Math.sin(r) + (p.y - cy) * Math.cos(r) }
          next = { ...d, w: Math.max(10, sn(q.x - d.x)), h: Math.max(10, sn(q.y - d.y)) }
        }
      }
      const out = { ...g.base, elements: g.base.elements.map((x) => (x.id === g.id ? next : x)) }
      layoutRef.current = out
      onLayoutChange(out)
    }
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    const p = vp.toPlan(e.clientX, e.clientY)
    setGhost(null)
    if (g.kind === "move" || g.kind === "handle") {
      if (g.changed) record(g.base)
      return
    }
    if (g.kind === "marquee") {
      const box: BBox = { minX: Math.min(g.start.x, p.x), minY: Math.min(g.start.y, p.y), maxX: Math.max(g.start.x, p.x), maxY: Math.max(g.start.y, p.y) }
      if (box.maxX - box.minX < 4 && box.maxY - box.minY < 4) return
      if (g.seatsMode) {
        const found = seatsInBox(seats, box).map((s) => s.code)
        setSelectedSeats((cur) => new Set(g.additive ? [...cur, ...found] : found))
      } else {
        const ids = layout.elements.filter((el) => boxesIntersect(boxes.get(el.id) as BBox, box)).map((el) => el.id)
        const withGroups = expandGroups(ids, layout.elements)
        setSelectedIds((cur) => (g.additive ? [...new Set([...cur, ...withGroups])] : withGroups))
      }
      return
    }
    const end = { x: sn(p.x), y: sn(p.y) }
    if (g.kind === "draw-row") {
      let b = end
      if (e.shiftKey) {
        const ang = Math.round(Math.atan2(b.y - g.start.y, b.x - g.start.x) / (Math.PI / 12)) * (Math.PI / 12)
        const len = Math.hypot(b.x - g.start.x, b.y - g.start.y)
        b = { x: Math.round(g.start.x + Math.cos(ang) * len), y: Math.round(g.start.y + Math.sin(ang) * len) }
      }
      if (Math.hypot(b.x - g.start.x, b.y - g.start.y) < SEAT_PITCH) return
      const zone = ensureZone()
      const cur = layoutRef.current
      if (!session.current) {
        const prefix = nextPrefix(cur)
        const name = nextGroupName(cur)
        session.current = { prefix, groupId: uid("g"), groupName: name, count: 0 }
      }
      const s = session.current
      // La numeración de filas continúa si ya existen filas con ese prefijo.
      const sameRows = cur.elements.filter((x) => x.type === "row" && x.prefix === s.prefix).length
      const row = makeRow({ x: g.start.x, y: g.start.y, x2: b.x, y2: b.y, prefix: s.prefix, rowLabel: rowName(sameRows), sectionId: zone, label: s.groupName, groupId: s.groupId })
      s.count++
      commit((l) => ({ ...l, elements: [...l.elements, row], groups: l.groups?.some((x) => x.id === s.groupId) ? l.groups : [...(l.groups ?? []), { id: s.groupId, name: s.groupName }] }))
      setSelectedIds([row.id])
    } else if (g.kind === "draw-block") {
      const rect = { x: Math.min(g.start.x, end.x), y: Math.min(g.start.y, end.y), w: Math.abs(end.x - g.start.x), h: Math.abs(end.y - g.start.y) }
      if (rect.w < SEAT_PITCH && rect.h < ROW_PITCH) return
      const zone = ensureZone()
      const gen = genBlockFromRect(rect, { prefix: nextPrefix(layoutRef.current), sectionId: zone, groupName: nextGroupName(layoutRef.current) })
      addGenerated(gen)
      setTool("select")
    }
  }

  // «Empezar otra sección» al cambiar de herramienta o de zona.
  useEffect(() => {
    if (tool !== "row") session.current = null
  }, [tool])
  useEffect(() => {
    session.current = null
  }, [activeZone])

  // ── Plano de fondo ─────────────────────────────────────────────────────────
  const setBackground = (url: string | null) => {
    if (!url) return commit((l) => ({ ...l, background: undefined }))
    commit((l) => ({ ...l, background: { url, x: 0, y: 0, w: planWidth, h: planHeight, opacity: 45 } }))
  }
  const patchBackground = (c: Partial<NonNullable<Layout["background"]>>) => commit((l) => (l.background ? { ...l, background: { ...l.background, ...c } } : l))

  // ── Plantilla ──────────────────────────────────────────────────────────────
  const applyTemplate = async (opts: TemplateOpts) => {
    if (layout.elements.length > 0) {
      const yes = await swalConfirm("¿Reemplazar el plano actual?", "La plantilla sustituye todos los elementos y zonas. Puedes deshacerlo.", { confirmText: "Reemplazar", danger: true })
      if (!yes) return
    }
    const t = buildTemplate(opts, planWidth, planHeight)
    onPlanSize(t.planWidth, t.planHeight)
    commit({ ...t.layout, background: layout.background })
    setActiveZone(t.layout.sections[0]?.id ?? "")
    setSelectedIds([])
    setWizard(null)
    window.setTimeout(() => vp.reset(), 50)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const single = selected.length === 1 ? selected[0] : null
  const ghostEl = ghost
  const noZone = summary.noZone
  const canEdit = canManage && mode === "edit"

  const rowHandles = single?.type === "row" ? single : null
  const handleSize = Math.max(7, 11 / Math.max(0.5, vp.zoom))
  const decorSel = single && single.type !== "table" && single.type !== "row" && single.type !== "block" ? (single as DecorElement) : null
  const blockSel = single?.type === "block" ? single : null

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string, key: string) => (
    <button
      key={t}
      type="button"
      disabled={!canEdit}
      onClick={() => setTool(t)}
      aria-pressed={tool === t}
      title={`${label} (${key})`}
      className={cn("press flex min-w-14 flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 text-[11px] font-medium disabled:opacity-50", tool === t ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted")}
    >
      {icon}
      {label}
    </button>
  )

  const previewSeat = previewPick

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-1.5">
        {canManage && mode === "edit" && (
          <>
            <div className="flex gap-1">
              {toolBtn("select", <MousePointer2 className="size-4" />, "Mover", "V")}
              {toolBtn("row", <Rows3 className="size-4" />, "Fila", "R")}
              {toolBtn("block", <Grid3x3 className="size-4" />, "Bloque", "B")}
              {toolBtn("seats", <SquareDashedMousePointer className="size-4" />, "Asientos", "S")}
              {toolBtn("hand", <Hand className="size-4" />, "Desplazar", "H")}
            </div>
            <span className="mx-1 hidden h-8 w-px bg-border sm:block" />
            <Button size="sm" variant="outline" onClick={() => setWizard("section")}>
              <Wand2 className="size-4" /> Nueva sección
            </Button>
            <Button size="sm" variant="outline" onClick={() => setWizard("template")}>
              <Sparkles className="size-4" /> Plantilla del recinto
            </Button>
            <AddMenu onDecor={addDecor} onTable={addTable} />
            <span className="mx-1 hidden h-8 w-px bg-border sm:block" />
            <Button size="icon-sm" variant="ghost" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={past.current.length === 0} onClick={undo}>
              <Undo2 className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Rehacer" title="Rehacer (Ctrl+Y)" disabled={future.current.length === 0} onClick={redo}>
              <Redo2 className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Pegar" title="Pegar (Ctrl+V)" disabled={!clipboard} onClick={paste}>
              <ClipboardPaste className="size-4" />
            </Button>
            <Button size="sm" variant={snap ? "secondary" : "ghost"} onClick={() => setSnap((s) => !s)} title="Imán a la cuadrícula">
              <Grid3x3 className="size-4" /> Imán
            </Button>
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {mode === "edit" && (
            <div className="flex overflow-hidden rounded-xl border bg-card">
              <button type="button" aria-label="Alejar" className="press grid size-8 place-items-center hover:bg-muted" onClick={() => vp.zoomBy(1 / 1.3, undefined, true)}>
                <Minus className="size-4" />
              </button>
              <span className="grid min-w-12 place-items-center border-x px-1 text-xs tabular-nums">{Math.round(vp.zoom * 100)}%</span>
              <button type="button" aria-label="Acercar" className="press grid size-8 place-items-center hover:bg-muted" onClick={() => vp.zoomBy(1.3, undefined, true)}>
                <Plus className="size-4" />
              </button>
              <button type="button" aria-label="Ajustar a la pantalla" title="Ajustar" className="press grid size-8 place-items-center border-l hover:bg-muted" onClick={() => vp.reset()}>
                <Maximize2 className="size-4" />
              </button>
            </div>
          )}
          <Button size="sm" variant={mode === "preview" ? "default" : "outline"} onClick={() => setMode((m) => (m === "preview" ? "edit" : "preview"))}>
            <Eye className="size-4" /> Vista del asistente
          </Button>
          <Button size="sm" variant={mode === "3d" ? "default" : "outline"} onClick={() => setMode((m) => (m === "3d" ? "edit" : "3d"))}>
            <Box className="size-4" /> {mode === "3d" ? "Editar" : "Vista 3D"}
          </Button>
        </div>
      </div>

      {/* Acciones sobre la selección */}
      {canEdit && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1.5 text-xs">
          <span className="px-2 font-medium tabular-nums">
            {selected.length} elemento{selected.length === 1 ? "" : "s"}
          </span>
          <Act icon={<CopyPlus className="size-4" />} label="Duplicar" onClick={() => duplicate()} />
          <Act icon={<Copy className="size-4" />} label="Copiar" onClick={copy} />
          <Act icon={<FlipHorizontal2 className="size-4" />} label="Copia en espejo" onClick={() => mirror("x")} />
          <Act icon={<FlipVertical2 className="size-4" />} label="Espejo vertical" onClick={() => mirror("y")} />
          <Act icon={<Repeat className="size-4" />} label="Repetir" onClick={() => setWizard("repeat")} />
          <span className="mx-1 h-5 w-px bg-border" />
          <Act icon={<RotateCcw className="size-4" />} label="Girar −15°" onClick={() => rotate(-15)} iconOnly />
          <Act icon={<RotateCw className="size-4" />} label="Girar +15°" onClick={() => rotate(15)} iconOnly />
          <Act icon={<RotateCw className="size-4" />} label="Girar 90°" onClick={() => rotate(90)} text="90°" />
          <Act icon={<FlipHorizontal2 className="size-4" />} label="Voltear horizontal" onClick={() => flip("x")} iconOnly />
          <Act icon={<FlipVertical2 className="size-4" />} label="Voltear vertical" onClick={() => flip("y")} iconOnly />
          {selected.length > 1 && (
            <>
              <span className="mx-1 h-5 w-px bg-border" />
              <Act icon={<AlignStartHorizontal className="size-4" />} label="Alinear a la izquierda" onClick={() => align("left")} iconOnly />
              <Act icon={<AlignCenterHorizontal className="size-4" />} label="Centrar horizontal" onClick={() => align("center")} iconOnly />
              <Act icon={<AlignEndHorizontal className="size-4" />} label="Alinear a la derecha" onClick={() => align("right")} iconOnly />
              <Act icon={<AlignStartVertical className="size-4" />} label="Alinear arriba" onClick={() => align("top")} iconOnly />
              <Act icon={<AlignCenterVertical className="size-4" />} label="Centrar vertical" onClick={() => align("middle")} iconOnly />
              <Act icon={<AlignEndVertical className="size-4" />} label="Alinear abajo" onClick={() => align("bottom")} iconOnly />
              <Act icon={<Group className="size-4" />} label="Agrupar" onClick={group} />
            </>
          )}
          {selected.some((e) => e.groupId) && <Act icon={<Ungroup className="size-4" />} label="Desagrupar" onClick={ungroup} />}
          <Act icon={<Trash2 className="size-4" />} label="Eliminar" onClick={remove} danger />
        </div>
      )}
      {canEdit && tool === "seats" && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card p-2 text-xs">
          <span className="font-medium tabular-nums">{selectedSeats.size} asientos elegidos</span>
          <span className="text-muted-foreground">Toca o arrastra un recuadro sobre los asientos. Con Shift se suman.</span>
          {selectedSeats.size > 0 && (
            <>
              {layout.sections.map((z) => (
                <button key={z.id} type="button" onClick={() => assignSeatsZone(z.id)} className="press inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 hover:bg-muted">
                  <span className="size-3 rounded-sm" style={{ background: z.color }} /> {z.name}
                </button>
              ))}
              <Button size="sm" variant="outline" onClick={toggleBlockSeats}>
                <Lock className="size-4" /> Bloquear / liberar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedSeats(new Set())}>
                Limpiar
              </Button>
            </>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {/* Lienzo */}
        <div className="flex min-h-[22rem] flex-col gap-2">
          {mode === "edit" ? (
            <div className="relative h-[56dvh] min-h-[20rem] overflow-hidden rounded-2xl border bg-muted/30 lg:h-[calc(100dvh-21rem)]">
              <svg
                ref={vp.svgRef}
                viewBox={vp.viewBox}
                className="block size-full select-none"
                style={{ touchAction: "none", cursor: tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                role="application"
                aria-label="Plano editable del área"
              >
                <defs>
                  <pattern id="dgrid" width={20} height={20} patternUnits="userSpaceOnUse">
                    <circle cx={1} cy={1} r={1} className="fill-muted-foreground/25" />
                  </pattern>
                </defs>
                <rect x={-4000} y={-4000} width={9000} height={9000} className="fill-muted/40" />
                <rect x={0} y={0} width={planWidth} height={planHeight} className="fill-background" />
                <rect x={0} y={0} width={planWidth} height={planHeight} fill="url(#dgrid)" pointerEvents="none" />
                <rect x={0} y={0} width={planWidth} height={planHeight} fill="none" className="stroke-border" strokeWidth={2} pointerEvents="none" />
                <PlanScene layout={layout} seats={seats} selectedIds={selectedSet} editing labels={vp.zoom > 1.1} interactive={false} seatMarks={selectedSeats} selected={selectedSeats} />

                {/* Asientos elegidos en la herramienta «Asientos» */}
                {/* Asas de la fila seleccionada */}
                {rowHandles && canEdit && (
                  <g>
                    {(() => {
                      const c = rowControl(rowHandles)
                      const apex = { x: (rowHandles.x + 2 * c.x + rowHandles.x2) / 4, y: (rowHandles.y + 2 * c.y + rowHandles.y2) / 4 }
                      return (
                        <>
                          <circle data-handle="start" cx={rowHandles.x} cy={rowHandles.y} r={handleSize} className="fill-background stroke-primary" strokeWidth={2.5} style={{ cursor: "move" }} />
                          <circle data-handle="end" cx={rowHandles.x2} cy={rowHandles.y2} r={handleSize} className="fill-background stroke-primary" strokeWidth={2.5} style={{ cursor: "move" }} />
                          <rect data-handle="bend" x={apex.x - handleSize * 0.8} y={apex.y - handleSize * 0.8} width={handleSize * 1.6} height={handleSize * 1.6} transform={`rotate(45 ${apex.x} ${apex.y})`} className="fill-primary stroke-background" strokeWidth={1.5} style={{ cursor: "grab" }} />
                        </>
                      )
                    })()}
                  </g>
                )}
                {decorSel && canEdit && (
                  <g transform={decorSel.rotation ? `rotate(${decorSel.rotation} ${decorSel.x + decorSel.w / 2} ${decorSel.y + decorSel.h / 2})` : undefined}>
                    <circle data-handle="resize" cx={decorSel.x + decorSel.w} cy={decorSel.y + decorSel.h} r={handleSize} className="fill-background stroke-primary" strokeWidth={2.5} style={{ cursor: "nwse-resize" }} />
                    <line x1={decorSel.x + decorSel.w / 2} y1={decorSel.y} x2={decorSel.x + decorSel.w / 2} y2={decorSel.y - 24} className="stroke-primary" strokeWidth={1.5} />
                    <circle data-handle="rotate" cx={decorSel.x + decorSel.w / 2} cy={decorSel.y - 24} r={handleSize} className="fill-primary stroke-background" strokeWidth={1.5} style={{ cursor: "grab" }} />
                  </g>
                )}
                {blockSel && canEdit && (
                  <g transform={blockSel.rotation ? `rotate(${blockSel.rotation} ${blockSel.x + ((blockSel.cols - 1) * SEAT_PITCH) / 2} ${blockSel.y + ((blockSel.rows - 1) * SEAT_PITCH) / 2})` : undefined}>
                    <line x1={blockSel.x + ((blockSel.cols - 1) * SEAT_PITCH) / 2} y1={blockSel.y - 18} x2={blockSel.x + ((blockSel.cols - 1) * SEAT_PITCH) / 2} y2={blockSel.y - 42} className="stroke-primary" strokeWidth={1.5} />
                    <circle data-handle="rotate" cx={blockSel.x + ((blockSel.cols - 1) * SEAT_PITCH) / 2} cy={blockSel.y - 42} r={handleSize} className="fill-primary stroke-background" strokeWidth={1.5} style={{ cursor: "grab" }} />
                  </g>
                )}

                {/* Vista previa de lo que se dibuja */}
                {ghostEl?.kind === "row" && (
                  <g pointerEvents="none">
                    <line x1={ghostEl.a.x} y1={ghostEl.a.y} x2={ghostEl.b.x} y2={ghostEl.b.y} className="stroke-primary" strokeWidth={2} strokeDasharray="6 4" />
                    <text x={(ghostEl.a.x + ghostEl.b.x) / 2} y={(ghostEl.a.y + ghostEl.b.y) / 2 - 12} textAnchor="middle" className="fill-primary text-[14px] font-semibold">
                      {ghostEl.seats} asientos
                    </text>
                  </g>
                )}
                {(ghostEl?.kind === "block" || ghostEl?.kind === "marquee") && (
                  <rect
                    pointerEvents="none"
                    x={Math.min(ghostEl.a.x, ghostEl.b.x)}
                    y={Math.min(ghostEl.a.y, ghostEl.b.y)}
                    width={Math.abs(ghostEl.b.x - ghostEl.a.x)}
                    height={Math.abs(ghostEl.b.y - ghostEl.a.y)}
                    className="fill-primary/10 stroke-primary"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  />
                )}
              </svg>
              {layout.elements.length === 0 && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
                  <div className="pointer-events-auto max-w-sm space-y-3 rounded-2xl border bg-card/95 p-4 text-center shadow-sm">
                    <p className="font-heading text-base font-semibold">Empieza tu recinto</p>
                    <p className="text-sm text-muted-foreground">Arma uno completo con una plantilla, agrega una sección con el asistente o dibuja las filas tú mismo.</p>
                    {canManage && (
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button onClick={() => setWizard("template")}>
                          <Sparkles className="size-4" /> Plantilla del recinto
                        </Button>
                        <Button variant="outline" onClick={() => setWizard("section")}>
                          <Wand2 className="size-4" /> Nueva sección
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <p className="pointer-events-none absolute inset-x-0 bottom-1.5 hidden text-center text-[11px] text-muted-foreground sm:block">
                {tool === "row" && "Arrastra de un extremo al otro de la fila. Shift = ángulos exactos."}
                {tool === "block" && "Arrastra un recuadro: se crean las filas y asientos que quepan."}
                {tool === "seats" && "Elige asientos para asignarles una zona o bloquearlos (pasillos, columnas)."}
                {tool === "select" && "Arrastra para mover · Alt+arrastrar copia · rueda = zoom · espacio+arrastrar = desplazar."}
                {tool === "hand" && "Arrastra para desplazar el plano."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <SeatMap
                width={planWidth}
                height={planHeight}
                layout={layout}
                taken={new Set()}
                selected={previewSeat}
                interactive={mode === "preview"}
                overview={mode === "preview"}
                view3d={mode === "3d"}
                onSeatClick={(c) => setPreviewPick((cur) => (cur === c ? null : c))}
                className="max-h-[68dvh]"
              />
              {mode === "preview" && <p className="text-xs text-muted-foreground">Así lo verá quien aparte su lugar: primero las zonas y, al tocar una, sus asientos.</p>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <SeatLegend sections={layout.sections} />
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {summary.total} lugares a la venta (máx. {LIMITS.seats})
              {noZone > 0 && <span className="ml-2 font-medium text-warning-ink">{noZone} sin zona</span>}
            </span>
          </div>
        </div>

        {/* Panel */}
        <aside className="flex max-h-[60dvh] min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border bg-card p-2.5 lg:max-h-[calc(100dvh-17rem)]">
          <div role="tablist" className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 text-[11px] font-medium">
            {(
              [
                ["props", "Propiedades"],
                ["zones", "Zonas"],
                ["items", "Elementos"],
                ["bg", "Fondo"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("press rounded-lg px-1 py-1.5", tab === k ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {l}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
            {tab === "props" && (
              <PropsPanel
                selected={selected}
                canEdit={canEdit}
                layout={layout}
                sectionOptions={sectionOptions}
                keepSpacing={keepSpacing}
                setKeepSpacing={setKeepSpacing}
                patch={(fn) => patchElements(selectedIds, fn)}
                assignZone={assignZone}
                renumberRows={renumberRows}
                planWidth={planWidth}
                planHeight={planHeight}
                onPlanSize={onPlanSize}
              />
            )}
            {tab === "zones" && (
              <ZonesPanel
                layout={layout}
                seats={seats}
                canEdit={canEdit}
                activeZone={activeZone}
                setActiveZone={setActiveZone}
                addZone={addZone}
                commit={commit}
                selectedCount={selected.length}
                assignZone={assignZone}
              />
            )}
            {tab === "items" && <ItemsPanel layout={layout} seats={seats} selectedIds={selectedSet} onSelect={(id, additive) => setSelectedIds((cur) => (additive ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : expandGroups([id], layout.elements)))} commit={commit} canEdit={canEdit} />}
            {tab === "bg" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Sube una foto o captura del plano real del lugar y dibuja las filas encima. Solo se ve al editar; el público no la ve.</p>
                <Attachment
                  label="Plano para calcar"
                  accept="image/png,image/jpeg,image/webp"
                  cropAspect={planWidth / Math.max(1, planHeight)}
                  value={layout.background?.url ?? null}
                  onChange={setBackground}
                  upload={uploadFile}
                  disabled={!canManage}
                />
                {layout.background && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium">Transparencia · {layout.background.opacity}%</p>
                      <Slider min={5} max={100} step={5} value={[layout.background.opacity]} onValueChange={([v]) => patchBackground({ opacity: v })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField icon={MoveHorizontal} min={-4000} max={4000} step={10} label="Posición X" value={layout.background.x} onChange={(v) => patchBackground({ x: v })} />
                      <NumberField icon={MoveVertical} min={-4000} max={4000} step={10} label="Posición Y" value={layout.background.y} onChange={(v) => patchBackground({ y: v })} />
                      <NumberField icon={MoveHorizontal} min={20} max={4000} step={10} label="Ancho" value={layout.background.w} onChange={(v) => patchBackground({ w: Math.max(20, v) })} />
                      <NumberField icon={MoveVertical} min={20} max={4000} step={10} label="Alto" value={layout.background.h} onChange={(v) => patchBackground({ h: Math.max(20, v) })} />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => patchBackground({ x: 0, y: 0, w: planWidth, h: planHeight })}>
                      <ImageIcon className="size-4" /> Ajustar al plano
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      <SectionWizard
        open={wizard === "section"}
        onClose={() => setWizard(null)}
        layout={layout}
        sectionOptions={sectionOptions}
        activeZone={activeZone}
        planWidth={planWidth}
        planHeight={planHeight}
        center={viewCenter()}
        onCreate={(g) => {
          if (addGenerated(g)) setWizard(null)
        }}
      />
      <TemplateWizard open={wizard === "template"} onClose={() => setWizard(null)} planWidth={planWidth} planHeight={planHeight} onApply={applyTemplate} />
      <RepeatDialog open={wizard === "repeat"} onClose={() => setWizard(null)} onApply={(n, dx, dy) => { repeat(n, dx, dy); setWizard(null) }} defaultStep={selectionBox(selected)} />
    </div>
  )
}

// ── Piezas del editor ──────────────────────────────────────────────────────────

function Act({ icon, label, onClick, iconOnly, danger, text }: { icon: React.ReactNode; label: string; onClick: () => void; iconOnly?: boolean; danger?: boolean; text?: string }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={cn("press inline-flex h-8 items-center gap-1.5 rounded-lg px-2 hover:bg-muted", danger && "text-destructive hover:bg-destructive/10")}>
      {icon}
      {!iconOnly && <span className="hidden sm:inline">{text ?? label}</span>}
    </button>
  )
}

function AddMenu({ onDecor, onTable }: { onDecor: (t: DecorElement["type"]) => void; onTable: () => void }) {
  const [open, setOpen] = useState(false)
  const items: { label: string; icon: React.ReactNode; run: () => void }[] = [
    { label: "Mesa", icon: <Table2 className="size-4" />, run: onTable },
    { label: "Escenario", icon: <Square className="size-4" />, run: () => onDecor("stage") },
    { label: "Puerta", icon: <Square className="size-4" />, run: () => onDecor("door") },
    { label: "Pared", icon: <Minus className="size-4" />, run: () => onDecor("wall") },
    { label: "Pasillo / área", icon: <Layers className="size-4" />, run: () => onDecor("area") },
    { label: "Texto", icon: <Type className="size-4" />, run: () => onDecor("label") },
  ]
  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Plus className="size-4" /> Agregar
      </Button>
      {open && (
        <>
          <button type="button" aria-label="Cerrar" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <ul className="absolute left-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border bg-popover p-1 shadow-md">
            {items.map((i) => (
              <li key={i.label}>
                <button
                  type="button"
                  className="press flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-muted"
                  onClick={() => {
                    i.run()
                    setOpen(false)
                  }}
                >
                  {i.icon} {i.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function PropsPanel({
  selected,
  canEdit,
  layout,
  sectionOptions,
  keepSpacing,
  setKeepSpacing,
  patch,
  assignZone,
  renumberRows,
  planWidth,
  planHeight,
  onPlanSize,
}: {
  selected: LayoutElement[]
  canEdit: boolean
  layout: Layout
  sectionOptions: { value: string; label: string }[]
  keepSpacing: boolean
  setKeepSpacing: (v: boolean) => void
  patch: (fn: (e: LayoutElement) => LayoutElement) => void
  assignZone: (z: string) => void
  renumberRows: () => void
  planWidth: number
  planHeight: number
  onPlanSize: (w: number, h: number) => void
}) {
  if (selected.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Selecciona algo del plano para ver sus propiedades. Tocar una fila selecciona toda su sección.</p>
        <p className="text-xs font-semibold">Tamaño del plano</p>
        <div className="grid grid-cols-2 gap-2">
          <NumberField icon={MoveHorizontal} min={200} max={4000} step={50} label="Ancho" value={planWidth} disabled={!canEdit} onChange={(v) => onPlanSize(clamp(v, 200, 4000), planHeight)} />
          <NumberField icon={MoveVertical} min={200} max={4000} step={50} label="Alto" value={planHeight} disabled={!canEdit} onChange={(v) => onPlanSize(planWidth, clamp(v, 200, 4000))} />
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>Alt + arrastrar duplica lo seleccionado.</li>
          <li>Ctrl+C / Ctrl+V copia y pega, incluso entre áreas.</li>
          <li>Ctrl+Z / Ctrl+Y deshace y rehace.</li>
          <li>Flechas mueven; con Shift, de 10 en 10.</li>
        </ul>
      </div>
    )
  }
  const sectionOf = (e: LayoutElement) => ("sectionId" in e ? e.sectionId : undefined)
  const zones = new Set(selected.map(sectionOf))
  const zoneValue = zones.size === 1 ? [...zones][0] ?? "" : ""
  const rows = selected.filter((e): e is RowElement => e.type === "row")
  const first = selected[0]
  const seatable = selected.some((e) => e.type === "row" || e.type === "block" || e.type === "table")
  const num = (set: (n: number) => Partial<LayoutElement>, min: number, max: number) => (v: string) => patch((e) => ({ ...e, ...set(clamp(numeric(v), min, max)) }) as LayoutElement)

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold">{selected.length === 1 ? ELEMENT_NAME[first.type] : `${selected.length} elementos`}</p>
      {seatable && (
        <FormCombobox
          label="Zona"
          options={sectionOptions}
          value={zoneValue}
          onChange={assignZone}
          placeholder={zones.size > 1 ? "Varias zonas" : "Sin zona"}
          clearable={false}
          disabled={!canEdit}
        />
      )}
      {selected.length === 1 && (
        <InputGroupField label="Nombre en el plano" value={first.label ?? ""} maxLength={40} disabled={!canEdit} onChange={(e) => patch((x) => ({ ...x, label: e.target.value || undefined }))} />
      )}
      {selected.length === 1 && first.type === "row" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <InputGroupField leftIcon={<Rows3 className="size-4" />} label="Fila" value={first.rowLabel} maxLength={4} disabled={!canEdit} onChange={(e) => patch((x) => ({ ...x, rowLabel: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "A" }) as LayoutElement)} />
            <InputGroupField label="Prefijo del código" value={first.prefix} maxLength={6} disabled={!canEdit} onChange={(e) => patch((x) => ({ ...x, prefix: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() }) as LayoutElement)} />
            <NumberField icon={Armchair} min={1} max={LIMITS.rowSeats} step={1} label="Asientos" value={first.seats} disabled={!canEdit} onChange={(v) => num((n) => ({ seats: n }), 1, LIMITS.rowSeats)(String(v))} />
            <NumberField icon={ListOrdered} min={0} max={999} step={1} label="Empieza en" value={first.startNo} disabled={!canEdit} onChange={(v) => num((n) => ({ startNo: n }), 0, 999)(String(v))} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Curva · {first.bend}</p>
            <Slider min={-300} max={300} step={2} value={[first.bend]} disabled={!canEdit} onValueChange={([v]) => patch((x) => ({ ...x, bend: Math.abs(v) < 4 ? 0 : v }) as LayoutElement)} />
          </div>
          <SwitchField label="Numerar de derecha a izquierda" checked={first.reverse} disabled={!canEdit} onCheckedChange={(v) => patch((x) => ({ ...x, reverse: v }) as LayoutElement)} />
          <SwitchField label="Al estirar, conservar la separación" description="Si no, conserva la cantidad de asientos." checked={keepSpacing} onCheckedChange={setKeepSpacing} />
          <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => patch((x) => (x.type === "row" ? { ...x, seats: clamp(Math.floor(rowLength(x) / SEAT_PITCH) + 1, 1, LIMITS.rowSeats) } : x))}>
            Ajustar asientos al largo
          </Button>
        </div>
      )}
      {selected.length > 1 && rows.length > 1 && (
        <div className="space-y-2">
          <NumberField icon={Armchair} label="Asientos por fila (todas)" min={1} max={LIMITS.rowSeats} value={rows[0]?.seats ?? 1} disabled={!canEdit} onChange={(v) => patch((x) => (x.type === "row" ? { ...x, seats: clamp(v, 1, LIMITS.rowSeats) } : x))} />
          <Button size="sm" variant="outline" disabled={!canEdit} onClick={renumberRows}>
            Nombrar filas A, B, C… de adelante hacia atrás
          </Button>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Curva (todas)</p>
            <Slider min={-300} max={300} step={2} value={[0]} disabled={!canEdit} onValueChange={([v]) => patch((x) => (x.type === "row" ? { ...x, bend: v } : x))} />
          </div>
        </div>
      )}
      {selected.length === 1 && first.type === "block" && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField icon={Rows3} min={1} max={LIMITS.rows} step={1} label="Filas" value={first.rows} disabled={!canEdit} onChange={(v) => num((n) => ({ rows: n }), 1, LIMITS.rows)(String(v))} />
          <NumberField icon={Armchair} min={1} max={LIMITS.cols} step={1} label="Asientos por fila" value={first.cols} disabled={!canEdit} onChange={(v) => num((n) => ({ cols: n }), 1, LIMITS.cols)(String(v))} />
          <InputGroupField label="Prefijo del código" value={first.prefix} maxLength={6} disabled={!canEdit} onChange={(e) => patch((x) => ({ ...x, prefix: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() }) as LayoutElement)} />
          <NumberField icon={RotateCw} min={-360} max={360} step={15} label="Giro (°)" value={first.rotation ?? 0} disabled={!canEdit} onChange={(v) => patch((x) => ({ ...x, rotation: clamp(v, -360, 360) || undefined }) as LayoutElement)} />
        </div>
      )}
      {selected.length === 1 && first.type === "table" && (
        <div className="grid grid-cols-2 gap-2">
          <InputGroupField leftIcon={<Table2 className="size-4" />} label="Código de mesa" value={first.code} maxLength={6} disabled={!canEdit} onChange={(e) => patch((x) => ({ ...x, code: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() }) as LayoutElement)} />
          <NumberField icon={Armchair} min={1} max={LIMITS.tableSeats} step={1} label="Lugares" value={first.seats} disabled={!canEdit} onChange={(v) => num((n) => ({ seats: n }), 1, LIMITS.tableSeats)(String(v))} />
          <div className="col-span-2">
            <FormCombobox
              label="Forma"
              options={[
                { value: "round", label: "Redonda" },
                { value: "rect", label: "Rectangular" },
              ]}
              value={first.shape}
              onChange={(v) => patch((x) => ({ ...x, shape: v as "round" | "rect" }) as LayoutElement)}
              clearable={false}
              disabled={!canEdit}
            />
          </div>
        </div>
      )}
      {selected.length === 1 && first.type !== "row" && first.type !== "block" && first.type !== "table" && (
        <div className="grid grid-cols-2 gap-2">
          <NumberField icon={MoveHorizontal} min={10} max={4000} step={10} label="Ancho" value={first.w} disabled={!canEdit} onChange={(v) => num((n) => ({ w: n }), 10, 4000)(String(v))} />
          <NumberField icon={MoveVertical} min={10} max={4000} step={10} label="Alto" value={first.h} disabled={!canEdit} onChange={(v) => num((n) => ({ h: n }), 10, 4000)(String(v))} />
          <NumberField icon={RotateCw} min={-360} max={360} step={15} label="Giro (°)" value={first.rotation ?? 0} disabled={!canEdit} onChange={(v) => patch((x) => ({ ...x, rotation: clamp(v, -360, 360) || undefined }) as LayoutElement)} />
        </div>
      )}
    </div>
  )
}

const ELEMENT_NAME: Record<LayoutElement["type"], string> = { row: "Fila de asientos", block: "Bloque de filas", table: "Mesa", stage: "Escenario", door: "Puerta", wall: "Pared", label: "Texto", area: "Pasillo / área" }

function ZonesPanel({
  layout,
  seats,
  canEdit,
  activeZone,
  setActiveZone,
  addZone,
  commit,
  selectedCount,
  assignZone,
}: {
  layout: Layout
  seats: ReturnType<typeof computeSeats>
  canEdit: boolean
  activeZone: string
  setActiveZone: (id: string) => void
  addZone: () => void
  commit: (fn: (l: Layout) => Layout) => void
  selectedCount: number
  assignZone: (id: string) => void
}) {
  const blocked = new Set(layout.blocked)
  const count = (id: string) => seats.filter((s) => (s.sectionId ?? "") === id && !blocked.has(s.code)).length
  const patchZone = (id: string, c: Partial<{ name: string; color: string }>) => commit((l) => ({ ...l, sections: l.sections.map((z) => (z.id === id ? { ...z, ...c } : z)) }))
  const removeZone = (id: string) =>
    commit((l) => {
      const zoneOf = Object.fromEntries(Object.entries(l.zoneOf ?? {}).filter(([, z]) => z !== id))
      return {
        ...l,
        sections: l.sections.filter((z) => z.id !== id),
        zoneOf: Object.keys(zoneOf).length ? zoneOf : undefined,
        elements: l.elements.map((e) => (("sectionId" in e && e.sectionId === id ? { ...e, sectionId: undefined } : e) as LayoutElement)),
      }
    })
  const noZone = count("")
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Las zonas agrupan asientos por color y por lugar (VIP, Preferente, General…). Lo que dibujes cae en la zona marcada con el punto.</p>
      <ul className="space-y-2">
        {layout.sections.map((z) => (
          <li key={z.id} className="space-y-1.5 rounded-xl border p-2">
            <div className="flex items-center gap-2">
              <button type="button" aria-label={`Dibujar en ${z.name}`} aria-pressed={activeZone === z.id} title="Dibujar en esta zona" onClick={() => setActiveZone(z.id)} className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", activeZone === z.id ? "border-primary" : "border-muted-foreground/40")}>
                {activeZone === z.id && <span className="size-2.5 rounded-full bg-primary" />}
              </button>
              <input type="color" aria-label={`Color de ${z.name}`} value={z.color} disabled={!canEdit} onChange={(e) => patchZone(z.id, { color: e.target.value })} className="size-8 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5" />
              <div className="min-w-0 flex-1">
                <InputGroupField aria-label="Nombre de la zona" value={z.name} maxLength={40} disabled={!canEdit} onChange={(e) => patchZone(z.id, { name: e.target.value })} />
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${z.name}`} disabled={!canEdit} onClick={() => removeZone(z.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 pl-7 text-xs text-muted-foreground">
              <span className="tabular-nums">{count(z.id)} asientos</span>
              {canEdit && selectedCount > 0 && (
                <button type="button" className="press ml-auto rounded-md px-2 py-0.5 font-medium text-primary hover:bg-primary/10" onClick={() => assignZone(z.id)}>
                  Asignar selección
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {noZone > 0 && <p className="rounded-xl bg-warning/15 p-2 text-xs text-warning-ink">{noZone} asientos no tienen zona y no se podrán vender. Asígnalos con «Asignar selección» o con la herramienta Asientos.</p>}
      <Button size="sm" variant="outline" disabled={!canEdit || layout.sections.length >= LIMITS.sections} onClick={addZone}>
        <Plus className="size-4" /> Agregar zona
      </Button>
    </div>
  )
}

function ItemsPanel({
  layout,
  seats,
  selectedIds,
  onSelect,
  commit,
  canEdit,
}: {
  layout: Layout
  seats: ReturnType<typeof computeSeats>
  selectedIds: Set<string>
  onSelect: (id: string, additive: boolean) => void
  commit: (fn: (l: Layout) => Layout) => void
  canEdit: boolean
}) {
  const perElement = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of seats) m.set(s.elementId, (m.get(s.elementId) ?? 0) + 1)
    return m
  }, [seats])
  const groups = layout.groups ?? []
  const ungrouped = layout.elements.filter((e) => !e.groupId)
  const rename = (id: string, name: string) => commit((l) => ({ ...l, groups: (l.groups ?? []).map((g) => (g.id === id ? { ...g, name: name.slice(0, 40) } : g)) }))
  const rowText = (e: LayoutElement) => {
    if (e.type === "row") return `Fila ${e.rowLabel}${e.prefix ? ` · ${e.prefix}` : ""}`
    if (e.type === "block") return `Bloque ${e.prefix}`
    if (e.type === "table") return `Mesa ${e.code}`
    return e.label || ELEMENT_NAME[e.type]
  }
  const item = (e: LayoutElement) => (
    <li key={e.id}>
      <button type="button" onClick={(ev) => onSelect(e.id, ev.shiftKey)} className={cn("press flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted", selectedIds.has(e.id) && "bg-primary/10 font-medium text-primary")}>
        <span className="min-w-0 flex-1 truncate">{rowText(e)}</span>
        {perElement.has(e.id) && <span className="tabular-nums text-muted-foreground">{perElement.get(e.id)}</span>}
      </button>
    </li>
  )
  if (layout.elements.length === 0) return <p className="text-xs text-muted-foreground">Aún no hay elementos.</p>
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const els = layout.elements.filter((e) => e.groupId === g.id)
        const total = els.reduce((a, e) => a + (perElement.get(e.id) ?? 0), 0)
        return (
          <div key={g.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Group className="size-4 shrink-0 text-muted-foreground" />
              <input value={g.name} disabled={!canEdit} onChange={(e) => rename(g.id, e.target.value)} aria-label="Nombre de la sección" className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold outline-none focus:bg-muted" />
              <span className="text-xs tabular-nums text-muted-foreground">{total}</span>
            </div>
            <ul className="ml-3 border-l pl-2">{els.map(item)}</ul>
          </div>
        )
      })}
      {ungrouped.length > 0 && <ul>{ungrouped.map(item)}</ul>}
    </div>
  )
}

// ── Asistentes ─────────────────────────────────────────────────────────────────

function SectionWizard({
  open,
  onClose,
  layout,
  sectionOptions,
  activeZone,
  planWidth,
  planHeight,
  center,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  layout: Layout
  sectionOptions: { value: string; label: string }[]
  activeZone: string
  planWidth: number
  planHeight: number
  center: { x: number; y: number }
  onCreate: (g: Generated) => void
}) {
  const [curved, setCurved] = useState(false)
  const [name, setName] = useState("")
  const [zone, setZone] = useState("")
  const [rows, setRows] = useState(8)
  const [per, setPer] = useState(10)
  const [growth, setGrowth] = useState(0)
  const [bend, setBend] = useState(0)
  const [radius, setRadius] = useState(160)
  const [start, setStart] = useState(20)
  const [end, setEnd] = useState(160)
  const [numbers, setNumbers] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(nextGroupName(layout))
    setZone(activeZone || layout.sections[0]?.id || "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const stage = layout.elements.find((e): e is DecorElement => e.type === "stage")
  const generated = useMemo<Generated>(() => {
    const prefix = nextPrefix(layout)
    if (curved) {
      const c = stage ? { x: stage.x + stage.w / 2, y: stage.y + stage.h / 2 } : { x: center.x, y: center.y - radius }
      return genArcSection({ cx: c.x, cy: c.y, innerRadius: radius, rows, startAngle: start, endAngle: end, growth: Math.max(0, growth), prefix, sectionId: zone || undefined, groupName: name || "Sección", rowStyle: numbers ? "numbers" : "letters" })
    }
    const full = (per - 1 + Math.max(0, growth) * (rows - 1)) * SEAT_PITCH
    return genStraightSection({ x: Math.round(center.x - full / 2), y: Math.round(center.y - (rows * ROW_PITCH) / 2), rows, seatsPerRow: per, growth, bend, prefix, sectionId: zone || undefined, groupName: name || "Sección", rowStyle: numbers ? "numbers" : "letters", frontFirst: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curved, rows, per, growth, bend, radius, start, end, zone, name, numbers, stage?.x, stage?.y, center.x, center.y, layout.elements.length])

  const total = generated.elements.reduce((a, e) => a + (e.type === "row" ? e.seats : 0), 0)
  const preview: Layout = useMemo(
    () => ({ sections: layout.sections, elements: [...layout.elements.map((e) => e), ...generated.elements], blocked: [], groups: [...(layout.groups ?? []), ...generated.groups] }),
    [layout, generated]
  )
  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="4xl"
      title="Nueva sección"
      description="Crea de un jalón varias filas con la cantidad de asientos que quieras."
      icon={<Wand2 />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={total === 0} onClick={() => onCreate(generated)}>
            Crear sección · {total} asientos
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-medium">
            {[
              [false, "Recta"],
              [true, "Curva (alrededor del escenario)"],
            ].map(([v, l]) => (
              <button key={String(l)} type="button" onClick={() => setCurved(v as boolean)} className={cn("press rounded-lg px-2 py-1.5 text-xs", curved === v ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {l}
              </button>
            ))}
          </div>
          <InputGroupField label="Nombre de la sección" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <FormCombobox label="Zona" options={sectionOptions} value={zone} onChange={setZone} placeholder="Sin zona" clearable={false} />
          <div className="grid grid-cols-2 gap-2">
            <NumberField icon={Rows3} min={1} max={LIMITS.rows} step={1} label="Filas" value={rows} onChange={(v) => setRows(clamp(v, 1, LIMITS.rows))} />
            {!curved && <NumberField icon={Armchair} min={1} max={LIMITS.rowSeats} step={1} label="Asientos por fila" value={per} onChange={(v) => setPer(clamp(v, 1, LIMITS.rowSeats))} />}
            <NumberField icon={TrendingUp} min={0} max={20} step={1} label={curved ? "Más por fila (extra)" : "Crece por fila"} value={growth} onChange={(v) => setGrowth(clamp(v, -20, 20))} />
            {!curved && <NumberField icon={Spline} min={-200} max={200} step={5} label="Curva de filas" value={bend} onChange={(v) => setBend(clamp(v, -200, 200))} />}
            {curved && <NumberField icon={CircleDot} min={60} max={1500} step={10} label="Radio interior" value={radius} onChange={(v) => setRadius(clamp(v, 60, 1500))} />}
            {curved && <NumberField icon={Compass} min={-360} max={360} step={5} label="Ángulo inicial" value={start} onChange={(v) => setStart(clamp(v, -360, 360))} />}
            {curved && <NumberField icon={Compass} min={-360} max={720} step={5} label="Ángulo final" value={end} onChange={(v) => setEnd(clamp(v, -360, 720))} />}
          </div>
          <SwitchField label="Numerar las filas 1, 2, 3…" description="Si no, se nombran A, B, C…" checked={numbers} onCheckedChange={setNumbers} />
          {curved && <p className="text-xs text-muted-foreground">{stage ? "Se centra en tu escenario." : "No hay escenario: se centra en la vista actual."} Ángulos: 90° = abajo del centro, 0° = derecha.</p>}
        </div>
        <div className="min-w-0 space-y-2">
          <SeatMap width={planWidth} height={planHeight} layout={preview} className="max-h-[52dvh]" zoomable={false} />
          <p className="text-xs text-muted-foreground tabular-nums">{generated.elements.length} fila(s) · {total} asientos</p>
        </div>
      </div>
    </DialogComponent>
  )
}

function TemplateWizard({ open, onClose, planWidth, planHeight, onApply }: { open: boolean; onClose: () => void; planWidth: number; planHeight: number; onApply: (o: TemplateOpts) => void }) {
  const [opts, setOpts] = useState<TemplateOpts>(DEFAULT_TEMPLATE)
  const set = (c: Partial<TemplateOpts>) => setOpts((o) => ({ ...o, ...c }))
  const built = useMemo(() => buildTemplate(opts, planWidth, planHeight), [opts, planWidth, planHeight])
  const total = useMemo(() => layoutSummary(built.layout).total, [built])
  const tables = opts.kind === "banquet"
  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="4xl"
      title="Plantilla del recinto"
      description="Arma el recinto completo con escenario, zonas y filas; después ajusta lo que quieras."
      icon={<Sparkles />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onApply(opts)}>Usar esta plantilla · {total} lugares</Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <ul className="grid grid-cols-2 gap-2">
            {(Object.keys(TEMPLATE_INFO) as TemplateKind[]).map((k) => (
              <li key={k}>
                <button type="button" aria-pressed={opts.kind === k} onClick={() => set({ kind: k })} className={cn("press h-full w-full rounded-xl border p-2 text-left", opts.kind === k ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                  <span className="block text-sm font-semibold">{TEMPLATE_INFO[k].name}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{TEMPLATE_INFO[k].hint}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <NumberField icon={Layers} min={1} max={4} step={1} label="Zonas (niveles)" value={opts.levels} onChange={(v) => set({ levels: clamp(v, 1, 4) })} />
            {!tables && <NumberField icon={Rows3} min={1} max={40} step={1} label="Filas en total" value={opts.rows} onChange={(v) => set({ rows: clamp(v, 1, 40) })} />}
            {!tables && opts.kind === "theater" && <NumberField icon={Armchair} min={2} max={40} step={1} label="Asientos por fila" value={opts.seatsPerRow} onChange={(v) => set({ seatsPerRow: clamp(v, 2, 40) })} />}
            {!tables && opts.kind === "theater" && <NumberField icon={Columns3} min={1} max={4} step={1} label="Columnas" value={opts.columns} onChange={(v) => set({ columns: clamp(v, 1, 4) })} />}
            {tables && <NumberField icon={Table2} min={1} max={10} step={1} label="Mesas a lo ancho" value={opts.tablesAcross} onChange={(v) => set({ tablesAcross: clamp(v, 1, 10) })} />}
            {tables && <NumberField icon={Table2} min={1} max={10} step={1} label="Mesas a lo largo" value={opts.tablesDown} onChange={(v) => set({ tablesDown: clamp(v, 1, 10) })} />}
            {tables && <NumberField icon={Armchair} min={2} max={LIMITS.tableSeats} step={1} label="Lugares por mesa" value={opts.tableSeats} onChange={(v) => set({ tableSeats: clamp(v, 2, LIMITS.tableSeats) })} />}
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          <SeatMap width={built.planWidth} height={built.planHeight} layout={built.layout} className="max-h-[52dvh]" zoomable={false} />
          <SeatLegend sections={built.layout.sections} />
        </div>
      </div>
    </DialogComponent>
  )
}

function RepeatDialog({ open, onClose, onApply, defaultStep }: { open: boolean; onClose: () => void; onApply: (n: number, dx: number, dy: number) => void; defaultStep: BBox | null }) {
  const [n, setN] = useState(2)
  const [dx, setDx] = useState(0)
  const [dy, setDy] = useState(0)
  useEffect(() => {
    if (!open) return
    setN(2)
    setDx(0)
    setDy(defaultStep ? Math.round(defaultStep.maxY - defaultStep.minY + 30) : 120)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Repetir selección"
      description="Crea varias copias separadas por la distancia que indiques."
      icon={<Repeat />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={n < 1} onClick={() => onApply(n, dx, dy)}>
            Crear {n} copia{n === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <NumberField icon={Copy} min={1} max={20} step={1} label="Copias" value={n} onChange={(v) => setN(clamp(v, 1, 20))} />
        <NumberField icon={MoveHorizontal} min={-2000} max={2000} step={10} label="Separación X" value={dx} onChange={(v) => setDx(clamp(v, -2000, 2000))} />
        <NumberField icon={MoveVertical} min={-2000} max={2000} step={10} label="Separación Y" value={dy} onChange={(v) => setDy(clamp(v, -2000, 2000))} />
      </div>
    </DialogComponent>
  )
}

export type { BlockElement }
