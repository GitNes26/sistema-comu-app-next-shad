"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { ArrowLeft, Maximize2, Minus, Plus } from "lucide-react"
import { computeSeats, sellableSeats, zoneStats, type Layout, type LayoutElement } from "@/lib/events/rules"
import { cn } from "@/lib/utils"
import { PlanScene } from "./plan-scene"
import { usePlanViewport } from "./use-plan-viewport"

// Plano del área: se dibuja en SVG (2D) y, con `view3d`, se inclina en perspectiva.
// Con `overview` funciona en dos niveles, como las boleteras: primero se ven las zonas
// (con lo que queda libre) y al tocar una se acerca para elegir el asiento exacto.
// Lo usan el editor de áreas, el acomodo del personal y la elección de lugar.

export interface SeatMapProps {
  width: number
  height: number
  layout: Layout
  /** Asientos ocupados. */
  taken?: Set<string>
  /** Asiento propio (se resalta). */
  mine?: string | null
  selected?: string | null
  /** Varios asientos elegidos (tiene prioridad sobre `selected`). */
  selectedSeats?: Set<string>
  /** Quién ocupa cada asiento (vista del personal). */
  occupants?: Map<string, string>
  interactive?: boolean
  view3d?: boolean
  className?: string
  onSeatClick?: (code: string) => void
  /** Editor: arrastre de elementos. */
  onElementPointerDown?: (el: LayoutElement, e: React.PointerEvent) => void
  selectedElementId?: string | null
  /** Letras de fila y números de asiento en el plano (por defecto, en los interactivos). */
  showAxes?: boolean
  /** Dos niveles: zonas primero, asiento después. */
  overview?: boolean
  /** Zoom y desplazamiento con gestos (por defecto, en los interactivos). */
  zoomable?: boolean
  /** Avisa cuando se entra o sale de una zona. */
  onFocusChange?: (zoneId: string | null) => void
}

export interface SeatMapHandle {
  /** Acerca el mapa a una zona (o regresa al plano completo con `null`). */
  focusZone: (zoneId: string | null) => void
  /** Acerca el mapa a un asiento. */
  focusSeat: (code: string) => void
}

