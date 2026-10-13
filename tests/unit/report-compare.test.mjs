import test from "node:test"
import assert from "node:assert/strict"
import { PDFDocument } from "pdf-lib"
import { changePct, compactNumber, compareMetrics, comparisonPeriod, formatChange, niceScale, previousPeriod, sameLastYear } from "../../src/lib/reports/rules.ts"
import { renderReportPdf } from "../../src/lib/reports/pdf.ts"

test("periodo anterior: mes completo, año completo y rango libre", () => {
  assert.deepEqual(previousPeriod({ from: "2026-10-01", to: "2026-10-31" }), { from: "2026-09-01", to: "2026-09-30" })
  assert.deepEqual(previousPeriod({ from: "2026-03-01", to: "2026-03-31" }), { from: "2026-02-01", to: "2026-02-28" })
  assert.deepEqual(previousPeriod({ from: "2026-01-01", to: "2026-01-31" }), { from: "2025-12-01", to: "2025-12-31" })
  assert.deepEqual(previousPeriod({ from: "2026-01-01", to: "2026-12-31" }), { from: "2025-01-01", to: "2025-12-31" })
  // Rango libre: mismos 7 días justo antes.
  assert.deepEqual(previousPeriod({ from: "2026-10-12", to: "2026-10-18" }), { from: "2026-10-05", to: "2026-10-11" })
  assert.deepEqual(previousPeriod({ from: "2026-10-05", to: "2026-10-05" }), { from: "2026-10-04", to: "2026-10-04" })
})

test("mismo periodo del año anterior (con 29 de febrero)", () => {
  assert.deepEqual(sameLastYear({ from: "2026-10-01", to: "2026-10-31" }), { from: "2025-10-01", to: "2025-10-31" })
  assert.deepEqual(sameLastYear({ from: "2028-02-01", to: "2028-02-29" }), { from: "2027-02-01", to: "2027-02-28" })
  assert.equal(comparisonPeriod({ from: "2026-10-01", to: "2026-10-31" }, "none"), null)
  assert.deepEqual(comparisonPeriod({ from: "2026-10-01", to: "2026-10-31" }, "year"), { from: "2025-10-01", to: "2025-10-31" })
})

test("variación: porcentajes, base cero y formato", () => {
  assert.equal(changePct(150, 100), 50)
  assert.equal(changePct(50, 100), -50)
  assert.equal(changePct(10, 0), null)
  assert.equal(changePct(0, 0), 0)
  assert.equal(formatChange(150, 100), "+50%")
  assert.equal(formatChange(50, 100), "-50%")
  assert.equal(formatChange(10, 0), "nuevo")
  assert.equal(formatChange(7, 7), "sin cambio")
})

test("cifras comparadas: lo que no existía antes cuenta como cero", () => {
  const cur = [
    { key: "a", label: "A", value: 20, unit: "number" },
    { key: "b", label: "B", value: 5, unit: "number" },
  ]
  const prev = [{ key: "a", label: "A", value: 10, unit: "number" }]
  const r = compareMetrics(cur, prev)
  assert.equal(r[0].change, 100)
  assert.equal(r[1].previous, 0)
  assert.equal(r[1].changeLabel, "nuevo")
})

test("escala del eje: valores redondos y etiquetas compactas", () => {
  assert.deepEqual(niceScale(0), { max: 1, step: 0.25 })
  const s = niceScale(87)
  assert.ok(s.max >= 87 && s.step === 50 && s.max === 100)
  assert.equal(niceScale(1234.5).step, 500)
  assert.equal(compactNumber(950), "950")
  assert.equal(compactNumber(12000), "12 mil")
  assert.equal(compactNumber(2_500_000), "2.5 M")
})

test("PDF con gráficas de barras y de línea no rompe y conserva el contenido", async () => {
  const bytes = await renderReportPdf(
    {
      id: "x",
      title: "Con gráficas",
      periodLabel: "Del 1 al 31 de oct de 2026",
      kpis: [{ label: "Total", value: "10" }],
      charts: [
        { id: "c1", title: "Actual vs anterior", kind: "bar", unit: "money", categories: ["Ingresos", "Gastos", "Saldo"], series: [{ name: "Actual", values: [12000, 8000, 4000] }, { name: "Anterior", values: [10000, 9000, 1000] }] },
        { id: "c2", title: "Tendencia", kind: "line", unit: "number", categories: ["5 oct", "12 oct", "19 oct", "26 oct"], series: [{ name: "Total", values: [120, 135, 128, 150] }] },
        { id: "c3", title: "Vacía", kind: "bar", unit: "number", categories: [], series: [] },
        { id: "c4", title: "Todo en cero", kind: "bar", unit: "number", categories: ["A"], series: [{ name: "S", values: [0] }] },
      ],
      sections: [{ title: "Tabla", columns: [{ key: "a", label: "A" }], rows: [{ a: "uno" }] }],
    },
    { organizationName: "Iglesia", logo: null }
  )
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-")
  assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1)
})
