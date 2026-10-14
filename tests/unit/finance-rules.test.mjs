import test from "node:test"
import assert from "node:assert/strict"
import { balanceOf, expiryStatus, groupSum, kmPerLiter, monthRange, serviceDue } from "../../src/lib/finance/rules.ts"

const d = (s) => new Date(`${s}T00:00:00.000Z`)

test("vencimientos: ok, por vencer y vencido", () => {
  const today = d("2026-10-12")
  assert.equal(expiryStatus(null, today), "none")
  assert.equal(expiryStatus(d("2027-03-01"), today), "ok")
  assert.equal(expiryStatus(d("2026-11-05"), today), "soon")
  assert.equal(expiryStatus(d("2026-10-12"), today), "soon")
  assert.equal(expiryStatus(d("2026-10-11"), today), "expired")
})

test("combustible: rendimiento entre cargas", () => {
  assert.equal(kmPerLiter(10000, 10450, 30), 15)
  assert.equal(kmPerLiter(10000, 10000, 30), null)
  assert.equal(kmPerLiter(null, 10450, 30), null)
  assert.equal(kmPerLiter(10000, 10450, 0), null)
})

test("servicio: toca por fecha próxima o por kilometraje", () => {
  const today = d("2026-10-12")
  assert.equal(serviceDue({ date: d("2026-12-01"), odometer: null }, { today, odometer: 1000 }), false)
  assert.equal(serviceDue({ date: d("2026-10-20"), odometer: null }, { today, odometer: 1000 }), true)
  assert.equal(serviceDue({ date: null, odometer: 15000 }, { today, odometer: 14600 }), true)
  assert.equal(serviceDue({ date: null, odometer: 15000 }, { today, odometer: 12000 }), false)
})

test("periodos y sumas", () => {
  const r = monthRange("2026-02")
  assert.equal(r.start.toISOString().slice(0, 10), "2026-02-01")
  assert.equal(r.end.toISOString().slice(0, 10), "2026-03-01")
  assert.equal(monthRange("basura", d("2026-10-12")).label, "2026-10")
  const sums = groupSum([{ k: "a", v: 10.1 }, { k: "b", v: 5 }, { k: "a", v: 2.2 }], (r) => r.k, (r) => r.v)
  assert.deepEqual(sums, [{ key: "a", total: 12.3 }, { key: "b", total: 5 }])
  assert.equal(balanceOf(1000.5, 400.25), 600.25)
})
