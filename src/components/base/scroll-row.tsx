"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// Fila que se desplaza en horizontal con flechas a los costados (aparecen solo cuando hay
// más opciones hacia ese lado) y desvanecido en los bordes. Para chips y avisos rápidos.

export function ScrollRow({ children, className, label }: { children: React.ReactNode; className?: string; label?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [edge, setEdge] = React.useState({ left: false, right: false })

  const measure = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdge({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 })
  }, [])

  React.useEffect(() => {
    measure()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, children])

  const scrollBy = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * Math.max(120, (ref.current?.clientWidth ?? 240) * 0.6), behavior: "smooth" })

  const arrow = "press absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-card text-foreground shadow-e1 ring-1 ring-border hover:bg-muted"

  return (
    <div className="relative min-w-0">
      {edge.left && (
        <button type="button" tabIndex={-1} aria-label="Ver opciones anteriores" onClick={() => scrollBy(-1)} className={cn(arrow, "left-0")}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div ref={ref} onScroll={measure} aria-label={label} className={cn("scroll-fade-x no-scrollbar flex gap-2 overflow-x-auto px-1 py-1", className)}>
        {children}
      </div>
      {edge.right && (
        <button type="button" tabIndex={-1} aria-label="Ver más opciones" onClick={() => scrollBy(1)} className={cn(arrow, "right-0")}>
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  )
}
