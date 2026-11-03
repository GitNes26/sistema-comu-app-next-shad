"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Zoom y desplazamiento del plano (rueda, pellizco y arrastre) sobre el viewBox del SVG.
// Lo usan el mapa de asientos y el editor de áreas.

export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

interface Options {
  width: number
  height: number
  minZoom?: number
  maxZoom?: number
  /** «always» = la rueda hace zoom; «ctrl» = solo con Ctrl/Cmd (la página sigue desplazándose). */
  wheel?: "always" | "ctrl"
  /** Arrastrar con un dedo/botón principal desplaza el plano (si no, solo el botón medio, espacio o dos dedos). */
  panOnDrag?: boolean
  disabled?: boolean
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const tryCapture = (el: Element, id: number) => {
  try {
    el.setPointerCapture(id)
  } catch {
    /* puntero ya liberado */
  }
}
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

export function usePlanViewport({ width, height, minZoom = 1, maxZoom = 8, wheel = "ctrl", panOnDrag = true, disabled = false }: Options) {
  const full: ViewBox = { x: 0, y: 0, w: Math.max(1, width), h: Math.max(1, height) }
  const [vb, setVb] = useState<ViewBox>(full)
  const vbRef = useRef(vb)
  vbRef.current = vb
  const svgRef = useRef<SVGSVGElement | null>(null)
  const moved = useRef(false)
  const raf = useRef(0)
  const spaceDown = useRef(false)

  // Al cambiar el tamaño del plano, se vuelve a encuadrar completo.
  useEffect(() => {
    setVb({ x: 0, y: 0, w: Math.max(1, width), h: Math.max(1, height) })
  }, [width, height])

  const zoom = width / vb.w

  const limit = useCallback(
    (v: ViewBox): ViewBox => {
      const w = clamp(v.w, width / maxZoom, width / minZoom)
      const h = (w * height) / width
      // se permite salir un poco del plano para poder centrar los bordes
      const mx = width * 0.15
      const my = height * 0.15
      return { w, h, x: clamp(v.x, -mx, width + mx - w), y: clamp(v.y, -my, height + my - h) }
    },
    [width, height, maxZoom, minZoom]
  )

  const animateTo = useCallback(
    (target: ViewBox) => {
      cancelAnimationFrame(raf.current)
      const to = limit(target)
      if (reduceMotion()) {
        setVb(to)
        return
      }
      const from = vbRef.current
      const start = performance.now()
      const dur = 320
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / dur)
        const e = 1 - Math.pow(1 - k, 3)
        setVb({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e })
        if (k < 1) raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    },
    [limit]
  )
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  /** Encuadra un rectángulo (con margen) respetando la proporción del plano. */
  const fitBox = useCallback(
    (box: { x: number; y: number; w: number; h: number }, pad = 40) => {
      const bw = box.w + pad * 2
      const bh = box.h + pad * 2
      const ratio = width / height
      let w = Math.max(bw, bh * ratio)
      let h = w / ratio
      if (h < bh) {
        h = bh
        w = h * ratio
      }
      animateTo({ x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h })
    },
    [width, height, animateTo]
  )
  const reset = useCallback(() => animateTo({ x: 0, y: 0, w: width, h: height }), [animateTo, width, height])

  const toPlan = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const r = svg.getBoundingClientRect()
    const v = vbRef.current
    return { x: v.x + ((clientX - r.left) / r.width) * v.w, y: v.y + ((clientY - r.top) / r.height) * v.h }
  }, [])

  /** Zoom por un factor alrededor de un punto del plano (por defecto, el centro de la vista). */
  const zoomBy = useCallback(
    (factor: number, at?: { x: number; y: number }, animate = false) => {
      const v = vbRef.current
      const p = at ?? { x: v.x + v.w / 2, y: v.y + v.h / 2 }
      const w = clamp(v.w / factor, width / maxZoom, width / minZoom)
      const k = w / v.w
      const next = limit({ w, h: v.h * k, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k })
      if (animate) animateTo(next)
      else setVb(next)
    },
    [width, maxZoom, minZoom, limit, animateTo]
  )

  // Gestos: rueda (no pasiva), arrastre y pellizco.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || disabled) return
    const pointers = new Map<number, { x: number; y: number }>()
    let pan: { sx: number; sy: number; vb: ViewBox; captured: boolean; pid: number } | null = null
    let pinch: { dist: number; vb: ViewBox; mid: { x: number; y: number } } | null = null

    const onWheel = (e: WheelEvent) => {
      if (wheel === "ctrl" && !(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      cancelAnimationFrame(raf.current)
      zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), toPlan(e.clientX, e.clientY))
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) spaceDown.current = e.type === "keydown"
    }
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      moved.current = false
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, vb: vbRef.current, mid: toPlan((a.x + b.x) / 2, (a.y + b.y) / 2) }
        pan = null
        return
      }
      const middle = e.button === 1 || spaceDown.current
      if (panOnDrag || middle) {
        if (e.button === 0 || middle) pan = { sx: e.clientX, sy: e.clientY, vb: vbRef.current, captured: false, pid: e.pointerId }
        if (middle) {
          tryCapture(svg, e.pointerId)
          pan!.captured = true
          e.preventDefault()
        }
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const r = svg.getBoundingClientRect()
      if (pinch && pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1
        const w = clamp(pinch.vb.w * (pinch.dist / d), width / maxZoom, width / minZoom)
        const k = w / pinch.vb.w
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        // el punto medio del pellizco sigue bajo los dedos
        const nx = pinch.mid.x - ((mid.x - r.left) / r.width) * w
        const ny = pinch.mid.y - ((mid.y - r.top) / r.height) * (pinch.vb.h * k)
        moved.current = true
        setVb(limit({ x: nx, y: ny, w, h: pinch.vb.h * k }))
        return
      }
      if (!pan || pan.pid !== e.pointerId) return
      const dx = e.clientX - pan.sx
      const dy = e.clientY - pan.sy
      if (!pan.captured) {
        if (Math.hypot(dx, dy) < 6) return
        tryCapture(svg, e.pointerId)
        pan.captured = true
      }
      moved.current = true
      cancelAnimationFrame(raf.current)
      setVb(limit({ ...pan.vb, x: pan.vb.x - (dx / r.width) * pan.vb.w, y: pan.vb.y - (dy / r.height) * pan.vb.h }))
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = null
      if (pan?.pid === e.pointerId) pan = null
      // el «clic» de un arrastre ya se descartó con `moved`; se limpia en el siguiente tick
      setTimeout(() => {
        if (pointers.size === 0) moved.current = false
      }, 0)
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    svg.addEventListener("pointerdown", onDown)
    svg.addEventListener("pointermove", onMove)
    svg.addEventListener("pointerup", onUp)
    svg.addEventListener("pointercancel", onUp)
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKey)
    return () => {
      svg.removeEventListener("wheel", onWheel)
      svg.removeEventListener("pointerdown", onDown)
      svg.removeEventListener("pointermove", onMove)
      svg.removeEventListener("pointerup", onUp)
      svg.removeEventListener("pointercancel", onUp)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKey)
    }
  }, [disabled, wheel, panOnDrag, width, height, maxZoom, minZoom, limit, toPlan, zoomBy])

  return { svgRef, vb, zoom, moved, spaceDown, setVb, animateTo, fitBox, reset, zoomBy, toPlan, viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}` }
}
