// Reglas puras de Eventos: plano de acomodo, boletos y pagos (sin base de datos).

// ── Plano ────────────────────────────────────────────────────────────────────

export interface LayoutSection {
  id: string
  name: string
  color: string
}

interface ElementBase {
  id: string
  x: number
  y: number
  label?: string
  /** Giro en grados (bloques y elementos decorativos). */
  rotation?: number
  /** Grupo al que pertenece (se mueve junto con sus hermanos). */
  groupId?: string
}
/** Bloque de filas × columnas de asientos. Código del asiento: «<prefijo><fila>-<n>». */
export interface BlockElement extends ElementBase {
  type: "block"
  rows: number
  cols: number
  /** Prefijo del código (p. ej. «C» → «CA-1»). */
  prefix: string
  sectionId?: string
}
/**
 * Fila libre: va del punto (x, y) al (x2, y2), con una curva (`bend` = desvío máximo
 * en unidades del plano; positivo = hacia la derecha de quien va de inicio a fin, visto en pantalla).
 * Código del asiento: «<prefijo><fila>-<n>»; la numeración empieza en `startNo`.
 */
export interface RowElement extends ElementBase {
  type: "row"
  x2: number
  y2: number
  bend: number
  seats: number
  prefix: string
  rowLabel: string
  startNo: number
  /** La numeración corre de fin a inicio. */
  reverse: boolean
  sectionId?: string
}
/** Mesa con N asientos. Código: «<código>-<n>». */
export interface TableElement extends ElementBase {
  type: "table"
  code: string
  seats: number
  shape: "round" | "rect"
  sectionId?: string
}
export interface DecorElement extends ElementBase {
  type: "stage" | "door" | "wall" | "label" | "area"
  w: number
  h: number
}
export type LayoutElement = BlockElement | RowElement | TableElement | DecorElement

/** Conjunto de elementos que se mueve junto («Platea norte»). */
export interface LayoutGroup {
  id: string
  name: string
}

/** Plano de la planta para calcar (foto o captura); no lo ve el público. */
export interface LayoutBackground {
  url: string
  x: number
  y: number
  w: number
  h: number
  /** 0–100. */
  opacity: number
}

export interface Layout {
  /** Zonas (nombre y color): lo que se ve en la leyenda y lo que se asigna a cada asiento. */
  sections: LayoutSection[]
  elements: LayoutElement[]
  /** Asientos que no se venden (pasillos, reservados). */
  blocked: string[]
  groups?: LayoutGroup[]
  /** Asientos sueltos asignados a otra zona distinta de la de su fila: código → zona. */
  zoneOf?: Record<string, string>
  background?: LayoutBackground
}

export interface Seat {
  code: string
  x: number
  y: number
  sectionId: string | null
  elementId: string
  /** Etiqueta legible: «Fila A · asiento 12» / «Mesa M1 · lugar 3». */
  label: string
  /** «C» (fila) o «Mesa M1»; con `seatNo` identifica el lugar en el boleto. */
  rowName: string
  /** Número de asiento dentro de la fila o la mesa. */
  seatNo: number
  /** Identifica la fila física (elemento + fila) para agrupar asientos contiguos. */
  rowKey: string
  /** Giro de la butaca en grados (mira hacia el frente de su fila). */
  angle: number
}

export const SEAT_PITCH = 34 // separación entre asientos (unidades del plano)
export const ROW_PITCH = 38 // separación entre filas
export const TABLE_RADIUS = 36
export const LIMITS = { elements: 400, seats: 4000, rows: 60, cols: 60, tableSeats: 24, sections: 12, rowSeats: 200, groups: 60 }

const rad = (d: number) => (d * Math.PI) / 180

/** Centro de un bloque (para girarlo). */
export const blockCenter = (el: BlockElement) => ({ x: el.x + ((el.cols - 1) * SEAT_PITCH) / 2, y: el.y + ((el.rows - 1) * SEAT_PITCH) / 2 })

