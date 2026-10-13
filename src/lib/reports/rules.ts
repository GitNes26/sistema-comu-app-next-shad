// Reglas puras de los reportes (sin base de datos): periodos, formatos y CSV.

import type { CellValue, ChartUnit, CompareMode, ReportDoc, ReportMetric, ReportPeriod } from "./types"

const MAX_DAYS = 366

const isYmd = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00.000Z`)
  // Ida y vuelta: rechaza fechas que JavaScript «corrige» (30 de febrero).
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Periodo válido (por defecto, el mes en curso); invierte fechas al revés y limita a un año. */
export function resolvePeriod(fromRaw: unknown, toRaw: unknown, now = new Date()): ReportPeriod {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  let from = isYmd(fromRaw) ? fromRaw : new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  let to = isYmd(toRaw) ? toRaw : new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10)
  if (from > to) [from, to] = [to, from]
  const days = (new Date(`${to}T00:00:00.000Z`).getTime() - new Date(`${from}T00:00:00.000Z`).getTime()) / 86_400_000
  if (days > MAX_DAYS) {
    to = new Date(new Date(`${from}T00:00:00.000Z`).getTime() + MAX_DAYS * 86_400_000).toISOString().slice(0, 10)
  }
  return { from, to }
}

/** Límites [inicio, fin) en UTC para consultas de columnas `@db.Date` o DateTime. */
export function periodBounds(p: ReportPeriod): { start: Date; end: Date } {
  return {
    start: new Date(`${p.from}T00:00:00.000Z`),
    end: new Date(new Date(`${p.to}T00:00:00.000Z`).getTime() + 86_400_000),
  }
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const dmy = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number)
  return { y, m: m - 1, d }
}

export function formatDay(ymd: string): string {
  const { y, m, d } = dmy(ymd)
  return `${d} ${MONTHS[m]} ${y}`
}

export function periodLabel(p: ReportPeriod): string {
  const a = dmy(p.from)
  const b = dmy(p.to)
  if (p.from === p.to) return formatDay(p.from)
  if (a.y === b.y && a.m === b.m) return `Del ${a.d} al ${b.d} de ${MONTHS[a.m]} de ${a.y}`
  return `Del ${formatDay(p.from)} al ${formatDay(p.to)}`
}

export const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10)
export const round1 = (n: number) => Math.round(n * 10) / 10
export const round2 = (n: number) => Math.round(n * 100) / 100
export const avg = (values: number[]) => (values.length === 0 ? 0 : round1(values.reduce((a, b) => a + b, 0) / values.length))

export function money(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
}

/** Etiquetas legibles de las llaves de finanzas. */
export const INCOME_KIND_LABEL: Record<string, string> = {
  tithe: "Diezmos",
  offering: "Ofrendas",
  donation: "Donativos",
  event: "Eventos",
  school: "Escuela",
  other: "Otros",
}
export const INCOME_SOURCE_LABEL: Record<string, string> = {
  cash_cut: "Corte de efectivo",
  transfer: "Transferencia",
  online: "En línea",
  other: "Otro",
}

function csvCell(v: CellValue): string {
  if (v === null || v === undefined) return ""
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV de todas las secciones (una después de otra), con BOM para Excel. */
export function reportToCsv(doc: ReportDoc): string {
  const lines: string[] = [csvCell(doc.title), csvCell(doc.periodLabel), ""]
  for (const s of doc.sections) {
    lines.push(csvCell(s.title))
    lines.push(s.columns.map((c) => csvCell(c.label)).join(","))
    for (const r of s.rows) lines.push(s.columns.map((c) => csvCell(r[c.key] ?? null)).join(","))
    if (s.totals) lines.push(s.columns.map((c) => csvCell(s.totals![c.key] ?? null)).join(","))
    lines.push("")
  }
  return "﻿" + lines.join("\r\n")
}

// ── Comparación entre periodos ───────────────────────────────────────────────

const ymdOf = (d: Date) => d.toISOString().slice(0, 10)
const utc = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)

/**
 * Periodo equivalente inmediatamente anterior: un mes completo → el mes anterior,
 * un año completo → el año anterior, y cualquier otro rango → el mismo número de días justo antes.
 */
export function previousPeriod(p: ReportPeriod): ReportPeriod {
  const from = utc(p.from)
  const to = utc(p.to)
  const isMonth = from.getUTCDate() === 1 && from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear() && ymdOf(new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0))) === p.to
  if (isMonth) {
    const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1))
    return { from: ymdOf(start), to: ymdOf(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))) }
  }
  const isYear = p.from.endsWith("-01-01") && p.to.endsWith("-12-31") && from.getUTCFullYear() === to.getUTCFullYear()
  if (isYear) {
    const y = from.getUTCFullYear() - 1
    return { from: `${y}-01-01`, to: `${y}-12-31` }
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1
  return { from: ymdOf(new Date(from.getTime() - days * 86_400_000)), to: ymdOf(new Date(from.getTime() - 86_400_000)) }
}

/** El mismo periodo del año anterior (29 de febrero → 28). */
export function sameLastYear(p: ReportPeriod): ReportPeriod {
  const shift = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number)
    const last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate()
    return `${y - 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`
  }
  return { from: shift(p.from), to: shift(p.to) }
}

export function comparisonPeriod(p: ReportPeriod, mode: CompareMode): ReportPeriod | null {
  if (mode === "previous") return previousPeriod(p)
  if (mode === "year") return sameLastYear(p)
  return null
}

export function isCompareMode(v: unknown): v is CompareMode {
  return v === "none" || v === "previous" || v === "year"
}

/** Variación porcentual; null cuando no hay base para comparar. */
export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

export function formatChange(current: number, previous: number): string {
  const c = changePct(current, previous)
  if (c === null) return "nuevo"
  if (c === 0) return "sin cambio"
  return `${c > 0 ? "+" : ""}${c.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`
}

export function formatMetric(v: number, unit: ChartUnit): string {
  if (unit === "money") return money(v)
  if (unit === "percent") return `${v.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`
  return v.toLocaleString("es-MX", { maximumFractionDigits: 1 })
}

/** Metadatos de cada cifra comparada (actual y anterior). */
export function compareMetrics(current: ReportMetric[], previous: ReportMetric[]) {
  const prev = new Map(previous.map((m) => [m.key, m.value]))
  return current.map((m) => {
    const before = prev.get(m.key) ?? 0
    return { ...m, previous: before, change: changePct(m.value, before), changeLabel: formatChange(m.value, before) }
  })
}

/** Máximo del eje con una escala redonda (1, 2, 5 × 10ⁿ) y sus marcas. */
export function niceScale(maxValue: number, ticks = 4): { max: number; step: number } {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return { max: 1, step: 1 / ticks }
  const rough = maxValue / ticks
  const pow = 10 ** Math.floor(Math.log10(rough))
  const f = rough / pow
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  const step = nice * pow
  return { max: step * Math.ceil(maxValue / step), step }
}

/** Número compacto para etiquetas de gráfica: 1.2 mil, 3.4 M. */
export function compactNumber(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} M`
  if (a >= 10_000) return `${(v / 1000).toLocaleString("es-MX", { maximumFractionDigits: 0 })} mil`
  return v.toLocaleString("es-MX", { maximumFractionDigits: 1 })
}
