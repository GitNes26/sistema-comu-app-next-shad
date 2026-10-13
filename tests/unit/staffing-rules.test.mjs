import test from "node:test"
import assert from "node:assert/strict"
import { eventClosedForStaffing, isStaffAction, remainingSlots, staffCounts } from "../../src/lib/events/staffing-rules.ts"

test("lugares: solo asignados y confirmados ocupan lugar", () => {
  const s = ["confirmed", "assigned", "offered", "declined", "rejected"]
  assert.deepEqual(staffCounts(s), { confirmed: 1, assigned: 1, offered: 1, taken: 2 })
  assert.equal(remainingSlots(5, s), 3)
  assert.equal(remainingSlots(1, ["confirmed", "confirmed"]), 0) // nunca negativo
  assert.equal(remainingSlots(3, []), 3)
})

test("evento cerrado para pedidos: cancelado, cerrado o ya pasado más de un día", () => {
  const now = new Date("2026-10-13T12:00:00Z")
  assert.equal(eventClosedForStaffing(new Date("2026-10-20T12:00:00Z"), "published", now), false)
  assert.equal(eventClosedForStaffing(new Date("2026-10-13T08:00:00Z"), "published", now), false) // hoy
  assert.equal(eventClosedForStaffing(new Date("2026-10-10T12:00:00Z"), "published", now), true)
  assert.equal(eventClosedForStaffing(new Date("2026-10-20T12:00:00Z"), "cancelled", now), true)
  assert.equal(eventClosedForStaffing(new Date("2026-10-20T12:00:00Z"), "closed", now), true)
})

test("acciones válidas", () => {
  for (const a of ["assign", "remove", "approve", "reject", "offer", "withdraw", "confirm", "decline"]) assert.equal(isStaffAction(a), true)
  assert.equal(isStaffAction("borrar"), false)
  assert.equal(isStaffAction(undefined), false)
})
