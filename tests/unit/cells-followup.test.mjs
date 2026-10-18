import test from "node:test"
import assert from "node:assert/strict"
import { buildFollowUpSheet, occurrencesInMonth, weekColumn } from "../../src/lib/cells/followup-rules.ts"
import { renderFollowUpPdf } from "../../src/lib/cells/followup-pdf.ts"

const person = (id, name, role = "member", extra = {}) => ({
  memberId: id,
  fullName: name,
  phone: "871 000 0000",
  role,
  baptizedWater: false,
  baptizedFire: false,
  encounterAt: null,
  launchAt: null,
  ministryPassed: 0,
  ministryTotal: 4,
  theologyPassed: 0,
  ...extra,
})
const att = (entries) => new Map(entries.map(([id, present, isNew = false]) => [id, { present, isNew }]))

test("occurrencesInMonth devuelve los miércoles de octubre 2026", () => {
  assert.deepEqual(occurrencesInMonth(2026, 9, 3), ["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"])
})

test("weekColumn usa la semana de la reunión o la semana del mes", () => {
  const occ = occurrencesInMonth(2026, 9, 3)
  assert.equal(weekColumn("2026-10-14", occ), 1)
  assert.equal(weekColumn("2026-10-16", occ), 2) // viernes de la segunda quincena: semana 3 del mes
  assert.equal(weekColumn("2026-10-31", occ), 4)
})

test("la hoja separa ovejas y nuevos creyentes y marca asistencia y crecimiento", () => {
  const sheet = buildFollowUpSheet({
    year: 2026,
    monthIndex: 9,
    cell: { name: "Hogar Centro", dayOfWeek: 3, startTime: "19:30", host: "Ana", network: "Red Norte", pastor: "Pr. Luis", street: "Calle 1", neighborhood: "Centro" },
    people: [
      person("l", "Laura Líder", "leader", { baptizedWater: true, encounterAt: new Date("2026-01-01"), ministryPassed: 4 }),
      person("a", "Beto", "member", { ministryPassed: 2, theologyPassed: 1 }),
      person("n", "Nueva Creyente"),
    ],
    meetings: [
      { date: "2026-10-07", notes: "Buena reunión", attendance: att([["l", true], ["a", true], ["n", true, true]]) },
      { date: "2026-10-14", notes: null, attendance: att([["l", true], ["a", false]]) },
    ],
  })
  assert.equal(sheet.monthLabel, "Octubre 2026")
  assert.deepEqual(sheet.cell.leaders, ["Laura Líder"])
  assert.equal(sheet.sheep.length, 2)
  assert.equal(sheet.newBelievers.length, 1)
  assert.deepEqual(sheet.sheep[0].weeks.slice(0, 3), [true, true, null])
  assert.deepEqual(sheet.sheep[1].weeks.slice(0, 2), [true, false])
  assert.equal(sheet.sheep[0].growth.em.done, true)
  assert.equal(sheet.sheep[1].growth.em.partial, 2)
  assert.equal(sheet.sheep[1].growth.ut.partial, 1)
  assert.deepEqual(sheet.presentPerWeek.slice(0, 2), [3, 1])
  assert.equal(sheet.weekDates[0], "2026-10-07")
  assert.match(sheet.observations[0], /07\/10: Buena reunión/)
})

test("el PDF de la hoja se genera, incluso con más de 18 ovejas", async () => {
  const people = Array.from({ length: 40 }, (_, i) => person(`m${i}`, `Oveja ${i + 1}`))
  const sheet = buildFollowUpSheet({
    year: 2026,
    monthIndex: 9,
    cell: { name: "Hogar Grande", dayOfWeek: 3, startTime: "19:30", host: null, network: null, pastor: null, street: null, neighborhood: null },
    people,
    meetings: [{ date: "2026-10-07", notes: null, attendance: att(people.map((p) => [p.memberId, true])) }],
  })
  const pdf = await renderFollowUpPdf([sheet], { organizationName: "Comunidad Torreón", logo: null })
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-")
  assert.ok(pdf.length > 3000)
})
