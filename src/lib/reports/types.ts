// Estructura común de los reportes: sirve para la pantalla, el PDF y el CSV.

export type CellValue = string | number | null

export interface ReportColumn {
  key: string
  label: string
  /** Números y montos a la derecha. */
  align?: "left" | "right"
}

export interface ReportSection {
  title: string
  note?: string
  columns: ReportColumn[]
  rows: Record<string, CellValue>[]
  /** Renglón de totales (se resalta). */
  totals?: Record<string, CellValue>
}

export type ChartUnit = "number" | "money" | "percent"

export interface ReportChart {
  id: string
  title: string
  /** bar = barras agrupadas; line = tendencia. */
  kind: "bar" | "line"
  unit: ChartUnit
  categories: string[]
  series: { name: string; values: number[] }[]
}

/** Cifra numérica del reporte: base para compararlo con otro periodo. */
export interface ReportMetric {
  key: string
  label: string
  value: number
  unit: ChartUnit
  /** Si subir es «malo» (p. ej. gastos): solo cambia el color de la variación. */
  lowerIsBetter?: boolean
}

export interface ReportDoc {
  id: string
  title: string
  /** «Del 1 de oct al 31 de oct de 2026». */
  periodLabel: string
  kpis: { label: string; value: string }[]
  /** Cifras numéricas (para comparar). */
  metrics?: ReportMetric[]
  charts?: ReportChart[]
  /** Con qué periodo se comparó, si se pidió. */
  comparedWith?: { label: string; period: ReportPeriod } | null
  sections: ReportSection[]
}

export type CompareMode = "none" | "previous" | "year"

export interface ReportPeriod {
  /** YYYY-MM-DD */
  from: string
  to: string
}

export interface ReportCatalogItem {
  id: string
  title: string
  description: string
}
