import test from "node:test"
import assert from "node:assert/strict"
import { computePay, periodDays, rates, scheduledDays, suggestPeriod } from "../../src/lib/payroll/calc.ts"

const base = { dailyHours: 8, overtimeRate: 2, holidayRate: 2, restDayRate: 2 }
const cap = { daysWorked: 0, hoursWorked: 0, absences: 0, overtimeHours: 0, holidayDays: 0, restDaysWorked: 0, perceptions: [], deductions: [] }

test("tarifas: diario y por hora según el tipo de sueldo", () => {
  assert.deepEqual(rates({ ...base, salaryType: "monthly", salaryAmount: 9000 }), { daily: 300, hourly: 37.5 })
  assert.deepEqual(rates({ ...base, salaryType: "weekly", salaryAmount: 700 }), { daily: 100, hourly: 12.5 })
  assert.deepEqual(rates({ ...base, salaryType: "daily", salaryAmount: 400 }), { daily: 400, hourly: 50 })
  assert.deepEqual(rates({ ...base, salaryType: "hourly", salaryAmount: 50 }), { daily: 400, hourly: 50 })
  assert.deepEqual(rates({ ...base, salaryType: "", salaryAmount: 999 }), { daily: 0, hourly: 0 })
})

test("periodo: días naturales y días laborables", () => {
  assert.equal(periodDays("2026-10-01", "2026-10-15"), 15)
  assert.equal(periodDays("2026-10-01", "2026-10-01"), 1)
  // 1–7 oct 2026: jueves a miércoles; de lunes a viernes hay 5.
  assert.equal(scheduledDays("2026-10-01", "2026-10-07", [1, 2, 3, 4, 5]), 5)
})

test("sueldo mensual: cubre el periodo y descuenta faltas", () => {
  const c = { ...base, salaryType: "monthly", salaryAmount: 9000 }
  assert.equal(computePay(c, cap, 15).basePay, 4500)
  assert.equal(computePay(c, { ...cap, absences: 2 }, 15).basePay, 3900)
})

test("por día y por hora usan lo capturado", () => {
  assert.equal(computePay({ ...base, salaryType: "daily", salaryAmount: 400 }, { ...cap, daysWorked: 10 }, 15).basePay, 4000)
  assert.equal(computePay({ ...base, salaryType: "hourly", salaryAmount: 50 }, { ...cap, hoursWorked: 40 }, 15).basePay, 2000)
})

test("extras: horas, festivos y descansos con su multiplicador (0 = no se paga)", () => {
  const c = { ...base, salaryType: "monthly", salaryAmount: 9000 }
  const r = computePay(c, { ...cap, overtimeHours: 4, holidayDays: 1, restDaysWorked: 1 }, 30)
  assert.equal(r.overtimePay, 300) // 4 h × 37.5 × 2
  assert.equal(r.holidayPay, 600) // 1 × 300 × 2
  assert.equal(r.restDayPay, 600)
  assert.equal(computePay({ ...c, overtimeRate: 0 }, { ...cap, overtimeHours: 4 }, 30).overtimePay, 0)
})

test("conceptos: la percepción % va sobre el sueldo y la deducción % sobre el total, sin neto negativo", () => {
  const c = { ...base, salaryType: "monthly", salaryAmount: 9000 }
  const r = computePay(
    c,
    { ...cap, perceptions: [{ name: "Bono", calc: "percent", value: 10 }, { name: "Transporte", calc: "fixed", value: 200 }], deductions: [{ name: "Adelanto", calc: "percent", value: 10 }] },
    30
  )
  assert.equal(r.grossPay, 10100) // 9000 + 900 + 200
  assert.equal(r.totalDeductions, 1010)
  assert.equal(r.netPay, 9090)
  const neg = computePay(c, { ...cap, deductions: [{ name: "Préstamo", calc: "fixed", value: 99999 }] }, 30)
  assert.equal(neg.netPay, 0)
})

test("periodo sugerido por frecuencia", () => {
  const d = new Date(2026, 9, 13)
  assert.deepEqual(suggestPeriod("biweekly", d), { start: "2026-10-01", end: "2026-10-15" })
  assert.deepEqual(suggestPeriod("monthly", d), { start: "2026-10-01", end: "2026-10-31" })
  assert.deepEqual(suggestPeriod("weekly", d), { start: "2026-10-12", end: "2026-10-18" })
})