/** Punto de control de la curva de una fila. */
export function rowControl(el: Pick<RowElement, "x" | "y" | "x2" | "y2" | "bend">) {
  const dx = el.x2 - el.x
  const dy = el.y2 - el.y
  const len = Math.hypot(dx, dy) || 1
  return { x: (el.x + el.x2) / 2 + (-dy / len) * el.bend * 2, y: (el.y + el.y2) / 2 + (dx / len) * el.bend * 2 }
}

/** Posiciones equidistantes (por longitud de curva) de los asientos de una fila. */
export function rowPoints(el: RowElement): { x: number; y: number; angle: number }[] {
  const n = Math.max(1, el.seats)
  const c = rowControl(el)
  const at = (t: number) => {
    const u = 1 - t
    return { x: u * u * el.x + 2 * u * t * c.x + t * t * el.x2, y: u * u * el.y + 2 * u * t * c.y + t * t * el.y2 }
  }
  const tangent = (t: number) => {
    const u = 1 - t
    return Math.atan2(2 * u * (c.y - el.y) + 2 * t * (el.y2 - c.y), 2 * u * (c.x - el.x) + 2 * t * (el.x2 - c.x))
  }
  const STEPS = 64
  const cum = [0]
  let prev = at(0)
  for (let i = 1; i <= STEPS; i++) {
    const p = at(i / STEPS)
    cum.push(cum[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y))
    prev = p
  }
  const total = cum[STEPS]
  const out: { x: number; y: number; angle: number }[] = []
  for (let i = 0; i < n; i++) {
    const target = n === 1 ? total / 2 : (total * i) / (n - 1)
    let k = 1
    while (k < STEPS && cum[k] < target) k++
    const span = cum[k] - cum[k - 1] || 1
    const t = (k - 1 + (target - cum[k - 1]) / span) / STEPS
    const p = at(Math.min(1, Math.max(0, t)))
    out.push({ x: p.x, y: p.y, angle: (tangent(t) * 180) / Math.PI })
  }
  return out
}

/** Longitud aproximada de una fila (para calcular cuántos asientos caben). */
export function rowLength(el: Pick<RowElement, "x" | "y" | "x2" | "y2" | "bend">): number {
  const c = rowControl(el)
  let len = 0
  let prev = { x: el.x, y: el.y }
  for (let i = 1; i <= 32; i++) {
    const t = i / 32
    const u = 1 - t
    const p = { x: u * u * el.x + 2 * u * t * c.x + t * t * el.x2, y: u * u * el.y + 2 * u * t * c.y + t * t * el.y2 }
    len += Math.hypot(p.x - prev.x, p.y - prev.y)
    prev = p
  }
  return len
}

