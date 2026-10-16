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
/** Mesa con N asientos. Código: «<código>-<n>». */
export interface TableElement extends ElementBase {
  type: "table"
  code: string
  seats: number
  shape: "round" | "rect"
  sectionId?: string
}
export interface DecorElement extends ElementBase {
  type: "stage" | "door" | "wall" | "label"
  w: number
  h: number
}
export type LayoutElement = BlockElement | TableElement | DecorElement

export interface Layout {
  sections: LayoutSection[]
  elements: LayoutElement[]
  /** Asientos que no se venden (pasillos, reservados). */
  blocked: string[]
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
}

export const SEAT_PITCH = 34 // separación entre asientos (unidades del plano)
export const TABLE_RADIUS = 36
export const LIMITS = { elements: 80, seats: 3000, rows: 60, cols: 60, tableSeats: 24, sections: 12 }

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
  for (const el of layout.elements) {
    if (el.type === "block") {
      for (let r = 0; r < el.rows; r++) {
        for (let c = 0; c < el.cols; c++) {
          const row = rowName(r)
          seats.push({
            code: `${el.prefix}${row}-${c + 1}`,
            x: el.x + c * SEAT_PITCH,
            y: el.y + r * SEAT_PITCH,
            sectionId: el.sectionId ?? null,
            elementId: el.id,
            label: `${el.label ? el.label + " · " : ""}Fila ${row} · asiento ${c + 1}`,
            rowName: row,
            seatNo: c + 1,
          })
        }
      }
    } else if (el.type === "table") {
      for (let i = 0; i < el.seats; i++) {
        const angle = (2 * Math.PI * i) / el.seats - Math.PI / 2
        seats.push({
          code: `${el.code}-${i + 1}`,
          x: el.x + Math.cos(angle) * (TABLE_RADIUS + 14),
          y: el.y + Math.sin(angle) * (TABLE_RADIUS + 14),
          sectionId: el.sectionId ?? null,
          elementId: el.id,
          label: `Mesa ${el.code} · lugar ${i + 1}`,
          rowName: `Mesa ${el.code}`,
          seatNo: i + 1,
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

  const elements: LayoutElement[] = []
  for (const e of (Array.isArray(r.elements) ? r.elements : []).slice(0, LIMITS.elements)) {
    const o = (e ?? {}) as Record<string, unknown>
    const id = safeId(o.id)
    if (!id) continue
    const base = { id, x: num(o.x, -50, planWidth + 50), y: num(o.y, -50, planHeight + 50), label: str(o.label, 40) || undefined }
    if (o.type === "block") {
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
    } else if (o.type === "stage" || o.type === "door" || o.type === "wall" || o.type === "label") {
      elements.push({ ...base, type: o.type, w: num(o.w, 10, planWidth, 120), h: num(o.h, 10, planHeight, 40) })
    }
  }
  if (new Set(elements.map((e) => e.id)).size !== elements.length) throw new Error("El plano tiene elementos repetidos")

  const layout: Layout = {
    sections,
    elements,
    blocked: [...new Set((Array.isArray(r.blocked) ? r.blocked : []).map((c) => safeCode(String(c).replace("-", "")) && String(c)))].filter(Boolean).slice(0, LIMITS.seats) as string[],
  }
  const seats = computeSeats(layout)
  if (seats.length > LIMITS.seats) throw new Error(`El plano tiene demasiados asientos (máximo ${LIMITS.seats})`)
  const codes = new Set<string>()
  for (const s of seats) {
    if (codes.has(s.code)) throw new Error(`El código de asiento «${s.code}» se repite; cambia el prefijo o el código de mesa`)
    codes.add(s.code)
  }
  layout.blocked = layout.blocked.filter((c) => codes.has(c))
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

// ── Boletos y pagos ──────────────────────────────────────────────────────────

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
