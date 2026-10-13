import test from "node:test"
import assert from "node:assert/strict"
import { lastOccurrenceOnOrBefore, newExceedsTotal, parseCount, summarize, totalAttendance } from "../../src/lib/gatherings/rules.ts"

test("asistencia total: nuevos no suma (es un subconjunto)", () => {
  assert.equal(totalAttendance({ men: 40, women: 55, youth: 20, kids: 18, new: 6 }), 133)
})

test("conteo capturado: enteros no negativos", () => {
  assert.equal(parseCount("12"), 12)
  assert.equal(parseCount(""), 0)
  assert.equal(parseCount(null), 0)
  assert.equal(parseCount(-1), null)
  assert.equal(parseCount(2.5), null)
  assert.equal(parseCount("abc"), null)
  assert.equal(parseCount(100001), null)
})

test("nuevos no puede superar la asistencia", () => {
  assert.equal(newExceedsTotal({ men: 1, women: 1, youth: 0, kids: 0, new: 3 }), true)
  assert.equal(newExceedsTotal({ men: 5, women: 5, youth: 0, kids: 0, new: 3 }), false)
})

test("resumen del mes: totales, promedio y mejor reunión", () => {
  const rows = [
    { date: "2026-10-04", counts: { men: 30, women: 40, youth: 10, kids: 10, new: 2 } },
    { date: "2026-10-11", counts: { men: 35, women: 45, youth: 12, kids: 8, new: 5 } },
  ]
  const s = summarize(rows)
  assert.equal(s.total, 190)
  assert.equal(s.average, 95)
  assert.equal(s.totals.new, 7)
  assert.deepEqual(s.best, { date: "2026-10-11", total: 100 })
  assert.deepEqual(summarize([]), { totals: { men: 0, women: 0, youth: 0, kids: 0, new: 0 }, total: 0, average: 0, best: null })
})

test("última vez que cayó un día de la semana", () => {
  const monday = new Date(2026, 9, 12) // lunes 12 de octubre de 2026
  assert.equal(lastOccurrenceOnOrBefore(1, monday), "2026-10-12")
  assert.equal(lastOccurrenceOnOrBefore(0, monday), "2026-10-11")
  assert.equal(lastOccurrenceOnOrBefore(3, monday), "2026-10-07")
})