export const rowName = (i: number) => {
  // 0 → A … 25 → Z, 26 → AA …
  let n = i
  let out = ""
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** Todos los asientos del plano con su posición y código. */
export function computeSeats(layout: Layout): Seat[] {
  const seats: Seat[] = []
  const zoneOf = layout.zoneOf ?? {}
  const zone = (code: string, base: string | undefined) => zoneOf[code] ?? base ?? null
  for (const el of layout.elements) {
    if (el.type === "block") {
      const center = blockCenter(el)
      const rot = rad(el.rotation ?? 0)
      const cos = Math.cos(rot)
      const sin = Math.sin(rot)
      for (let r = 0; r < el.rows; r++) {
        for (let c = 0; c < el.cols; c++) {
          const row = rowName(r)
          const code = `${el.prefix}${row}-${c + 1}`
          const px = el.x + c * SEAT_PITCH - center.x
          const py = el.y + r * SEAT_PITCH - center.y
          seats.push({
            code,
            x: Math.round((center.x + px * cos - py * sin) * 10) / 10,
            y: Math.round((center.y + px * sin + py * cos) * 10) / 10,
            sectionId: zone(code, el.sectionId),
            elementId: el.id,
            label: `${el.label ? el.label + " · " : ""}Fila ${row} · asiento ${c + 1}`,
            rowName: row,
            seatNo: c + 1,
            rowKey: `${el.id}:${row}`,
            angle: el.rotation ?? 0,
          })
        }
      }
    } else if (el.type === "row") {
      const pts = rowPoints(el)
      const n = pts.length
      pts.forEach((p, i) => {
        const seatNo = el.startNo + (el.reverse ? n - 1 - i : i)
        const code = `${el.prefix}${el.rowLabel}-${seatNo}`
        seats.push({
          code,
          x: Math.round(p.x * 10) / 10,
          y: Math.round(p.y * 10) / 10,
          sectionId: zone(code, el.sectionId),
          elementId: el.id,
          label: `${el.label ? el.label + " · " : ""}Fila ${el.rowLabel} · asiento ${seatNo}`,
          rowName: el.rowLabel,
          seatNo,
          rowKey: `${el.prefix}:${el.rowLabel}`,
          angle: p.angle,
        })
      })
    } else if (el.type === "table") {
      for (let i = 0; i < el.seats; i++) {
        const angle = (2 * Math.PI * i) / el.seats - Math.PI / 2
        const code = `${el.code}-${i + 1}`
        seats.push({
          code,
          x: el.x + Math.cos(angle) * (TABLE_RADIUS + 14),
          y: el.y + Math.sin(angle) * (TABLE_RADIUS + 14),
          sectionId: zone(code, el.sectionId),
          elementId: el.id,
          label: `Mesa ${el.code} · lugar ${i + 1}`,
          rowName: `Mesa ${el.code}`,
          seatNo: i + 1,
          rowKey: `table:${el.id}`,
          angle: (angle * 180) / Math.PI + 90,
        })
      }
    }
  }
  return seats
}

/** Fila/mesa y número a partir de la etiqueta legible de un asiento (para el boleto). */
export function parseSeatLabel(label: string | null | undefined): { row: string; seatNo: string; kind: "fila" | "mesa"; area: string | null } | null {
  if (!label) return null
  const f = /^(?:(.*) · )?Fila (\w+) · asiento (\d+)$/.exec(label)
  if (f) return { row: f[2], seatNo: f[3], kind: "fila", area: f[1] ?? null }
  const m = /^Mesa (\w+) · lugar (\d+)$/.exec(label)
  if (m) return { row: m[1], seatNo: m[2], kind: "mesa", area: null }
  return null
}

export function sellableSeats(layout: Layout): Seat[] {
  const blocked = new Set(layout.blocked)
  return computeSeats(layout).filter((s) => !blocked.has(s.code))
}

const EMPTY: Layout = { sections: [], elements: [], blocked: [] }

const num = (v: unknown, min: number, max: number, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const safeId = (v: unknown) => str(v, 40).replace(/[^A-Za-z0-9_-]/g, "")
const safeCode = (v: unknown) => str(v, 12).replace(/[^A-Za-z0-9]/g, "").toUpperCase()

/**
 * Normaliza lo que llega del editor. Lanza Error con un mensaje claro si el plano
 * no es válido (códigos repetidos, demasiados asientos…).
 */
export function sanitizeLayout(raw: unknown, planWidth = 1000, planHeight = 600): Layout {
  if (!raw || typeof raw !== "object") return { ...EMPTY }
  const r = raw as Record<string, unknown>
  const sections: LayoutSection[] = (Array.isArray(r.sections) ? r.sections : [])
    .slice(0, LIMITS.sections)
    .map((s): LayoutSection => {
      const o = (s ?? {}) as Record<string, unknown>
      return { id: safeId(o.id), name: str(o.name, 40), color: /^#[0-9a-fA-F]{6}$/.test(String(o.color)) ? String(o.color) : "#64748b" }
    })
    .filter((s) => s.id && s.name)
  const sectionIds = new Set(sections.map((s) => s.id))
  const sectionOf = (v: unknown) => (typeof v === "string" && sectionIds.has(v) ? v : undefined)

  const groups: LayoutGroup[] = (Array.isArray(r.groups) ? r.groups : [])
    .slice(0, LIMITS.groups)
    .map((g): LayoutGroup => {
      const o = (g ?? {}) as Record<string, unknown>
      return { id: safeId(o.id), name: str(o.name, 40) }
    })
    .filter((g) => g.id && g.name)
  const groupIds = new Set(groups.map((g) => g.id))
  const groupOf = (v: unknown) => (typeof v === "string" && groupIds.has(v) ? v : undefined)
  const margin = 400

  const elements: LayoutElement[] = []
  for (const e of (Array.isArray(r.elements) ? r.elements : []).slice(0, LIMITS.elements)) {
    const o = (e ?? {}) as Record<string, unknown>
    const id = safeId(o.id)
    if (!id) continue
    const rotation = num(o.rotation, -360, 360, 0)
    const base = {
      id,
      x: num(o.x, -margin, planWidth + margin),
      y: num(o.y, -margin, planHeight + margin),
      label: str(o.label, 40) || undefined,
      rotation: rotation || undefined,
      groupId: groupOf(o.groupId),
    }
    if (o.type === "row") {
      elements.push({
        ...base,
        type: "row",
        x2: num(o.x2, -margin, planWidth + margin),
        y2: num(o.y2, -margin, planHeight + margin),
        bend: num(o.bend, -2000, 2000, 0),
        seats: num(o.seats, 1, LIMITS.rowSeats, 1),
        prefix: safeCode(o.prefix).slice(0, 6),
        rowLabel: safeCode(o.rowLabel).slice(0, 4) || "A",
        startNo: num(o.startNo, 0, 999, 1),
        reverse: o.reverse === true,
        sectionId: sectionOf(o.sectionId),
      })
    } else if (o.type === "block") {
      elements.push({
        ...base,
        type: "block",
        rows: num(o.rows, 1, LIMITS.rows, 1),
        cols: num(o.cols, 1, LIMITS.cols, 1),
        prefix: safeCode(o.prefix),
        sectionId: sectionOf(o.sectionId),
      })
    } else if (o.type === "table") {
      elements.push({
        ...base,
        type: "table",
        code: safeCode(o.code) || "M",
        seats: num(o.seats, 1, LIMITS.tableSeats, 4),
        shape: o.shape === "rect" ? "rect" : "round",
        sectionId: sectionOf(o.sectionId),
      })
    } else if (o.type === "stage" || o.type === "door" || o.type === "wall" || o.type === "label" || o.type === "area") {
      elements.push({ ...base, type: o.type, w: num(o.w, 10, planWidth, 120), h: num(o.h, 10, planHeight, 40) })
    }
  }
  if (new Set(elements.map((e) => e.id)).size !== elements.length) throw new Error("El plano tiene elementos repetidos")

  const layout: Layout = {
    sections,
    elements,
    blocked: [...new Set((Array.isArray(r.blocked) ? r.blocked : []).map((c) => safeCode(String(c).replace("-", "")) && String(c)))].filter(Boolean).slice(0, LIMITS.seats) as string[],
  }
  if (groups.length > 0) layout.groups = groups.filter((g) => elements.some((e) => e.groupId === g.id))
  const bg = r.background && typeof r.background === "object" ? (r.background as Record<string, unknown>) : null
  const bgUrl = bg ? str(bg.url, 500) : ""
  if (bg && bgUrl && (bgUrl.startsWith("/") || bgUrl.startsWith("https://"))) {
    layout.background = {
      url: bgUrl,
      x: num(bg.x, -4000, 4000, 0),
      y: num(bg.y, -4000, 4000, 0),
      w: num(bg.w, 20, 8000, planWidth),
      h: num(bg.h, 20, 8000, planHeight),
      opacity: num(bg.opacity, 5, 100, 50),
    }
  }
  const seats = computeSeats(layout)
  if (seats.length > LIMITS.seats) throw new Error(`El plano tiene demasiados asientos (máximo ${LIMITS.seats})`)
  const codes = new Set<string>()
  for (const s of seats) {
    if (codes.has(s.code)) throw new Error(`El código de asiento «${s.code}» se repite; cambia el prefijo o el código de mesa`)
    codes.add(s.code)
  }
  layout.blocked = layout.blocked.filter((c) => codes.has(c))
  // Zonas asignadas asiento por asiento: solo para asientos y zonas que existen.
  const zoneOf: Record<string, string> = {}
  if (r.zoneOf && typeof r.zoneOf === "object") {
    for (const [code, zone] of Object.entries(r.zoneOf as Record<string, unknown>)) {
      if (codes.has(code) && typeof zone === "string" && sectionIds.has(zone)) zoneOf[code] = zone
    }
  }
  if (Object.keys(zoneOf).length > 0) layout.zoneOf = zoneOf
  return layout
}

/** Lo que se guarda en la base: tolera plano vacío o con otra forma. */
export function parseStoredLayout(raw: unknown): Layout {
  try {
    return sanitizeLayout(raw, 4000, 4000)
  } catch {
    return { ...EMPTY }
  }
}

/** Capacidad vendible del plano. */
export const capacityOfLayout = (layout: Layout) => sellableSeats(layout).length

export interface ZoneStat {
  /** Id de la zona; «» = asientos sin zona. */
  id: string
  name: string
  color: string
  total: number
  free: number
  /** Cuadro que encierra sus asientos. */
  box: { x: number; y: number; w: number; h: number }
  /** Asiento más cercano al centro de la zona: donde se pone su etiqueta. */
  anchor: { x: number; y: number }
}

/** Resumen por zona (total y libres) con el cuadro que la contiene: base del mapa por secciones. */
export function zoneStats(layout: Layout, taken: Set<string> = new Set()): ZoneStat[] {
  const byZone = new Map<string, Seat[]>()
  for (const s of sellableSeats(layout)) {
    const k = s.sectionId ?? ""
    byZone.set(k, [...(byZone.get(k) ?? []), s])
  }
  const out: ZoneStat[] = []
  const order = [...layout.sections.map((s) => s.id), ""]
  for (const id of order) {
    const seats = byZone.get(id)
    if (!seats?.length) continue
    const xs = seats.map((s) => s.x)
    const ys = seats.map((s) => s.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const cx = xs.reduce((a, v) => a + v, 0) / xs.length
    const cy = ys.reduce((a, v) => a + v, 0) / ys.length
    const near = seats.reduce((a, b) => (Math.hypot(b.x - cx, b.y - cy) < Math.hypot(a.x - cx, a.y - cy) ? b : a))
    const sec = layout.sections.find((s) => s.id === id)
    out.push({
      id,
      name: sec?.name ?? "Sin zona",
      color: sec?.color ?? "#64748b",
      total: seats.length,
      free: seats.filter((s) => !taken.has(s.code)).length,
      box: { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY },
      anchor: { x: near.x, y: near.y },
    })
  }
  return out
}

/** Punto de referencia para «los mejores lugares»: el centro del escenario, o el frente del plano. */
export function stageAnchor(layout: Layout, planWidth: number): { x: number; y: number } {
  const stage = layout.elements.find((e): e is DecorElement => e.type === "stage")
  if (stage) return { x: stage.x + stage.w / 2, y: stage.y + stage.h / 2 }
  return { x: planWidth / 2, y: 0 }
}

/**
 * Mejores lugares libres: `count` asientos contiguos de una misma fila lo más cerca
 * del escenario (y del centro). Si no hay una tira completa, los más cercanos sueltos.
 */
export function bestSeats(
  seats: Seat[],
  taken: Set<string>,
  opts: { count?: number; sectionId?: string | null; anchor: { x: number; y: number } }
): Seat[] {
  const count = Math.max(1, Math.floor(opts.count ?? 1))
  const free = seats.filter((s) => !taken.has(s.code) && (opts.sectionId === undefined || opts.sectionId === null || (s.sectionId ?? "") === opts.sectionId))
  if (free.length === 0) return []
  const dist = (s: { x: number; y: number }) => Math.hypot(s.x - opts.anchor.x, (s.y - opts.anchor.y) * 1.15)
  const rows = new Map<string, Seat[]>()
  for (const s of free) rows.set(s.rowKey, [...(rows.get(s.rowKey) ?? []), s])
  let best: { run: Seat[]; score: number } | null = null
  for (const row of rows.values()) {
    const sorted = [...row].sort((a, b) => a.seatNo - b.seatNo)
    for (let i = 0; i + count <= sorted.length; i++) {
      const run = sorted.slice(i, i + count)
      // contiguos: números consecutivos
      if (run[run.length - 1].seatNo - run[0].seatNo !== count - 1) continue
      const cx = run.reduce((a, s) => a + s.x, 0) / count
      const cy = run.reduce((a, s) => a + s.y, 0) / count
      const score = dist({ x: cx, y: cy })
      if (!best || score < best.score) best = { run, score }
    }
  }
  if (best) return best.run
  return [...free].sort((a, b) => dist(a) - dist(b)).slice(0, count)
}

// ── Boletos y pagos ──────────────────────────────────────────────────────────

/** Código corto de puerta: 6 caracteres sin los que se confunden (0/O, 1/I). */
export const SHORT_CODE_LENGTH = 6
export const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function newShortCode(random: (n: number) => number = (n) => Math.floor((globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * n)): string {
  let out = ""
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) out += SHORT_CODE_ALPHABET[random(SHORT_CODE_ALPHABET.length)]
  return out
}

/** Lo que escribe el personal: mayúsculas, sin espacios ni guiones; null si no tiene la forma de un código corto. */
export function normalizeShortCode(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.toUpperCase().replace(/[\s-]/g, "") : ""
  return /^[A-Z0-9]{6}$/.test(v) ? v : null
}

/** Saldo pendiente (nunca negativo). Montos en pesos con centavos. */
export function ticketBalance(price: number, payments: number[]): number {
  const paid = payments.reduce((a, b) => a + b, 0)
  return Math.max(0, Math.round((price - paid) * 100) / 100)
}

/** Un boleto sin costo o con saldo en cero está liquidado. */
export function ticketStatusFor(price: number, payments: number[]): "reserved" | "paid" {
  return ticketBalance(price, payments) <= 0 ? "paid" : "reserved"
}

export type SeatingMode = "free" | "sections" | "seats"
export type SeatSelectionMode = "self" | "assigned" | "both"

/** ¿Puede quien aparta elegir su propio lugar? */
export function attendeeMayChoose(seating: SeatingMode, selection: SeatSelectionMode): boolean {
  return seating === "seats" && (selection === "self" || selection === "both")
}
/** ¿Puede el personal asignar el lugar? */
export function staffMayAssign(seating: SeatingMode, selection: SeatSelectionMode): boolean {
  return seating === "seats" && (selection === "assigned" || selection === "both")
}

/** Siguiente asiento libre, prefiriendo una sección. Devuelve null si no hay. */
export function autoAssignSeat(seats: Seat[], taken: Set<string>, preferSectionId?: string | null): Seat | null {
  const free = seats.filter((s) => !taken.has(s.code))
  if (preferSectionId) {
    const inSection = free.find((s) => s.sectionId === preferSectionId)
    if (inSection) return inSection
  }
  return free[0] ?? null
}

export type AudienceMode = "open" | "leaders" | "ministries"

/** ¿Una persona puede apartar según el público del evento? */
export function audienceAllows(
  mode: AudienceMode,
  person: { isLeader: boolean; ministryIds: string[] },
  allowedMinistryIds: string[]
): boolean {
  if (mode === "open") return true
  if (mode === "leaders") return person.isLeader
  return person.ministryIds.some((id) => allowedMinistryIds.includes(id))
}

export const EVENT_KINDS = [
  "Bautismo en aguas",
  "Encuentro con Jesús",
  "Lanzamiento",
  "Taller",
  "Curso",
  "Reunión de líderes",
  "Reunión de ministerio",
  "Tabernáculos",
  "Otro",
] as const
