import test from "node:test"
import assert from "node:assert/strict"
import { acceptsDonations, campaignProgress, remainingToGoal } from "../../src/lib/finance/campaign-rules.ts"

const d = (s) => new Date(`${s}T00:00:00.000Z`)

test("campaña: recibe aportaciones solo activa y dentro de su vigencia", () => {
  const now = new Date("2026-10-14T15:00:00Z")
  assert.equal(acceptsDonations({ status: "active", startsAt: null, endsAt: null }, now), true)
  assert.equal(acceptsDonations({ status: "paused", startsAt: null, endsAt: null }, now), false)
  assert.equal(acceptsDonations({ status: "closed", startsAt: null, endsAt: null }, now), false)
  assert.equal(acceptsDonations({ status: "active", startsAt: d("2026-10-15"), endsAt: null }, now), false) // aún no abre
  assert.equal(acceptsDonations({ status: "active", startsAt: null, endsAt: d("2026-10-13") }, now), false) // ya venció
  assert.equal(acceptsDonations({ status: "active", startsAt: d("2026-10-14"), endsAt: d("2026-10-14") }, now), true) // fechas inclusivas
})

test("campaña: avance y faltante respecto de la meta", () => {
  assert.equal(campaignProgress(250, 1000), 25)
  assert.equal(campaignProgress(1500, 1000), 100)
  assert.equal(campaignProgress(10, null), null)
  assert.equal(campaignProgress(10, 0), null)
  assert.equal(remainingToGoal(250, 1000), 750)
  assert.equal(remainingToGoal(1500, 1000), 0)
  assert.equal(remainingToGoal(10, null), null)
})