export const SeatMap = forwardRef<SVGSVGElement, SeatMapProps & { handleRef?: React.Ref<SeatMapHandle> }>(function SeatMap(
  { width, height, layout, taken, mine, selected, selectedSeats, occupants, interactive, view3d, className, onSeatClick, onElementPointerDown, selectedElementId, showAxes, overview, zoomable, onFocusChange, handleRef },
  ref
) {
  const seats = useMemo(() => computeSeats(layout), [layout])
    const stats = useMemo(() => zoneStats(layout, taken), [layout, taken])
  const sellable = useMemo(() => sellableSeats(layout), [layout])
  const [focus, setFocus] = useState<string | null>(null)
  const canZoom = (zoomable ?? Boolean(interactive || overview)) && !view3d
  const twoLevel = Boolean(overview) && !view3d && stats.length > 1
  const planW = width || 1000
  const planH = height || 600

  const vp = usePlanViewport({ width: planW, height: planH, wheel: "ctrl", panOnDrag: true, disabled: !canZoom, maxZoom: 10 })
  const wrapRef = useRef<HTMLDivElement>(null)

  // La ref externa (editor) y la del zoom apuntan al mismo SVG.
  const setSvg = useCallback(
    (node: SVGSVGElement | null) => {
      vp.svgRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref, vp.svgRef]
  )

  const boxOfZone = useCallback(
    (id: string) => {
      const z = stats.find((s) => s.id === id)
      return z ? z.box : null
    },
    [stats]
  )

  const focusZone = useCallback(
    (id: string | null) => {
      setFocus(id)
      onFocusChange?.(id)
      if (id === null) vp.reset()
      else {
        const b = boxOfZone(id)
        if (b) vp.fitBox(b, 70)
      }
    },
    [boxOfZone, onFocusChange, vp]
  )
  const focusSeat = useCallback(
    (code: string) => {
      const s = seats.find((x) => x.code === code)
      if (!s) return
      if (twoLevel) focusZone(s.sectionId ?? "")
      else vp.fitBox({ x: s.x - 60, y: s.y - 40, w: 120, h: 80 }, 20)
    },
    [seats, twoLevel, focusZone, vp]
  )
  useImperativeHandle(handleRef, () => ({ focusZone, focusSeat }), [focusZone, focusSeat])

  // Si cambia el plano o deja de haber dos niveles, se vuelve a la vista completa.
  useEffect(() => {
    if (!twoLevel && focus !== null) setFocus(null)
  }, [twoLevel, focus])

  const selectedSet = useMemo(() => selectedSeats ?? (selected ? new Set([selected]) : new Set<string>()), [selectedSeats, selected])

  const inOverview = twoLevel && focus === null
  const dimZones = useMemo(() => (twoLevel && focus !== null ? new Set(stats.filter((z) => z.id !== focus).map((z) => z.id)) : undefined), [twoLevel, focus, stats])
  const labels = (showAxes ?? Boolean(interactive || occupants)) && !inOverview && (twoLevel ? focus !== null : vp.zoom > 1.25 || !canZoom)
  const selectedIds = useMemo(() => (selectedElementId ? new Set([selectedElementId]) : undefined), [selectedElementId])

  const handleSeat = useCallback(
    (code: string) => {
      if (vp.moved.current) return
      onSeatClick?.(code)
    },
    [onSeatClick, vp.moved]
  )

  // Tocar un asiento elegido fuera de la zona enfocada lo acerca (p. ej. «mejores lugares»).
  const selKey = [...selectedSet].join("|")
  useEffect(() => {
    if (!twoLevel || selectedSet.size === 0) return
    const first = seats.find((s) => selectedSet.has(s.code))
    if (first && (first.sectionId ?? "") !== focus) focusZone(first.sectionId ?? "")
    // solo cuando cambia la selección
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey])

  const touchAction = canZoom ? (vp.zoom > 1.02 || focus !== null ? "none" : "pan-y") : undefined

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden rounded-2xl border bg-muted/30", className)} style={view3d ? { perspective: "1400px" } : undefined}>
      <svg
        ref={setSvg}
        viewBox={canZoom ? vp.viewBox : `0 0 ${planW} ${planH}`}
        className="block h-auto w-full select-none"
        style={
          view3d
            ? { transform: "rotateX(52deg) rotateZ(-14deg) scale(0.86)", transformOrigin: "50% 60%", filter: "drop-shadow(0 18px 14px rgb(0 0 0 / 0.25))", touchAction: "none" }
            : { touchAction: touchAction ?? "none" }
        }
        role="img"
        aria-label="Plano del área"
      >
        <rect x={-4000} y={-4000} width={9000} height={9000} className="fill-background" />
        <PlanScene
          layout={layout}
          seats={seats}
          taken={taken}
          mine={mine}
          selected={selectedSet}
          occupants={occupants}
          dimZones={dimZones}
          dots={inOverview}
          interactive={interactive && !inOverview}
          labels={labels}
          selectedIds={selectedIds}
          onSeatClick={interactive ? (code) => handleSeat(code) : undefined}
          onElementPointerDown={onElementPointerDown}
        />

        {inOverview &&
          stats.map((z) => {
            const full = z.free === 0
            const color = full ? "#9ca3af" : z.color
            const mineHere = sellable.filter((s) => selectedSet.has(s.code) && (s.sectionId ?? "") === z.id).length
            const label = `${z.name} · ${full ? "agotada" : `${z.free} libres`}`
            const w = label.length * 7 + 26
            return (
              <g
                key={z.id}
                role="button"
                tabIndex={0}
                aria-label={`${z.name}: ${full ? "agotada" : `${z.free} lugares libres`}. Toca para elegir tu asiento`}
                style={{ cursor: full ? "not-allowed" : "pointer" }}
                onClick={() => {
                  if (vp.moved.current || full) return
                  focusZone(z.id)
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !full) {
                    e.preventDefault()
                    focusZone(z.id)
                  }
                }}
              >
                {/* Mancha de la zona: sigue la forma de sus filas (también las curvas) */}
                <g opacity={0.2} fill={color}>
                  {sellable
                    .filter((s) => (s.sectionId ?? "") === z.id)
                    .map((s) => (
                      <circle key={s.code} cx={s.x} cy={s.y} r={24} />
                    ))}
                </g>
                <g transform={`translate(${z.anchor.x} ${z.anchor.y})`} className="pointer-events-none">
                  <rect x={-w / 2} y={-14} width={w} height={28} rx={14} fill="var(--card)" stroke={color} strokeWidth={1.5} />
                  <text textAnchor="middle" dominantBaseline="central" className="select-none fill-foreground text-[13px] font-semibold">
                    {label}
                  </text>
                  {mineHere > 0 && (
                    <g transform={`translate(${w / 2} -14)`}>
                      <circle r={11} fill="var(--primary)" />
                      <text textAnchor="middle" dominantBaseline="central" className="select-none text-[12px] font-bold" fill="#fff">
                        {mineHere}
                      </text>
                    </g>
                  )}
                </g>
              </g>
            )
          })}
      </svg>

      {canZoom && (
        <div className="absolute inset-x-2 top-2 flex items-start gap-2">
          {twoLevel && focus !== null && (
            <button type="button" onClick={() => focusZone(null)} className="press inline-flex h-9 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-medium shadow-sm">
              <ArrowLeft className="size-4" /> Todas las zonas
            </button>
          )}
          {twoLevel && focus !== null && <span className="rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium">{stats.find((z) => z.id === focus)?.name}</span>}
          <div className="ml-auto flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
            <button type="button" aria-label="Acercar" className="press grid size-9 place-items-center hover:bg-muted" onClick={() => vp.zoomBy(1.5, undefined, true)}>
              <Plus className="size-4" />
            </button>
            <button type="button" aria-label="Alejar" className="press grid size-9 place-items-center border-t hover:bg-muted" onClick={() => vp.zoomBy(1 / 1.5, undefined, true)}>
              <Minus className="size-4" />
            </button>
            <button type="button" aria-label="Ver todo el plano" className="press grid size-9 place-items-center border-t hover:bg-muted" onClick={() => (twoLevel ? focusZone(null) : vp.reset())}>
              <Maximize2 className="size-4" />
            </button>
          </div>
        </div>
      )}
      {inOverview && <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-muted-foreground">Toca una zona para elegir tu asiento</p>}
    </div>
  )
})

export function SeatLegend({ sections }: { sections: { id: string; name: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {sections.map((s) => (
        <li key={s.id} className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: s.color }} /> {s.name}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-[#9ca3af] opacity-60" /> Ocupado
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-primary" /> Tu lugar / elegido
      </li>
    </ul>
  )
}
