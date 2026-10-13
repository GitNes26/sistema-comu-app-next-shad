import test from "node:test"
import assert from "node:assert/strict"
import { PDFDocument } from "pdf-lib"
import { haversineKm, rankByDistance } from "../../src/lib/cells/geo.ts"
import { periodLabel, reportToCsv, resolvePeriod, periodBounds, pct } from "../../src/lib/reports/rules.ts"
import { renderReportPdf } from "../../src/lib/reports/pdf.ts"
import { GROWTH_EVENT_TEMPLATES, growthCheckForEventKind } from "../../src/lib/school/growth-rules.ts"

test("geo: distancia entre dos puntos conocidos", () => {
  // Torreón centro ↔ Gómez Palacio centro: ~ 8 km.
  const d = haversineKm({ lat: 25.5428, lng: -103.4068 }, { lat: 25.5611, lng: -103.4986 })
  assert.ok(d > 8 && d < 12, String(d))
  assert.equal(haversineKm({ lat: 10, lng: 10 }, { lat: 10, lng: 10 }), 0)
})

test("geo: ordena por cercanía y descarta lo que no tiene ubicación", () => {
  const origin = { lat: 25.54, lng: -103.4 }
  const ranked = rankByDistance(
    [
      { id: "lejos", lat: 25.7, lng: -103.2 },
      { id: "sin", lat: null, lng: null },
      { id: "cerca", lat: 25.541, lng: -103.401 },
    ],
    origin
  )
  assert.deepEqual(ranked.map((r) => r.id), ["cerca", "lejos"])
  assert.ok(ranked[0].distanceKm < ranked[1].distanceKm)
})

test("crecimiento: reconoce los tres eventos que dejan check", () => {
  assert.equal(growthCheckForEventKind("Bautismo en aguas"), "baptism")
  assert.equal(growthCheckForEventKind("bautizos de mayo"), "baptism")
  assert.equal(growthCheckForEventKind("Encuentro con Jesús"), "encounter")
  assert.equal(growthCheckForEventKind("Lanzamiento"), "launch")
  assert.equal(growthCheckForEventKind("Taller"), null)
  for (const t of Object.values(GROWTH_EVENT_TEMPLATES)) assert.ok(t.checklist.length >= 5 && t.description.length > 20)
})

test("reportes: periodo por defecto, invertido y acotado a un año", () => {
  const now = new Date("2026-10-13T12:00:00Z")
  assert.deepEqual(resolvePeriod(undefined, undefined, now), { from: "2026-10-01", to: "2026-10-31" })
  assert.deepEqual(resolvePeriod("2026-10-20", "2026-10-05"), { from: "2026-10-05", to: "2026-10-20" })
  const long = resolvePeriod("2020-01-01", "2026-01-01")
  assert.ok(long.to < "2021-01-05")
  assert.deepEqual(resolvePeriod("basura", "2026-02-30", now), { from: "2026-10-01", to: "2026-10-31" })
})

test("reportes: etiqueta del periodo, límites y porcentajes", () => {
  assert.equal(periodLabel({ from: "2026-10-01", to: "2026-10-31" }), "Del 1 al 31 de oct de 2026")
  assert.equal(periodLabel({ from: "2026-09-15", to: "2026-10-02" }), "Del 15 sep 2026 al 2 oct 2026")
  const b = periodBounds({ from: "2026-10-01", to: "2026-10-31" })
  assert.equal(b.end.toISOString(), "2026-11-01T00:00:00.000Z")
  assert.equal(pct(1, 3), 33.3)
  assert.equal(pct(1, 0), 0)
})

test("reportes: CSV escapa comas y comillas y lleva BOM", () => {
  const csv = reportToCsv({
    id: "x",
    title: "Prueba",
    periodLabel: "Hoy",
    kpis: [],
    sections: [{ title: "Sec", columns: [{ key: "a", label: "A" }, { key: "b", label: "B" }], rows: [{ a: 'con "comillas", y coma', b: 5 }], totals: { a: "Total", b: 5 } }],
  })
  assert.ok(csv.startsWith("\uFEFF"))
  assert.ok(csv.includes('"con ""comillas"", y coma",5'))
})

test("reportes: el PDF pagina tablas largas y tolera caracteres fuera de WinAnsi", async () => {
  const rows = Array.from({ length: 120 }, (_, i) => ({ n: `Persona ${i} ñ á é → ✓`, v: i }))
  const bytes = await renderReportPdf(
    {
      id: "x",
      title: "Reporte largo",
      periodLabel: "Del 1 al 31 de oct de 2026",
      kpis: [
        { label: "Total", value: "120" },
        { label: "Otro", value: "$1,000.00" },
      ],
      sections: [{ title: "Detalle", columns: [{ key: "n", label: "Nombre" }, { key: "v", label: "Valor", align: "right" }], rows, totals: { n: "Total", v: 7140 } }],
    },
    { organizationName: "Iglesia de prueba", logo: null }
  )
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-")
  const doc = await PDFDocument.load(bytes)
  assert.ok(doc.getPageCount() >= 3)
})
