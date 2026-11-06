"use client"

import { memo, useMemo } from "react"
import { SEAT_PITCH, TABLE_RADIUS, rowControl, tableHalf, type BlockElement, type Layout, type LayoutElement, type RowElement, type Seat } from "@/lib/events/rules"

// Dibujo del plano de un área (fondo, escenario, mesas, filas y asientos). Es solo SVG:
// el zoom, el desplazamiento y los gestos los pone quien lo usa (SeatMap o el editor).

export const SEAT_R = 11

export interface PlanSceneProps {
  layout: Layout
  seats: Seat[]
  /** Asientos ocupados. */
  taken?: Set<string>
  /** Asiento propio (se resalta). */
  mine?: string | null
  /** Asientos elegidos. */
  selected?: Set<string>
  /** Quién ocupa cada asiento (vista del personal). */
  occupants?: Map<string, string>
  /** Zonas atenuadas (nivel «sección» del mapa). */
  dimZones?: Set<string>
  /** Solo puntos pequeños (vista general por secciones). */
  dots?: boolean
  /** Asientos tocables. */
  interactive?: boolean
  /** Números de asiento y letras de fila. */
  labels?: boolean
  /** Elementos seleccionados (editor). */
  selectedIds?: Set<string>
  /** Editor: marcos y guías de filas, y plano de fondo para calcar. */
  editing?: boolean
  onSeatClick?: (code: string, e: React.MouseEvent | React.KeyboardEvent) => void
  onElementPointerDown?: (el: LayoutElement, e: React.PointerEvent) => void
  /** Pone cada asiento en su lugar con un marco (selección de asientos del editor). */
  seatMarks?: Set<string>
}

const DECOR_FILL: Record<string, string> = { stage: "#475569", door: "#16a34a", wall: "#94a3b8", label: "transparent", area: "#94a3b8" }

