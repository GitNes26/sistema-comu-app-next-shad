"use client"

import { forwardRef, useMemo } from "react"
import { SEAT_PITCH, TABLE_RADIUS, computeSeats, rowName, type BlockElement, type Layout, type LayoutElement } from "@/lib/events/rules"
import { cn } from "@/lib/utils"

// Plano del área: se dibuja en SVG (2D) y, con `view3d`, se inclina en perspectiva
// para verlo como un escenario en 3D. Lo usan el editor de áreas, el acomodo del
// personal y la elección de lugar de quien aparta su boleto.

export interface SeatMapProps {
  width: number
  height: number
  layout: Layout
  /** Asientos ocupados. */
  taken?: Set<string>
  /** Asiento propio (se resalta). */
  mine?: string | null
  selected?: string | null
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
}

const SEAT_R = 11

export const SeatMap = forwardRef<SVGSVGElement, SeatMapProps>(function SeatMap(
  { width, height, layout, taken, mine, selected, occupants, interactive, view3d, className, onSeatClick, onElementPointerDown, selectedElementId, showAxes },
  ref
) {
  const seats = useMemo(() => computeSeats(layout), [layout])
  const blocked = useMemo(() => new Set(layout.blocked), [layout.blocked])
  const axes = showAxes ?? Boolean(interactive || occupants)
  const selectedSeat = selected ? seats.find((s) => s.code === selected) : null
  const colorOf = (sectionId: string | null) => layout.sections.find((s) => s.id === sectionId)?.color ?? "#64748b"

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-muted/30", className)} style={view3d ? { perspective: "1400px" } : undefined}>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full touch-none select-none"
        style={
          view3d
            ? { transform: "rotateX(52deg) rotateZ(-14deg) scale(0.86)", transformOrigin: "50% 60%", filter: "drop-shadow(0 18px 14px rgb(0 0 0 / 0.25))" }
            : undefined
        }
        role="img"
        aria-label="Plano del área"
      >
        <rect x={0} y={0} width={width} height={height} className="fill-background" />

        {layout.elements.map((el) => {
          const selectedEl = selectedElementId === el.id
          const handlers = onElementPointerDown ? { onPointerDown: (e: React.PointerEvent) => onElementPointerDown(el, e), style: { cursor: "grab" } } : {}
          if (el.type === "stage" || el.type === "door" || el.type === "wall" || el.type === "label") {
            const fill = el.type === "stage" ? "#475569" : el.type === "door" ? "#16a34a" : el.type === "wall" ? "#94a3b8" : "transparent"
            return (
              <g key={el.id} {...handlers}>
                <rect x={el.x} y={el.y} width={el.w} height={el.h} rx={6} fill={fill} opacity={el.type === "label" ? 1 : 0.85} stroke={selectedEl ? "var(--primary)" : "none"} strokeWidth={3} />
                {el.label && (
                  <text x={el.x + el.w / 2} y={el.y + el.h / 2} textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[14px]" style={el.type === "label" ? undefined : { fill: "#fff" }}>
                    {el.label}
                  </text>
                )}
              </g>
            )
          }
          if (el.type === "table") {
            return (
              <g key={el.id} {...handlers}>
                {el.shape === "rect" ? (
                  <rect x={el.x - TABLE_RADIUS} y={el.y - TABLE_RADIUS * 0.7} width={TABLE_RADIUS * 2} height={TABLE_RADIUS * 1.4} rx={8} className="fill-card" stroke={selectedEl ? "var(--primary)" : "#94a3b8"} strokeWidth={selectedEl ? 3 : 1.5} />
                ) : (
                  <circle cx={el.x} cy={el.y} r={TABLE_RADIUS} className="fill-card" stroke={selectedEl ? "var(--primary)" : "#94a3b8"} strokeWidth={selectedEl ? 3 : 1.5} />
                )}
                <text x={el.x} y={el.y} textAnchor="middle" dominantBaseline="central" className="fill-foreground text-[13px] font-semibold">
                  {el.code}
                </text>
              </g>
            )
          }
          // bloque de filas: marco para poder arrastrarlo en el editor
          const b = el as BlockElement
          return (
            <g key={el.id} {...handlers}>
              <rect
                x={el.x - 18}
                y={el.y - 18}
                width={(b.cols - 1) * SEAT_PITCH + 36}
                height={(b.rows - 1) * SEAT_PITCH + 36}
                rx={10}
                fill="transparent"
                stroke={selectedEl ? "var(--primary)" : "transparent"}
                strokeWidth={3}
                strokeDasharray={selectedEl ? "6 4" : undefined}
              />
              {axes &&
                Array.from({ length: b.rows }, (_, r) => (
                  <text key={`r${r}`} x={el.x - SEAT_R - 12} y={el.y + r * SEAT_PITCH} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[11px] font-semibold">
                    {rowName(r)}
                  </text>
                ))}
              {axes &&
                Array.from({ length: b.cols }, (_, cI) => (
                  <text key={`c${cI}`} x={el.x + cI * SEAT_PITCH} y={el.y - SEAT_R - 9} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground text-[10px]">
                    {cI + 1}
                  </text>
                ))}
              {el.label && (
                <text x={el.x + ((b.cols - 1) * SEAT_PITCH) / 2} y={el.y - (axes ? 38 : 26)} textAnchor="middle" className="fill-muted-foreground text-[13px]">
                  {el.label}
                </text>
              )}
            </g>
          )
        })}

        {seats.map((s) => {
          const isTaken = taken?.has(s.code) ?? false
          const isMine = mine === s.code
          const isSelected = selected === s.code
          const isBlocked = blocked.has(s.code)
          const free = !isTaken && !isBlocked
          const color = colorOf(s.sectionId)
          const clickable = interactive && (free || isSelected || isMine || Boolean(onSeatClick))
          const occupant = occupants?.get(s.code)
          return (
            <g
              key={s.code}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`${s.label}${isBlocked ? ", no disponible" : isTaken ? ", ocupado" : ", libre"}${isMine ? ", tu lugar" : ""}`}
              aria-pressed={interactive ? isSelected : undefined}
              onClick={clickable ? () => onSeatClick?.(s.code) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onSeatClick?.(s.code)
                      }
                    }
                  : undefined
              }
              style={{ cursor: clickable ? "pointer" : "default" }}
            >
              <title>{occupant ? `${s.label} · ${occupant}` : s.label}</title>
              <rect
                x={s.x - SEAT_R}
                y={s.y - SEAT_R}
                width={SEAT_R * 2}
                height={SEAT_R * 2}
                rx={5}
                fill={isBlocked ? "transparent" : isSelected ? "var(--primary)" : isMine ? "var(--primary)" : isTaken ? "#9ca3af" : color}
                opacity={isBlocked ? 1 : isTaken ? 0.55 : 0.9}
                stroke={isBlocked ? "#9ca3af" : isMine || isSelected ? "var(--foreground)" : "none"}
                strokeWidth={isBlocked ? 1 : 2.5}
                strokeDasharray={isBlocked ? "3 3" : undefined}
              />
              {axes && !isTaken && !isBlocked && (
                <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central" className="pointer-events-none text-[10px] font-semibold" fill="#fff">
                  {s.seatNo}
                </text>
              )}
              {isTaken && !isMine && (
                <path d={`M${s.x - 5} ${s.y - 5} L${s.x + 5} ${s.y + 5} M${s.x + 5} ${s.y - 5} L${s.x - 5} ${s.y + 5}`} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
              )}
            </g>
          )
        })}
        {selectedSeat && (
          <g className="pointer-events-none">
            <rect x={selectedSeat.x - 62} y={selectedSeat.y - SEAT_R - 34} width={124} height={24} rx={12} fill="var(--foreground)" />
            <text x={selectedSeat.x} y={selectedSeat.y - SEAT_R - 22} textAnchor="middle" dominantBaseline="central" className="text-[12px] font-semibold" style={{ fill: "var(--background)" }}>
              {selectedSeat.rowName.startsWith("Mesa") ? `${selectedSeat.rowName} · ${selectedSeat.seatNo}` : `Fila ${selectedSeat.rowName} · ${selectedSeat.seatNo}`}
            </text>
          </g>
        )}
      </svg>
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
