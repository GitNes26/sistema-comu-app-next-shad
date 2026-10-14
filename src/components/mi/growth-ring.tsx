"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

// Círculo de crecimiento: las siete etapas de la visión como un anillo. Lo recorrido
// se ilumina; la etapa actual late suavemente; lo que sigue queda tenue.

export interface RingStage {
  value: string
  label: string
}

const SIZE = 280
const C = SIZE / 2
const R = 110
const GAP = 4 // grados entre segmentos

function polar(angle: number, r = R) {
  const rad = ((angle - 90) * Math.PI) / 180
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)] as const
}
function arc(start: number, end: number) {
  const [x1, y1] = polar(start)
  const [x2, y2] = polar(end)
  const large = end - start > 180 ? 1 : 0
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

export function GrowthRing({ stages, currentIndex, className }: { stages: RingStage[]; currentIndex: number; className?: string }) {
  const n = stages.length
  const step = 360 / n
  const current = stages[currentIndex]
  const done = Math.max(0, currentIndex)
  const percent = n > 1 ? Math.round(((currentIndex + 1) / n) * 100) : 0

  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-72", className)} role="img" aria-label={`Etapa actual: ${current?.label ?? "sin etapa"}. ${done} de ${n} etapas recorridas.`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-0">
        <defs>
          <filter id="ring-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {stages.map((s, i) => {
          const start = i * step + GAP / 2
          const end = (i + 1) * step - GAP / 2
          const lit = i <= currentIndex
          const isCurrent = i === currentIndex
          return (
            <path
              key={s.value}
              d={arc(start, end)}
              fill="none"
              strokeLinecap="round"
              strokeWidth={isCurrent ? 18 : 14}
              className={cn(
                "transition-all duration-500",
                lit ? "stroke-primary" : "stroke-muted",
                isCurrent && "animate-pulse"
              )}
              style={{ ...(lit ? { filter: "url(#ring-glow)" } : {}), opacity: lit ? 1 : 0.9, transitionDelay: `${i * 70}ms` }}
            >
              <title>{s.label}</title>
            </path>
          )
        })}
        {/* Nodos numerados sobre el anillo */}
        {stages.map((s, i) => {
          const [x, y] = polar(i * step + step / 2, R)
          const lit = i <= currentIndex
          return (
            <g key={`n-${s.value}`}>
              <circle cx={x} cy={y} r={11} className={lit ? "fill-background stroke-primary" : "fill-background stroke-border"} strokeWidth={2} />
              <text x={x} y={y + 4} textAnchor="middle" className={cn("text-[11px] font-semibold", lit ? "fill-primary" : "fill-muted-foreground")}>
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-14 text-center">
        <span className="text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Estás en</span>
        <span className="mt-1 font-heading text-lg leading-tight font-semibold text-balance">{current?.label ?? "—"}</span>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
          <Check className="size-3" /> {percent}%
        </span>
      </div>
    </div>
  )
}
