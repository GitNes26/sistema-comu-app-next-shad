import test from "node:test"
import assert from "node:assert/strict"
import { computePoints } from "../../src/lib/school/points.ts"
import { amountInWords, receiptFolio } from "../../src/lib/finance/receipt-rules.ts"

test("puntos: asistencia, tareas y pagos suman y se aprueba con el mínimo", () => {
  const full = computePoints({ attended: 8, held: 8, grade: 10, paid: 500, due: 500 })
  assert.deepEqual([full.attendance, full.assignments, full.payments, full.total, full.max, full.passed], [30, 10, 10, 50, 50, true])
  // Justo en el mínimo (30): asistencia perfecta sin tareas ni pagos aprueba.
  const edge = computePoints({ attended: 8, held: 8, grade: null, paid: 0, due: 500 })
  assert.equal(edge.total, 30)
  assert.equal(edge.passed, true)
  const low = computePoints({ attended: 4, held: 8, grade: 6, paid: 250, due: 500 })
  assert.deepEqual([low.attendance, low.assignments, low.payments, low.total, low.passed], [15, 6, 5, 26, false])
})

test("puntos: sin clases impartidas ni deuda no rompe; sin cuota da los puntos de pago", () => {
  const r = computePoints({ attended: 0, held: 0, grade: null, paid: 0, due: 0 })
  assert.deepEqual([r.attendance, r.assignments, r.payments, r.total], [0, 0, 10, 10])
  const custom = computePoints({ attended: 1, held: 1, grade: 10, paid: 1, due: 1 }, { attendance: 60, assignments: 20, payments: 20, toPass: 70 })
  assert.deepEqual([custom.total, custom.max, custom.passed], [100, 100, true])
})

test("recibo: importe con letra", () => {
  assert.equal(amountInWords(1), "Un peso 00/100 M.N.")
  assert.equal(amountInWords(21), "Veintiún pesos 00/100 M.N.")
  assert.equal(amountInWords(21000), "Veintiún mil pesos 00/100 M.N.")
  assert.equal(amountInWords(100), "Cien pesos 00/100 M.N.")
  assert.equal(amountInWords(1250.5), "Mil doscientos cincuenta pesos 50/100 M.N.")
  assert.equal(amountInWords(2000), "Dos mil pesos 00/100 M.N.")
  assert.equal(amountInWords(1_000_000), "Un millón de pesos 00/100 M.N.")
  assert.equal(amountInWords(35), "Treinta y cinco pesos 00/100 M.N.")
  assert.equal(amountInWords(101.99), "Ciento un pesos 99/100 M.N.")
})

test("recibo: folio por año", () => {
  assert.equal(receiptFolio(2026, 7), "R-2026-0007")
  assert.equal(receiptFolio(2026, 12345), "R-2026-12345")
})
