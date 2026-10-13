"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, Download, FileSpreadsheet, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { EmptyState } from "@/components/shared/empty-state"
import { swalError } from "@/lib/swal"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import type { CompareMode, ReportCatalogItem, ReportDoc } from "@/lib/reports/types"
import { ReportChartView } from "./report-charts"
import { ReportSchedules } from "./report-schedules"
import { cn } from "@/lib/utils"

// Centro de reportes: eliges el reporte y el periodo, lo ves en pantalla y lo
// exportas a PDF (o CSV para hojas de cálculo).

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const startOfMonth = (offset = 0) => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth() + offset, 1)
}
const endOfMonth = (offset = 0) => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth() + offset + 1, 0)
}

const PRESETS = [
  { label: "Este mes", from: () => startOfMonth(), to: () => endOfMonth() },
  { label: "Mes anterior", from: () => startOfMonth(-1), to: () => endOfMonth(-1) },
  { label: "Últimos 3 meses", from: () => startOfMonth(-2), to: () => endOfMonth() },
  { label: "Este año", from: () => new Date(new Date().getFullYear(), 0, 1), to: () => new Date(new Date().getFullYear(), 11, 31) },
]

export function ReportsCenter({ reports }: { reports: ReportCatalogItem[] }) {
  const [selected, setSelected] = useState(reports[0]?.id ?? "")
  const [from, setFrom] = useState<Date | null>(() => startOfMonth())
  const [to, setTo] = useState<Date | null>(() => endOfMonth())
  const [doc, setDoc] = useState<ReportDoc | null>(null)
  const [loading, setLoading] = useState(false)
  const [compare, setCompare] = useState<CompareMode>("previous")

  const query = useMemo(() => (from && to ? `from=${ymd(from)}&to=${ymd(to)}&compare=${compare}` : ""), [from, to, compare])

  useEffect(() => {
    if (!selected || !query) return
    let alive = true
    setLoading(true)
    apiJson<{ report: ReportDoc }>(`/api/reports/${selected}?${query}`)
      .then((r) => alive && setDoc(r.report))
      .catch((e) => {
        if (alive) {
          setDoc(null)
          swalError("No se pudo generar el reporte", errorMessage(e))
        }
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [selected, query])

  if (reports.length === 0) {
    return <EmptyState icon={BarChart3} title="Sin reportes disponibles" description="Tu rol no incluye permisos para consultar reportes." />
  }

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Reporte" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {reports.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={selected === r.id}
            onClick={() => setSelected(r.id)}
            className={cn(
              "press rounded-2xl border bg-card p-3 text-left transition-colors hover:border-primary/40",
              selected === r.id && "border-primary ring-2 ring-primary/25"
            )}
          >
            <span className="block text-sm font-semibold">{r.title}</span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{r.description}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3">
        <div className="w-40">
          <DatePicker label="Desde" value={from} onChange={setFrom} />
        </div>
        <div className="w-40">
          <DatePicker label="Hasta" value={to} onChange={setTo} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setFrom(p.from())
                setTo(p.to())
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="w-56">
          <FormCombobox
            label="Comparar con"
            options={[
              { value: "previous", label: "Periodo anterior" },
              { value: "year", label: "Mismo periodo del año pasado" },
              { value: "none", label: "No comparar" },
            ]}
            value={compare}
            onChange={(v) => setCompare(v as CompareMode)}
            clearable={false}
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button asChild variant="outline" size="sm" disabled={!query}>
            <a href={`/api/reports/${selected}?${query}&format=csv`}>
              <FileSpreadsheet className="size-4" />
              CSV
            </a>
          </Button>
          <Button asChild size="sm" disabled={!query}>
            <a href={`/api/reports/${selected}?${query}&format=pdf`}>
              <Download className="size-4" />
              Exportar PDF
            </a>
          </Button>
        </div>
      </div>

      {loading && !doc ? (
        <Skeleton className="h-64 w-full" />
      ) : !doc ? null : (
        <article className={cn("space-y-5 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <header>
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
              <FileText className="size-5 text-primary" />
              {doc.title}
            </h2>
            <p className="text-sm text-muted-foreground">{doc.periodLabel}</p>
          </header>

          {doc.kpis.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {doc.kpis.map((k) => (
                <div key={k.label} className="rounded-2xl border bg-card p-3">
                  <dd className="font-heading text-xl font-semibold tabular-nums">{k.value}</dd>
                  <dt className="text-xs text-muted-foreground">{k.label}</dt>
                </div>
              ))}
            </dl>
          )}

          {doc.charts && doc.charts.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-2">
              {doc.charts.map((ch) => (
                <ReportChartView key={ch.id} chart={ch} />
              ))}
            </div>
          )}

          {doc.sections.map((s) => (
            <section key={s.title} className="space-y-2">
              <h3 className="font-heading text-base font-semibold">{s.title}</h3>
              {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              {s.rows.length === 0 ? (
                <p className="rounded-2xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">Sin información en este periodo.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border bg-card">
                  <table className="w-full min-w-max text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                        {s.columns.map((c) => (
                          <th key={c.key} scope="col" className={cn("px-3 py-2 font-medium", c.align === "right" && "text-right")}>
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {s.rows.map((r, i) => (
                        <tr key={i}>
                          {s.columns.map((c) => (
                            <td
                              key={c.key}
                              className={cn(
                                "px-3 py-2",
                                c.align === "right" && "text-right tabular-nums",
                                c.key === "change" && r.tone === "good" && "font-medium text-emerald-700 dark:text-emerald-400",
                                c.key === "change" && r.tone === "bad" && "font-medium text-rose-700 dark:text-rose-400"
                              )}
                            >
                              {r[c.key] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {s.totals && (
                        <tr className="bg-muted/40 font-semibold">
                          {s.columns.map((c) => (
                            <td key={c.key} className={cn("px-3 py-2", c.align === "right" && "text-right tabular-nums")}>
                              {s.totals![c.key] ?? ""}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </article>
      )}

      <ReportSchedules reports={reports} />
    </div>
  )
}
