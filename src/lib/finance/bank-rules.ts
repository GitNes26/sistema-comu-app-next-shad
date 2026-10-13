import { createHash } from "node:crypto"

// Conciliación bancaria — reglas puras: lectura del CSV del banco y cotejo con los
// ingresos y gastos registrados. Sin base de datos, para poder probarlas a fondo.

export interface ParsedLine {
  /** YYYY-MM-DD */
  date: string
  description: string
  reference: string | null
  /** Positivo = depósito (abono), negativo = retiro (cargo). */
  amount: number
  balance: number | null
}

export interface ParseResult {
  lines: ParsedLine[]
  /** Renglones que no se pudieron leer, con su número y el motivo. */
  errors: { row: number; reason: string }[]
  /** Columnas reconocidas (para mostrar en la vista previa). */
  columns: { date: string; description: string; amount: string | null; credit: string | null; debit: string | null; reference: string | null; balance: string | null }
  delimiter: string
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const HEADERS = {
  date: ["fecha", "fecha operacion", "fecha de operacion", "fecha movimiento", "fecha valor", "date", "dia"],
  description: ["descripcion", "concepto", "detalle", "movimiento", "descripcion del movimiento", "description", "leyenda", "referencia ampliada"],
  amount: ["importe", "monto", "cantidad", "amount", "total"],
  credit: ["abono", "abonos", "deposito", "depositos", "credito", "creditos", "ingreso", "ingresos", "credit"],
  debit: ["cargo", "cargos", "retiro", "retiros", "debito", "debitos", "egreso", "egresos", "debit"],
  reference: ["referencia", "folio", "numero de referencia", "no referencia", "reference", "clave de rastreo", "autorizacion"],
  balance: ["saldo", "balance", "saldo final", "saldo disponible"],
} as const

/** Separa una línea respetando comillas. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      out.push(cur)
      cur = ""
    } else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function detectDelimiter(sample: string): string {
  const first = sample.split(/\r?\n/).slice(0, 5).join("\n")
  const counts = [",", ";", "\t", "|"].map((d) => [d, (first.match(new RegExp(`\\${d}`, "g")) ?? []).length] as const)
  return counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ","
}

const MONTHS: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12 }

/** Fechas del banco: 2026-10-05, 05/10/2026, 05-10-26, 5 oct 2026. Día primero (México). */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  let y: number, m: number, d: number
  let r: RegExpMatchArray | null
  if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    y = +r[1]
    m = +r[2]
    d = +r[3]
  } else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})/))) {
    d = +r[1]
    m = +r[2]
    y = +r[3] < 100 ? 2000 + +r[3] : +r[3]
  } else if ((r = s.match(/^(\d{1,2})[ -]+([a-z]{3,4})\.?[ -]+(\d{4}|\d{2})/))) {
    d = +r[1]
    m = MONTHS[r[2]] ?? 0
    y = +r[3] < 100 ? 2000 + +r[3] : +r[3]
  } else return null
  if (!m || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  const t = new Date(`${iso}T00:00:00.000Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso ? iso : null
}

/** Importes: «$1,234.56», «(500.00)» = negativo, «1.234,56» (europeo), «-», vacío. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s || s === "-" || s === "—") return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (/-$/.test(s)) {
    negative = true
    s = s.slice(0, -1)
  }
  s = s.replace(/[$\s]|mxn|usd/gi, "")
  if (s.startsWith("-")) {
    negative = !negative
    s = s.slice(1)
  } else if (s.startsWith("+")) s = s.slice(1)
  if (!/^[\d.,]+$/.test(s)) return null
  const lastDot = s.lastIndexOf(".")
  const lastComma = s.lastIndexOf(",")
  if (lastComma > lastDot) {
    // Formato europeo: 1.234,56
    s = s.replace(/\./g, "").replace(",", ".")
  } else {
    s = s.replace(/,/g, "")
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round((negative ? -n : n) * 100) / 100
}

/** Lee el CSV de un estado de cuenta. */
export function parseBankCsv(text: string): ParseResult {
  const clean = text.replace(/^﻿/, "").trim()
  const delimiter = detectDelimiter(clean)
  const rows = clean.split(/\r?\n/).filter((l) => l.trim() !== "")
  const result: ParseResult = {
    lines: [],
    errors: [],
    delimiter,
    columns: { date: "", description: "", amount: null, credit: null, debit: null, reference: null, balance: null },
  }
  // El encabezado puede no ser la primera fila (algunos bancos ponen datos de la cuenta antes).
  let headerIdx = -1
  let map: Record<string, number> = {}
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = splitLine(rows[i], delimiter).map(norm)
    const found: Record<string, number> = {}
    for (const [key, names] of Object.entries(HEADERS)) {
      const idx = cells.findIndex((c) => (names as readonly string[]).includes(c))
      if (idx >= 0) found[key] = idx
    }
    if (found.date !== undefined && (found.amount !== undefined || found.credit !== undefined || found.debit !== undefined)) {
      headerIdx = i
      map = found
      break
    }
  }
  if (headerIdx < 0) {
    result.errors.push({ row: 1, reason: "No se encontraron las columnas de fecha e importe (o cargo/abono) en el archivo" })
    return result
  }
  const head = splitLine(rows[headerIdx], delimiter)
  const label = (k: string) => (map[k] === undefined ? null : head[map[k]])
  result.columns = {
    date: label("date") ?? "",
    description: label("description") ?? "",
    amount: label("amount"),
    credit: label("credit"),
    debit: label("debit"),
    reference: label("reference"),
    balance: label("balance"),
  }
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = splitLine(rows[i], delimiter)
    const rowNo = i + 1
    const date = parseBankDate(cells[map.date] ?? "")
    if (!date) {
      // Filas de totales o pie del banco: se omiten en silencio si están casi vacías.
      if (cells.filter(Boolean).length > 1) result.errors.push({ row: rowNo, reason: `Fecha no reconocida: «${cells[map.date] ?? ""}»` })
      continue
    }
    let amount: number | null = null
    if (map.amount !== undefined) amount = parseAmount(cells[map.amount] ?? "")
    if (amount === null) {
      const credit = map.credit !== undefined ? parseAmount(cells[map.credit] ?? "") : null
      const debit = map.debit !== undefined ? parseAmount(cells[map.debit] ?? "") : null
      if (credit !== null && credit !== 0) amount = Math.abs(credit)
      else if (debit !== null && debit !== 0) amount = -Math.abs(debit)
    }
    if (amount === null || amount === 0) {
      result.errors.push({ row: rowNo, reason: "Importe vacío o inválido" })
      continue
    }
    result.lines.push({
      date,
      description: (cells[map.description] ?? "").slice(0, 300) || "Sin descripción",
      reference: map.reference !== undefined ? (cells[map.reference] || null)?.slice(0, 100) ?? null : null,
      amount,
      balance: map.balance !== undefined ? parseAmount(cells[map.balance] ?? "") : null,
    })
  }
  return result
}

/**
 * Clave para no duplicar renglones al reimportar. Dos movimientos idénticos el mismo día
 * (p. ej. dos depósitos de $500) se distinguen por su orden de aparición.
 */
export function dedupeKeys(lines: ParsedLine[]): string[] {
  const seen = new Map<string, number>()
  return lines.map((l) => {
    const base = `${l.date}|${l.amount.toFixed(2)}|${l.description.toLowerCase()}|${l.reference ?? ""}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return createHash("sha256").update(`${base}|${n}`).digest("hex")
  })
}