export const PlanScene = memo(function PlanScene({
  layout,
  seats,
  taken,
  mine,
  selected,
  occupants,
  dimZones,
  dots,
  interactive,
  labels,
  selectedIds,
  editing,
  onSeatClick,
  onElementPointerDown,
  seatMarks,
}: PlanSceneProps) {
  const blocked = useMemo(() => new Set(layout.blocked), [layout.blocked])
  const colorOf = (id: string | null) => layout.sections.find((s) => s.id === id)?.color ?? "#64748b"

  // Extremos de cada fila: para escribir su letra a los lados.
  const rowEnds = useMemo(() => {
    if (!labels) return []
    const rows = new Map<string, Seat[]>()
    for (const s of seats) if (!s.rowName.startsWith("Mesa")) rows.set(s.rowKey, [...(rows.get(s.rowKey) ?? []), s])
    const out: { key: string; name: string; x: number; y: number }[] = []
    for (const [key, list] of rows) {
      const sorted = [...list].sort((a, b) => a.seatNo - b.seatNo)
      if (sorted.length < 1) continue
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const push = (s: Seat, n: Seat, tag: string) => {
        const dx = s.x - n.x
        const dy = s.y - n.y
        const len = Math.hypot(dx, dy) || 1
        const [ux, uy] = sorted.length > 1 ? [dx / len, dy / len] : [-1, 0]
        out.push({ key: `${key}${tag}`, name: s.rowName, x: s.x + ux * 24, y: s.y + uy * 24 })
      }
      push(first, sorted[1] ?? first, "a")
      if (sorted.length > 1) push(last, sorted[sorted.length - 2], "b")
    }
    return out
  }, [seats, labels])

  // El plano para calcar solo se ve al editar; el público no lo ve.
  const bg = editing ? layout.background : undefined

  return (
    <>
      {bg && (
        <image
          href={bg.url}
          x={bg.x}
          y={bg.y}
          width={bg.w}
          height={bg.h}
          opacity={bg.opacity / 100}
          preserveAspectRatio="none"
          pointerEvents="none"
        />
      )}

      {layout.elements.map((el) => {
        const sel = selectedIds?.has(el.id) ?? false
        const handlers = onElementPointerDown ? { onPointerDown: (e: React.PointerEvent) => onElementPointerDown(el, e) } : {}
        if (el.type === "stage" || el.type === "door" || el.type === "wall" || el.type === "label" || el.type === "area") {
          const cx = el.x + el.w / 2
          const cy = el.y + el.h / 2
          const isStage = el.type === "stage"
          return (
            <g key={el.id} data-el={el.id} {...handlers} transform={el.rotation ? `rotate(${el.rotation} ${cx} ${cy})` : undefined} style={onElementPointerDown ? { cursor: "grab" } : undefined}>
              <rect
                x={el.x}
                y={el.y}
                width={el.w}
                height={el.h}
                rx={isStage ? 10 : 6}
                fill={DECOR_FILL[el.type]}
                opacity={el.type === "label" ? 1 : el.type === "area" ? 0.22 : 0.9}
                stroke={sel ? "var(--primary)" : isStage ? "#f59e0b" : "none"}
                strokeWidth={sel ? 3 : isStage ? 2 : 0}
                strokeOpacity={isStage && !sel ? 0.7 : 1}
              />
              {isStage && (
                <path d={`M${el.x + 14} ${el.y + el.h + 4} h${el.w - 28}`} stroke="#f59e0b" strokeOpacity={0.45} strokeWidth={3} strokeLinecap="round" />
              )}
              {el.label && (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="pointer-events-none select-none fill-foreground text-[14px]" style={el.type === "label" || el.type === "area" ? undefined : { fill: "#fff" }}>
                  {el.label}
                </text>
              )}
            </g>
          )
        }
        if (el.type === "table") {
          const half = tableHalf(el)
          return (
            <g key={el.id} data-el={el.id} {...handlers} style={onElementPointerDown ? { cursor: "grab" } : undefined}>
              {el.shape === "rect" ? (
                <rect x={el.x - half.a} y={el.y - half.b} width={half.a * 2} height={half.b * 2} rx={8} className="fill-card" stroke={sel ? "var(--primary)" : "#94a3b8"} strokeWidth={sel ? 3 : 1.5} />
              ) : (
                <circle cx={el.x} cy={el.y} r={TABLE_RADIUS} className="fill-card" stroke={sel ? "var(--primary)" : "#94a3b8"} strokeWidth={sel ? 3 : 1.5} />
              )}
              <text x={el.x} y={el.y} textAnchor="middle" dominantBaseline="central" className="pointer-events-none select-none fill-foreground text-[13px] font-semibold">
                {el.code}
              </text>
            </g>
          )
        }
        // Filas y bloques: solo se dibuja una guía cuando están seleccionados o en el editor.
        if (el.type === "row") return <RowGuide key={el.id} el={el} selected={sel} editing={editing} handlers={handlers} />
        const b = el as BlockElement
        const bx = b.x - 18
        const by = b.y - 18
        const bw = (b.cols - 1) * SEAT_PITCH + 36
        const bh = (b.rows - 1) * SEAT_PITCH + 36
        return (
          <g key={el.id} data-el={el.id} {...handlers} transform={b.rotation ? `rotate(${b.rotation} ${b.x + ((b.cols - 1) * SEAT_PITCH) / 2} ${b.y + ((b.rows - 1) * SEAT_PITCH) / 2})` : undefined} style={onElementPointerDown ? { cursor: "grab" } : undefined}>
            <rect x={bx} y={by} width={bw} height={bh} rx={10} fill="transparent" stroke={sel ? "var(--primary)" : "transparent"} strokeWidth={3} strokeDasharray={sel ? "6 4" : undefined} />
            {labels && el.label && (
              <text x={b.x + ((b.cols - 1) * SEAT_PITCH) / 2} y={b.y - 34} textAnchor="middle" className="pointer-events-none select-none fill-muted-foreground text-[13px]">
                {el.label}
              </text>
            )}
          </g>
        )
      })}

      {seats.map((s) => {
        const isTaken = taken?.has(s.code) ?? false
        const isMine = mine === s.code
        const isSelected = selected?.has(s.code) ?? false
        const isBlocked = blocked.has(s.code)
        const dim = dimZones?.has(s.sectionId ?? "") ?? false
        const free = !isTaken && !isBlocked
        const color = colorOf(s.sectionId)
        const clickable = Boolean(interactive && onSeatClick && !dim && (free || isSelected || isMine || editing))
        const occupant = occupants?.get(s.code)
        const marked = seatMarks?.has(s.code) ?? false
        const r = dots ? 5 : SEAT_R
        const fill = isBlocked ? "transparent" : isSelected || isMine ? "var(--primary)" : isTaken ? "#9ca3af" : color
        return (
          <g
            key={s.code}
            data-seat={s.code}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `${s.label}${isBlocked ? ", no disponible" : isTaken ? ", ocupado" : ", libre"}${isMine ? ", tu lugar" : ""}` : undefined}
            aria-pressed={clickable ? isSelected : undefined}
            onClick={clickable ? (e) => onSeatClick?.(s.code, e) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onSeatClick?.(s.code, e)
                    }
                  }
                : undefined
            }
            style={{ cursor: clickable ? "pointer" : "default" }}
            opacity={dim ? 0.2 : 1}
            pointerEvents={dots || dim ? "none" : undefined}
          >
            {!dots && <title>{occupant ? `${s.label} · ${occupant}` : s.label}</title>}
            <rect
              x={s.x - r}
              y={s.y - r}
              width={r * 2}
              height={r * 2}
              rx={dots ? 2 : 5}
              transform={!dots && s.angle ? `rotate(${Math.round(s.angle)} ${s.x} ${s.y})` : undefined}
              fill={fill}
              opacity={isBlocked ? 1 : isTaken ? 0.55 : 0.92}
              stroke={isBlocked ? "#9ca3af" : isMine || isSelected ? "var(--foreground)" : marked ? "var(--primary)" : "none"}
              strokeWidth={isBlocked ? 1 : marked ? 2 : 2.5}
              strokeDasharray={isBlocked ? "3 3" : undefined}
            />
            {labels && !dots && free && (
              <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central" className="pointer-events-none select-none text-[10px] font-semibold" fill="#fff">
                {s.seatNo}
              </text>
            )}
            {isTaken && !isMine && !dots && (
              <path d={`M${s.x - 5} ${s.y - 5} L${s.x + 5} ${s.y + 5} M${s.x + 5} ${s.y - 5} L${s.x - 5} ${s.y + 5}`} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            )}
            {isSelected && !dots && <path d={`M${s.x - 5} ${s.y} l3.5 4 l6.5 -8`} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        )
      })}

      {rowEnds.map((r) => (
        <text key={r.key} x={r.x} y={r.y} textAnchor="middle" dominantBaseline="central" className="pointer-events-none select-none fill-muted-foreground text-[11px] font-semibold">
          {r.name}
        </text>
      ))}
    </>
  )
})

/** Guía de una fila: se ve al seleccionarla (cuerda de la curva) para poder tomarla y arrastrarla. */
function RowGuide({ el, selected, editing, handlers }: { el: RowElement; selected: boolean; editing?: boolean; handlers: Record<string, unknown> }) {
  if (!editing) return null
  const c = rowControl(el)
  const d = `M${el.x} ${el.y} Q${c.x} ${c.y} ${el.x2} ${el.y2}`
  return (
    <g data-el={el.id} {...handlers} style={{ cursor: "grab" }}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={30} strokeLinecap="round" />
      <path d={d} fill="none" stroke={selected ? "var(--primary)" : "currentColor"} strokeOpacity={selected ? 0.9 : 0.12} strokeWidth={selected ? 2.5 : 1.5} strokeDasharray={selected ? "5 4" : undefined} />
    </g>
  )
}
