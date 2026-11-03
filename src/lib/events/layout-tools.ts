// Herramientas puras del editor de planos: geometría, copiar/espejo/repetir, alineación
// y generadores de secciones y plantillas. No dependen de React ni de la base de datos.

import {
  LIMITS,
  ROW_PITCH,
  SEAT_PITCH,
  TABLE_RADIUS,
  blockCenter,
  computeSeats,
  rowControl,
  rowLength,
  rowName,
  type DecorElement,
  type Layout,
  type LayoutElement,
  type LayoutGroup,
  type LayoutSection,
  type RowElement,
  type Seat,
} from "@/lib/events/rules"

export const ZONE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#65a30d"]

export const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}`

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const rad = (d: number) => (d * Math.PI) / 180

// ── Geometría ────────────────────────────────────────────────────────────────

export function elementBox(el: LayoutElement, seats?: Seat[]): Box {
  if (el.type === "row" || el.type === "block") {
    const mine = (seats ?? computeSeatsOf(el)).filter((s) => s.elementId === el.id)
    if (mine.length === 0) return { minX: el.x, minY: el.y, maxX: el.x, maxY: el.y }
    return {
      minX: Math.min(...mine.map((s) => s.x)) - 14,
      minY: Math.min(...mine.map((s) => s.y)) - 14,
      maxX: Math.max(...mine.map((s) => s.x)) + 14,
      maxY: Math.max(...mine.map((s) => s.y)) + 14,
    }
  }
  if (el.type === "table") {
    const r = TABLE_RADIUS + 26
    return { minX: el.x - r, minY: el.y - r, maxX: el.x + r, maxY: el.y + r }
  }
  const rot = rad(el.rotation ?? 0)
  const cx = el.x + el.w / 2
  const cy = el.y + el.h / 2
  const hw = (Math.abs(Math.cos(rot)) * el.w + Math.abs(Math.sin(rot)) * el.h) / 2
  const hh = (Math.abs(Math.sin(rot)) * el.w + Math.abs(Math.cos(rot)) * el.h) / 2
  return { minX: cx - hw, minY: cy - hh, maxX: cx + hw, maxY: cy + hh }
}

function computeSeatsOf(el: LayoutElement): Seat[] {
  return computeSeats({ sections: [], elements: [el], blocked: [] })
}

export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  }
}

export const boxesIntersect = (a: Box, b: Box) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY

export function layoutBox(layout: Layout, planWidth: number, planHeight: number): Box {
  const seats = computeSeats(layout)
  const boxes = layout.elements.map((e) => elementBox(e, seats))
  return unionBox([...boxes, { minX: 0, minY: 0, maxX: planWidth, maxY: planHeight }]) as Box
}

// ── Transformaciones ─────────────────────────────────────────────────────────

export function moveElement<T extends LayoutElement>(el: T, dx: number, dy: number): T {
  if (el.type === "row") return { ...el, x: el.x + dx, y: el.y + dy, x2: el.x2 + dx, y2: el.y2 + dy }
  return { ...el, x: el.x + dx, y: el.y + dy }
}

/** Gira un elemento alrededor de un punto. Los bloques y decorados guardan el giro; las filas mueven sus extremos. */
export function rotateElement(el: LayoutElement, deg: number, cx: number, cy: number): LayoutElement {
  const r = rad(deg)
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const rot = (x: number, y: number) => ({ x: cx + (x - cx) * cos - (y - cy) * sin, y: cy + (x - cx) * sin + (y - cy) * cos })
  if (el.type === "row") {
    const a = rot(el.x, el.y)
    const b = rot(el.x2, el.y2)
    return { ...el, x: Math.round(a.x), y: Math.round(a.y), x2: Math.round(b.x), y2: Math.round(b.y) }
  }
  if (el.type === "table") {
    const p = rot(el.x, el.y)
    return { ...el, x: Math.round(p.x), y: Math.round(p.y) }
  }
  if (el.type === "block") {
    const c = blockCenter(el)
    const p = rot(c.x, c.y)
    return {
      ...el,
      x: Math.round(p.x - ((el.cols - 1) * SEAT_PITCH) / 2),
      y: Math.round(p.y - ((el.rows - 1) * SEAT_PITCH) / 2),
      rotation: normDeg((el.rotation ?? 0) + deg),
    }
  }
  const c = rot(el.x + el.w / 2, el.y + el.h / 2)
  return { ...el, x: Math.round(c.x - el.w / 2), y: Math.round(c.y - el.h / 2), rotation: normDeg((el.rotation ?? 0) + deg) }
}

const normDeg = (d: number) => {
  let v = Math.round(d) % 360
  if (v > 180) v -= 360
  if (v < -180) v += 360
  return v || undefined
}

/** Espejo respecto a una línea vertical (`axis: "x"`) u horizontal (`axis: "y"`). */
export function mirrorElement(el: LayoutElement, axis: "x" | "y", at: number): LayoutElement {
  const fx = (v: number) => Math.round(2 * at - v)
  if (el.type === "row") {
    return axis === "x"
      ? { ...el, x: fx(el.x), x2: fx(el.x2), bend: -el.bend }
      : { ...el, y: fx(el.y), y2: fx(el.y2), bend: -el.bend }
  }
  if (el.type === "table") return axis === "x" ? { ...el, x: fx(el.x) } : { ...el, y: fx(el.y) }
  if (el.type === "block") {
    const c = blockCenter(el)
    const w = (el.cols - 1) * SEAT_PITCH
    const h = (el.rows - 1) * SEAT_PITCH
    const rot = axis === "x" ? -(el.rotation ?? 0) : 180 - (el.rotation ?? 0)
    return axis === "x"
      ? { ...el, x: Math.round(fx(c.x) - w / 2), rotation: normDeg(rot) }
      : { ...el, y: Math.round(fx(c.y) - h / 2), rotation: normDeg(rot) }
  }
  const rot = axis === "x" ? -(el.rotation ?? 0) : -(el.rotation ?? 0)
  return axis === "x" ? { ...el, x: Math.round(fx(el.x + el.w) ), rotation: normDeg(rot) } : { ...el, y: Math.round(fx(el.y + el.h)), rotation: normDeg(rot) }
}

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom"

export function alignElements(els: LayoutElement[], mode: AlignMode, all: LayoutElement[]): LayoutElement[] {
  const seats = computeSeats({ sections: [], elements: all, blocked: [] })
  const boxes = new Map(els.map((e) => [e.id, elementBox(e, seats)]))
  const u = unionBox([...boxes.values()])
  if (!u) return els
  return els.map((e) => {
    const b = boxes.get(e.id) as Box
    let dx = 0
    let dy = 0
    if (mode === "left") dx = u.minX - b.minX
    if (mode === "right") dx = u.maxX - b.maxX
    if (mode === "center") dx = (u.minX + u.maxX) / 2 - (b.minX + b.maxX) / 2
    if (mode === "top") dy = u.minY - b.minY
    if (mode === "bottom") dy = u.maxY - b.maxY
    if (mode === "middle") dy = (u.minY + u.maxY) / 2 - (b.minY + b.maxY) / 2
    return moveElement(e, Math.round(dx), Math.round(dy))
  })
}

// ── Códigos únicos al copiar ─────────────────────────────────────────────────

/** Cambia prefijo o código hasta que ninguno de sus asientos choque con `used`. */
export function dedupeElement(el: LayoutElement, used: Set<string>): LayoutElement {
  const collides = (candidate: LayoutElement) => computeSeatsOf(candidate).some((s) => used.has(s.code))
  if (!collides(el)) return el
  if (el.type === "table") {
    const base = el.code.replace(/\d+$/, "") || "M"
    for (let n = 1; n < 1000; n++) {
      const next = { ...el, code: `${base}${n}`.slice(0, 12) }
      if (!collides(next)) return next
    }
    return el
  }
  if (el.type === "row" || el.type === "block") {
    const base = el.prefix.replace(/\d+$/, "")
    for (let n = 2; n < 100; n++) {
      const next = { ...el, prefix: `${base}${n}`.slice(0, 6) }
      if (!collides(next)) return next
    }
  }
  return el
}

/** Copia elementos con ids nuevos (y códigos únicos) desplazados; los grupos se copian completos. */
export function cloneElements(
  source: LayoutElement[],
  layout: Layout,
  opts: { dx: number; dy: number; transform?: (el: LayoutElement) => LayoutElement }
): { elements: LayoutElement[]; groups: LayoutGroup[] } {
  const used = new Set(computeSeats(layout).map((s) => s.code))
  const groupMap = new Map<string, string>()
  const groups: LayoutGroup[] = []
  const out: LayoutElement[] = []
  for (const el of source) {
    let next: LayoutElement = { ...el, id: uid(el.type[0]) }
    if (opts.transform) next = opts.transform(next)
    next = moveElement(next, opts.dx, opts.dy)
    if (el.groupId) {
      if (!groupMap.has(el.groupId)) {
        const name = layout.groups?.find((g) => g.id === el.groupId)?.name ?? "Grupo"
        const gid = uid("g")
        groupMap.set(el.groupId, gid)
        groups.push({ id: gid, name: `${name} (copia)`.slice(0, 40) })
      }
      next = { ...next, groupId: groupMap.get(el.groupId) }
    }
    next = dedupeElement(next, used)
    for (const s of computeSeatsOf(next)) used.add(s.code)
    out.push(next)
  }
  return { elements: out, groups }
}

// ── Selección ────────────────────────────────────────────────────────────────

/** Expande la selección a todos los elementos de los grupos tocados. */
export function expandGroups(ids: string[], elements: LayoutElement[]): string[] {
  const groups = new Set(elements.filter((e) => ids.includes(e.id) && e.groupId).map((e) => e.groupId))
  if (groups.size === 0) return ids
  return [...new Set([...ids, ...elements.filter((e) => e.groupId && groups.has(e.groupId)).map((e) => e.id)])]
}

export const seatsInBox = (seats: Seat[], box: Box) => seats.filter((s) => s.x >= box.minX && s.x <= box.maxX && s.y >= box.minY && s.y <= box.maxY)

// ── Generadores ──────────────────────────────────────────────────────────────

export interface Generated {
  elements: LayoutElement[]
  groups: LayoutGroup[]
  sections: LayoutSection[]
}

const emptyGen = (): Generated => ({ elements: [], groups: [], sections: [] })

/** Letras o números de fila: «A, B, C…» o «1, 2, 3…». */
export const rowLabelAt = (i: number, style: "letters" | "numbers", first = 0) => (style === "letters" ? rowName(first + i) : String(first + i + 1))

/** Fila recta o curva entre dos puntos con la cantidad de asientos que caben. */
export function makeRow(p: { x: number; y: number; x2: number; y2: number; bend?: number; seats?: number; prefix: string; rowLabel: string; sectionId?: string; label?: string; groupId?: string; startNo?: number; reverse?: boolean }): RowElement {
  const base = { x: p.x, y: p.y, x2: p.x2, y2: p.y2, bend: p.bend ?? 0 }
  const seats = p.seats ?? Math.max(1, Math.min(LIMITS.rowSeats, Math.floor(rowLength(base) / SEAT_PITCH) + 1))
  return {
    id: uid("r"),
    type: "row",
    ...base,
    seats,
    prefix: p.prefix,
    rowLabel: p.rowLabel,
    startNo: p.startNo ?? 1,
    reverse: p.reverse ?? false,
    sectionId: p.sectionId,
    label: p.label,
    groupId: p.groupId,
  }
}

export interface BlockOpts {
  /** Esquina superior izquierda del bloque. */
  x: number
  y: number
  rows: number
  seatsPerRow: number
  /** Asientos que suma (o resta) cada fila respecto a la anterior. */
  growth: number
  /** Desvío de la curva de cada fila (0 = recta). */
  bend: number
  prefix: string
  sectionId?: string
  groupName: string
  rowStyle: "letters" | "numbers"
  /** Primera fila adelante (arriba) o atrás. */
  frontFirst: boolean
  /** Índice de la primera letra/número (para continuar la numeración de otro bloque). */
  firstRow?: number
}

/** Sección recta: varias filas apiladas y centradas, cada una con su cantidad de asientos. */
export function genStraightSection(o: BlockOpts): Generated {
  const out = emptyGen()
  const g: LayoutGroup = { id: uid("g"), name: o.groupName }
  out.groups.push(g)
  const rows = Math.min(o.rows, LIMITS.rows)
  const widest = Math.max(1, o.seatsPerRow + Math.max(0, o.growth) * (rows - 1))
  for (let i = 0; i < rows; i++) {
    const n = Math.max(1, Math.min(LIMITS.rowSeats, o.seatsPerRow + o.growth * i))
    const w = (n - 1) * SEAT_PITCH
    const full = (widest - 1) * SEAT_PITCH
    const x = o.x + (full - w) / 2
    const y = o.y + i * ROW_PITCH
    const label = rowLabelAt(o.frontFirst ? i : rows - 1 - i, o.rowStyle, o.firstRow ?? 0)
    out.elements.push(
      makeRow({ x, y, x2: x + w, y2: y, bend: o.bend, seats: n, prefix: o.prefix, rowLabel: label, sectionId: o.sectionId, label: o.groupName, groupId: g.id })
    )
  }
  return out
}

export interface ArcOpts {
  cx: number
  cy: number
  /** Radio de la primera fila (la más cercana al centro). */
  innerRadius: number
  rows: number
  /** Ángulos en grados; 0 = hacia la derecha, 90 = hacia abajo. */
  startAngle: number
  endAngle: number
  /** Asientos que suma cada fila además de lo que crece por su radio. */
  growth: number
  prefix: string
  sectionId?: string
  groupName: string
  rowStyle: "letters" | "numbers"
  firstRow?: number
}

/** Sección curva alrededor de un centro (escenario): filas concéntricas; los arcos largos se parten en tramos de 90° como máximo. */
export function genArcSection(o: ArcOpts): Generated {
  const out = emptyGen()
  const g: LayoutGroup = { id: uid("g"), name: o.groupName }
  out.groups.push(g)
  const span = o.endAngle - o.startAngle
  const parts = Math.max(1, Math.ceil(Math.abs(span) / 90))
  const step = span / parts
  for (let i = 0; i < Math.min(o.rows, LIMITS.rows); i++) {
    const r = o.innerRadius + i * ROW_PITCH
    const label = rowLabelAt(i, o.rowStyle, o.firstRow ?? 0)
    let next = 1
    for (let k = 0; k < parts; k++) {
      const a0 = rad(o.startAngle + step * k)
      const a1 = rad(o.startAngle + step * (k + 1))
      const p0 = { x: o.cx + Math.cos(a0) * r, y: o.cy + Math.sin(a0) * r }
      const p1 = { x: o.cx + Math.cos(a1) * r, y: o.cy + Math.sin(a1) * r }
      const half = Math.abs(a1 - a0) / 2
      const sagitta = r * (1 - Math.cos(half))
      // El desvío positivo va a la izquierda de p0→p1; el centro queda a la derecha si el giro es horario.
      const sign = a1 > a0 ? -1 : 1
      const row = makeRow({
        x: Math.round(p0.x),
        y: Math.round(p0.y),
        x2: Math.round(p1.x),
        y2: Math.round(p1.y),
        bend: Math.round(sign * sagitta),
        prefix: o.prefix,
        rowLabel: label,
        sectionId: o.sectionId,
        label: o.groupName,
        groupId: g.id,
        startNo: next,
      })
      const grown = Math.max(1, Math.min(LIMITS.rowSeats, row.seats + (o.growth > 0 ? o.growth * i : 0)))
      row.seats = grown
      out.elements.push(row)
      next += grown
    }
  }
  return out
}

export type TemplateKind = "theater" | "horseshoe" | "arena" | "banquet"

export const TEMPLATE_INFO: Record<TemplateKind, { name: string; hint: string }> = {
  theater: { name: "Auditorio", hint: "Filas rectas frente al escenario, con pasillos laterales." },
  horseshoe: { name: "Herradura", hint: "Filas que rodean el escenario en curva abierta." },
  arena: { name: "Arena 360°", hint: "Escenario al centro y gradas en anillo." },
  banquet: { name: "Salón con mesas", hint: "Mesas redondas repartidas por el salón." },
}

export interface TemplateOpts {
  kind: TemplateKind
  /** Niveles o zonas de precio/lugar (1–4): se reparten de adelante hacia atrás. */
  levels: number
  rows: number
  seatsPerRow: number
  /** Para «salón con mesas»: mesas por lado y lugares por mesa. */
  tablesAcross: number
  tablesDown: number
  tableSeats: number
  /** Para auditorio: columnas (secciones a lo ancho). */
  columns: number
}

export const DEFAULT_TEMPLATE: TemplateOpts = { kind: "theater", levels: 2, rows: 10, seatsPerRow: 10, tablesAcross: 4, tablesDown: 3, tableSeats: 8, columns: 3 }

const LEVEL_NAMES = ["Frente", "Medio", "Fondo", "Atrás"]

/** Arma un recinto completo (escenario, zonas y filas) listo para ajustar. */
export function buildTemplate(opts: TemplateOpts, planWidth: number, planHeight: number): { layout: Layout; planWidth: number; planHeight: number } {
  const levels = Math.max(1, Math.min(4, opts.levels))
  const sections: LayoutSection[] = Array.from({ length: levels }, (_, i) => ({
    id: uid("s"),
    name: levels === 1 ? "General" : LEVEL_NAMES[i] ?? `Nivel ${i + 1}`,
    color: ZONE_COLORS[i % ZONE_COLORS.length],
  }))
  const elements: LayoutElement[] = []
  const groups: LayoutGroup[] = []
  const add = (g: Generated) => {
    elements.push(...g.elements)
    groups.push(...g.groups)
  }
  const stage = (x: number, y: number, w: number, h: number, label = "Plataforma"): DecorElement => ({ id: uid("d"), type: "stage", x, y, w, h, label })
  const rowsPerLevel = Math.max(1, Math.round(opts.rows / levels))
  let width = planWidth
  let height = planHeight
  let seatPrefix = 0

  if (opts.kind === "banquet") {
    const colGap = TABLE_RADIUS * 2 + 90
    const rowGap = TABLE_RADIUS * 2 + 80
    width = Math.max(800, opts.tablesAcross * colGap + 120)
    height = Math.max(520, opts.tablesDown * rowGap + 220)
    elements.push(stage(width / 2 - 150, 16, 300, 56))
    let n = 1
    for (let r = 0; r < opts.tablesDown; r++) {
      const level = Math.min(levels - 1, Math.floor((r / opts.tablesDown) * levels))
      for (let c = 0; c < opts.tablesAcross; c++) {
        elements.push({
          id: uid("t"),
          type: "table",
          x: Math.round(60 + colGap / 2 + c * colGap),
          y: Math.round(170 + r * rowGap),
          code: `M${n++}`,
          seats: Math.min(LIMITS.tableSeats, opts.tableSeats),
          shape: "round",
          sectionId: sections[level].id,
        })
      }
    }
    elements.push({ id: uid("d"), type: "door", x: width / 2 - 50, y: height - 36, w: 100, h: 24, label: "Entrada" })
  } else if (opts.kind === "theater") {
    const cols = Math.max(1, Math.min(4, opts.columns))
    const secWidth = (opts.seatsPerRow - 1) * SEAT_PITCH
    const aisle = 70
    width = Math.max(900, cols * secWidth + (cols - 1) * aisle + 200)
    height = Math.max(620, 170 + opts.rows * ROW_PITCH + 120)
    const total = cols * secWidth + (cols - 1) * aisle
    const left = (width - total) / 2
    elements.push(stage(width / 2 - 220, 16, 440, 64))
    for (let lv = 0; lv < levels; lv++) {
      for (let c = 0; c < cols; c++) {
        const letter = String.fromCharCode(65 + seatPrefix++ % 26)
        add(
          genStraightSection({
            x: left + c * (secWidth + aisle),
            y: 130 + lv * rowsPerLevel * ROW_PITCH + lv * 24,
            rows: rowsPerLevel,
            seatsPerRow: opts.seatsPerRow,
            growth: 0,
            bend: 0,
            prefix: letter,
            sectionId: sections[lv].id,
            groupName: cols === 1 ? sections[lv].name : `${sections[lv].name} ${["izq.", "centro", "der.", "extra"][cols === 2 ? c * 2 : c] ?? c + 1}`,
            rowStyle: "letters",
            frontFirst: true,
          })
        )
      }
    }
    height = Math.max(height, 130 + levels * (rowsPerLevel * ROW_PITCH + 24) + 90)
    elements.push({ id: uid("d"), type: "door", x: width / 2 - 50, y: height - 36, w: 100, h: 24, label: "Entrada" })
  } else {
    // Herradura (arco abierto hacia abajo) o anillo completo alrededor del escenario.
    const ring = opts.kind === "arena"
    const inner = 150
    const outer = inner + levels * rowsPerLevel * ROW_PITCH + 40
    width = Math.max(900, outer * 2 + 140)
    height = ring ? outer * 2 + 140 : Math.round(outer * 1.25 + 160)
    const cx = width / 2
    const cy = ring ? height / 2 : 130 + 40
    elements.push(stage(cx - 110, cy - 38, 220, 76, ring ? "Escenario" : "Plataforma"))
    for (let lv = 0; lv < levels; lv++) {
      add(
        genArcSection({
          cx,
          cy,
          innerRadius: inner + lv * rowsPerLevel * ROW_PITCH,
          rows: rowsPerLevel,
          startAngle: ring ? -90 : 20,
          endAngle: ring ? 270 : 160,
          growth: 0,
          prefix: String.fromCharCode(65 + lv),
          sectionId: sections[lv].id,
          groupName: sections[lv].name,
          rowStyle: "letters",
        })
      )
    }
    if (!ring) elements.push({ id: uid("d"), type: "door", x: cx - 50, y: height - 36, w: 100, h: 24, label: "Entrada" })
  }
  return { layout: { sections, elements, blocked: [], groups }, planWidth: Math.round(width), planHeight: Math.round(height) }
}

/** Filas dibujadas con un recuadro: tantas filas y asientos como quepan. */
export function genBlockFromRect(rect: { x: number; y: number; w: number; h: number }, o: { prefix: string; sectionId?: string; groupName: string; firstRow?: number }): Generated {
  const rows = Math.max(1, Math.min(LIMITS.rows, Math.floor(rect.h / ROW_PITCH) + 1))
  const seats = Math.max(1, Math.min(LIMITS.rowSeats, Math.floor(rect.w / SEAT_PITCH) + 1))
  return genStraightSection({
    x: rect.x,
    y: rect.y,
    rows,
    seatsPerRow: seats,
    growth: 0,
    bend: 0,
    prefix: o.prefix,
    sectionId: o.sectionId,
    groupName: o.groupName,
    rowStyle: "letters",
    frontFirst: true,
    firstRow: o.firstRow,
  })
}

/** Siguiente prefijo libre («A», «B»… «Z», «AA»…) para nombrar una sección nueva. */
export function nextPrefix(layout: Layout): string {
  const used = new Set(layout.elements.flatMap((e) => (e.type === "row" || e.type === "block" ? [e.prefix] : [])))
  for (let i = 0; i < 26 * 27; i++) {
    const p = rowName(i)
    if (!used.has(p)) return p
  }
  return uid("p").slice(0, 3).toUpperCase()
}

/** Siguiente nombre de grupo libre dentro del plano. */
export function nextGroupName(layout: Layout, base = "Sección"): string {
  const names = new Set((layout.groups ?? []).map((g) => g.name))
  for (let n = (layout.groups?.length ?? 0) + 1; n < 500; n++) if (!names.has(`${base} ${n}`)) return `${base} ${n}`
  return base
}

/** ¿Cuántos asientos vendibles y cuántos sin zona tiene el plano? */
export function layoutSummary(layout: Layout) {
  const blocked = new Set(layout.blocked)
  const seats = computeSeats(layout).filter((s) => !blocked.has(s.code))
  return { total: seats.length, noZone: seats.filter((s) => !s.sectionId).length }
}

export { rowControl }