// ── Cotejo ───────────────────────────────────────────────────────────────────

export interface Movement {
  id: string
  kind: "income" | "expense"
  /** Siempre positivo. */
  amount: number
  /** YYYY-MM-DD */
  date: string
  text: string
  reference: string | null
}

export interface Candidate extends Movement {
  /** 0–100: qué tan probable es que sea el mismo movimiento. */
  score: number
  daysApart: number
}

const cents = (n: number) => Math.round(Math.abs(n) * 100)
const dayDiff = (a: string, b: string) => Math.round((new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000)

/**
 * Movimientos del sistema que podrían ser este renglón: mismo sentido (depósito ↔ ingreso,
 * retiro ↔ gasto), mismo importe al centavo y fecha cercana (± `windowDays`).
 */
export function candidatesFor(line: { date: string; amount: number; description: string; reference: string | null }, movements: Movement[], windowDays = 7): Candidate[] {
  const kind = line.amount > 0 ? "income" : "expense"
  const desc = norm(line.description)
  const ref = line.reference ? norm(line.reference) : ""
  return movements
    .filter((m) => m.kind === kind && cents(m.amount) === cents(line.amount))
    .map((m) => {
      const daysApart = Math.abs(dayDiff(m.date, line.date))
      let score = 70 - daysApart * 5
      if (m.reference && (ref.includes(norm(m.reference)) || norm(m.reference).includes(ref)) && ref) score += 25
      const words = norm(m.text).split(" ").filter((w) => w.length >= 4)
      if (words.some((w) => desc.includes(w))) score += 10
      return { ...m, daysApart, score: Math.max(0, Math.min(100, score)) }
    })
    .filter((c) => c.daysApart <= windowDays)
    .sort((a, b) => b.score - a.score || a.daysApart - b.daysApart)
}

/**
 * Conciliación automática: solo renglones con UN candidato claro (≤ 3 días) y que ese
 * candidato no sea también el único de otro renglón. Lo dudoso queda para decidir a mano.
 */
export function autoMatches(
  lines: { id: string; date: string; amount: number; description: string; reference: string | null }[],
  movements: Movement[]
): { lineId: string; movement: Movement }[] {
  const proposals = lines.map((l) => ({ lineId: l.id, cands: candidatesFor(l, movements, 3) }))
  const claimed = new Map<string, number>()
  for (const p of proposals) if (p.cands.length === 1) claimed.set(p.cands[0].id, (claimed.get(p.cands[0].id) ?? 0) + 1)
  return proposals
    .filter((p) => p.cands.length === 1 && claimed.get(p.cands[0].id) === 1)
    .map((p) => ({ lineId: p.lineId, movement: p.cands[0] }))
}
