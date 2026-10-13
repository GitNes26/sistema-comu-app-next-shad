import test from "node:test"
import assert from "node:assert/strict"
import { localParts, nextRunAfter, normalizeSlot, parseRecipients, periodForRun, slotLabel, validTimezone, zonedToUtc } from "../../src/lib/reports/schedule-rules.ts"

const MX = "America/Mexico_City"
const iso = (d) => d.toISOString()

test("zona horaria: hora local y vuelta a UTC", () => {
  assert.deepEqual(localParts(new Date("2026-10-14T03:00:00Z"), MX), { year: 2026, month: 10, day: 13, hour: 21, minute: 0 })
  assert.equal(iso(zonedToUtc(2026, 10, 19, 8, MX)), "2026-10-19T14:00:00.000Z")
  assert.equal(validTimezone("America/Mexico_City"), true)
  assert.equal(validTimezone("Marte/Olimpo"), false)
})

test("semanal: el siguiente lunes a las 8:00 locales, estrictamente después", () => {
  const slot = { frequency: "weekly", dayOfWeek: 1, dayOfMonth: 1, hour: 8 }
  assert.equal(iso(nextRunAfter(slot, new Date("2026-10-13T12:00:00Z"), MX)), "2026-10-19T14:00:00.000Z")
  // El mismo lunes, si todavía no llega la hora.
  assert.equal(iso(nextRunAfter(slot, new Date("2026-10-19T13:00:00Z"), MX)), "2026-10-19T14:00:00.000Z")
  // Justo a la hora: ya no cuenta, pasa a la semana siguiente.
  assert.equal(iso(nextRunAfter(slot, new Date("2026-10-19T14:00:00Z"), MX)), "2026-10-26T14:00:00.000Z")
})

test("el día se decide en la zona de la iglesia, no en UTC", () => {
  // 03:00Z del miércoles 14 todavía es martes 21:00 en la Ciudad de México.
  const slot = { frequency: "weekly", dayOfWeek: 2, dayOfMonth: 1, hour: 22 }
  assert.equal(iso(nextRunAfter(slot, new Date("2026-10-14T03:00:00Z"), MX)), "2026-10-14T04:00:00.000Z")
})

test("mensual: el día elegido, y pasa al mes siguiente si ya pasó", () => {
  const slot = { frequency: "monthly", dayOfWeek: 1, dayOfMonth: 5, hour: 9 }
  assert.equal(iso(nextRunAfter(slot, new Date("2026-10-13T12:00:00Z"), MX)), "2026-11-05T15:00:00.000Z")
  assert.equal(iso(nextRunAfter(slot, new Date("2026-10-01T12:00:00Z"), MX)), "2026-10-05T15:00:00.000Z")
  // Cruza de año.
  assert.equal(iso(nextRunAfter(slot, new Date("2026-12-20T12:00:00Z"), MX)), "2027-01-05T15:00:00.000Z")
})

test("horario de verano: la hora local se respeta antes y después del cambio", () => {
  const NY = "America/New_York"
  const slot = { frequency: "weekly", dayOfWeek: 0, dayOfMonth: 1, hour: 9 }
  assert.equal(iso(nextRunAfter(slot, new Date("2026-02-25T12:00:00Z"), NY)), "2026-03-01T14:00:00.000Z") // EST
  assert.equal(iso(nextRunAfter(slot, new Date("2026-03-02T12:00:00Z"), NY)), "2026-03-08T13:00:00.000Z") // EDT
})

test("periodo: la última semana completa y el último mes completo", () => {
  // Lunes: la semana que terminó ayer.
  assert.deepEqual(periodForRun("weekly", new Date("2026-10-19T14:00:00Z"), MX), { from: "2026-10-12", to: "2026-10-18" })
  // Miércoles y domingo: la última semana ya terminada.
  assert.deepEqual(periodForRun("weekly", new Date("2026-10-14T14:00:00Z"), MX), { from: "2026-10-05", to: "2026-10-11" })
  assert.deepEqual(periodForRun("weekly", new Date("2026-10-18T14:00:00Z"), MX), { from: "2026-10-05", to: "2026-10-11" })
  assert.deepEqual(periodForRun("monthly", new Date("2026-10-01T14:00:00Z"), MX), { from: "2026-09-01", to: "2026-09-30" })
  assert.deepEqual(periodForRun("monthly", new Date("2026-01-01T14:00:00Z"), MX), { from: "2025-12-01", to: "2025-12-31" })
  assert.deepEqual(periodForRun("monthly", new Date("2026-03-10T14:00:00Z"), MX), { from: "2026-02-01", to: "2026-02-28" })
})

test("configuración: valida frecuencia, día y hora; limpia correos", () => {
  assert.deepEqual(normalizeSlot({ frequency: "weekly" }), { frequency: "weekly", dayOfWeek: 1, dayOfMonth: 1, hour: 8 })
  assert.equal(normalizeSlot({ frequency: "daily" }), null)
  assert.equal(normalizeSlot({ frequency: "monthly", dayOfMonth: 31 }), null) // solo 1–28
  assert.equal(normalizeSlot({ frequency: "weekly", hour: 24 }), null)
  const r = parseRecipients("Ana@Iglesia.org, ana@iglesia.org; malo@, otro@dominio.mx\nx")
  assert.deepEqual(r.valid, ["ana@iglesia.org", "otro@dominio.mx"])
  assert.deepEqual(r.invalid, ["malo@", "x"])
  assert.equal(slotLabel({ frequency: "weekly", dayOfWeek: 1, dayOfMonth: 1, hour: 8 }), "Cada lunes a las 08:00")
  assert.equal(slotLabel({ frequency: "monthly", dayOfWeek: 1, dayOfMonth: 5, hour: 18 }), "El día 5 de cada mes a las 18:00")
})
