"use client"

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { compactNumber, formatMetric } from "@/lib/reports/rules"
import type { ReportChart } from "@/lib/reports/types"

// Gráficas del reporte (comparativos y tendencias) con los colores del tema.

const COLORS = ["var(--primary)", "var(--muted-foreground)", "oklch(0.72 0.15 70)"]

export function ReportChartView({ chart }: { chart: ReportChart }) {
  const data = chart.categories.map((name, i) => Object.fromEntries([["name", name], ...chart.series.map((s) => [s.name, s.values[i] ?? 0])]))
  const fmt = (v: number) => formatMetric(v, chart.unit)
  const axis = (v: number) => (chart.unit === "money" ? `$${compactNumber(v)}` : chart.unit === "percent" ? `${compactNumber(v)}%` : compactNumber(v))
  const common = {
    data,
    margin: { top: 8, right: 8, bottom: 4, left: -8 },
  }
  const tooltip = (
    <Tooltip
      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
      formatter={(v) => fmt(Number(v))}
      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
    />
  )
  const summary = chart.series.map((s) => `${s.name}: ${s.values.map(fmt).join(", ")}`).join(". ")
  return (
    <figure className="space-y-2 rounded-2xl border bg-card p-3" aria-label={`${chart.title}. ${chart.categories.join(", ")}. ${summary}`}>
      <figcaption className="text-sm font-semibold">{chart.title}</figcaption>
      <div className="h-56 w-full" role="img" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {chart.kind === "bar" ? (
            <BarChart {...common}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={chart.categories.length > 4 ? -20 : 0} textAnchor={chart.categories.length > 4 ? "end" : "middle"} height={chart.categories.length > 4 ? 56 : 30} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} allowDecimals />
              {tooltip}
              {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {chart.series.map((s, i) => (
                <Bar key={s.name} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[5, 5, 0, 0]} />
              ))}
            </BarChart>
          ) : (
            <LineChart {...common}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} allowDecimals />
              {tooltip}
              {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {chart.series.map((s, i) => (
                <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2.2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
