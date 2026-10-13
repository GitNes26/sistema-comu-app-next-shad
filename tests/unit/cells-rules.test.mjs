import test from "node:test"
import assert from "node:assert/strict"
import {
  birthdaysOfMonth,
  canDecideTransfer,
  isValidDay,
  isValidTime,
  lastOccurrenceInMonth,
  nextOccurrence,
  timeLabel,
} from "../../src/lib/cells/rules.ts"

const ymd = (d) => d.toISOString().slice(0, 10)

test("festejo: última reunión del mes según el día de la célula", () => {
  // Octubre 2026 termina en sábado 31.
  assert.equal(ymd(lastOccurrenceInMonth(2026, 9, 6)), "2026-10-31")
  // Último martes de octubre 2026.
  assert.equal(ymd(lastOccurrenceInMonth(2026, 9, 2)), "2026-10-27")
  // Febrero 2028 (bisiesto) termina en martes 29.
  assert.equal(ymd(lastOccurrenceInMonth(2028, 1, 2)), "2028-02-29")
  // Diciembre cruza de año sin problema.
  assert.equal(ymd(lastOccurrenceInMonth(2026, 11, 5)), "2026-12-25")
})

test("próxima reunión: hoy cuenta si coincide el día", () => {
  const monday = new Date("2026-10-12T15:00:00Z") // lunes
  assert.equal(ymd(nextOccurrence(1, monday)), "2026-10-12")
  assert.equal(ymd(nextOccurrence(4, monday)), "2026-10-15")
  assert.equal(ymd(nextOccurrence(0, monday)), "2026-10-18")
})

test("cumpleañeros del mes ordenados por día y con la edad que cumplen", () => {
  const d = (s) => new Date(`${s}T00:00:00.000Z`)
  const people = [
    { memberId: "1", fullName: "Zoé", birthDate: d("1990-10-20") },
    { memberId: "2", fullName: "Ana", birthDate: d("1985-10-05") },
    { memberId: "3", fullName: "Luis", birthDate: d("2000-11-01") },
    { memberId: "4", fullName: "Sin fecha", birthDate: null },
  ]
  const out = birthdaysOfMonth(people, 2026, 9)
  assert.deepEqual(out.map((b) => [b.fullName, b.day, b.turns]), [
    ["Ana", 5, 41],
    ["Zoé", 20, 36],
  ])
})

test("horario: validación y etiqueta", () => {
  assert.equal(isValidTime("19:30"), true)
  assert.equal(isValidTime("24:00"), false)
  assert.equal(isValidTime("7:30"), false)
  assert.equal(isValidDay(0), true)
  assert.equal(isValidDay(7), false)
  assert.equal(timeLabel("19:30"), "7:30 p. m.")
  assert.equal(timeLabel("00:05"), "12:05 a. m.")
})

test("traspaso: solo se decide si está pendiente", () => {
  assert.equal(canDecideTransfer("pending"), true)
  assert.equal(canDecideTransfer("approved"), false)
})
