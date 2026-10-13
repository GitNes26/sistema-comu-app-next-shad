import test from "node:test"
import assert from "node:assert/strict"
import { canTransition, isFollowUpOverdue, normalizePhone, outcomeRequired } from "../../src/lib/consolidation/rules.ts"
import {
  DEFAULT_ROOMS,
  ageInMonths,
  ageLabel,
  isValidBirthDate,
  parseQrPayload,
  qrPayload,
  roomForAge,
  sanitizeChecklist,
} from "../../src/lib/kids/rules.ts"

const d = (s) => new Date(`${s}T00:00:00.000Z`)

test("consolidación: un caso cerrado o canalizado solo lo reabre quien gestiona", () => {
  assert.equal(canTransition("received", "following", false), true)
  assert.equal(canTransition("following", "channeled", false), true)
  assert.equal(canTransition("closed", "following", false), false)
  assert.equal(canTransition("closed", "following", true), true)
  assert.equal(canTransition("channeled", "channeled", false), true)
})

test("consolidación: canalizar exige destino", () => {
  assert.equal(outcomeRequired("channeled"), true)
  assert.equal(outcomeRequired("following"), false)
})

test("consolidación: vencimiento del seguimiento", () => {
  const now = new Date("2026-10-12T12:00:00Z")
  const base = { status: "following", lastContactAt: null, nextContactAt: null, createdAt: new Date("2026-10-11T12:00:00Z") }
  assert.equal(isFollowUpOverdue(base, now), false)
  assert.equal(isFollowUpOverdue({ ...base, createdAt: new Date("2026-10-01T00:00:00Z") }, now), true)
  assert.equal(isFollowUpOverdue({ ...base, nextContactAt: new Date("2026-10-13T00:00:00Z") }, now), false)
  assert.equal(isFollowUpOverdue({ ...base, nextContactAt: new Date("2026-10-11T00:00:00Z") }, now), true)
  assert.equal(isFollowUpOverdue({ ...base, status: "closed", createdAt: new Date("2026-01-01") }, now), false)
})

test("teléfono: solo dígitos, últimos 10", () => {
  assert.equal(normalizePhone("+52 (871) 100-0001"), "8711000001")
  assert.equal(normalizePhone("123"), null)
  assert.equal(normalizePhone(undefined), null)
})

test("kids: edad en meses y etiqueta", () => {
  assert.equal(ageInMonths(d("2024-10-12"), d("2026-10-12")), 24)
  assert.equal(ageInMonths(d("2024-10-13"), d("2026-10-12")), 23)
  assert.equal(ageLabel(d("2026-02-12"), d("2026-10-12")), "8 meses")
  assert.equal(ageLabel(d("2021-10-12"), d("2026-10-12")), "5 años")
})

test("kids: el salón se deduce por la edad", () => {
  const rooms = DEFAULT_ROOMS.map((r, i) => ({ ...r, id: `r${i}`, isActive: true }))
  assert.equal(roomForAge(rooms, 10)?.name, "Bebés")
  assert.equal(roomForAge(rooms, 47)?.name, "Bebés")
  assert.equal(roomForAge(rooms, 48)?.name, "4–5 años")
  assert.equal(roomForAge(rooms, 6 * 12)?.name, "6–7 años")
  assert.equal(roomForAge(rooms, 12 * 12)?.name, "10–12 años")
  assert.equal(roomForAge(rooms, 14 * 12), null)
  assert.equal(roomForAge(rooms.map((r) => ({ ...r, isActive: false })), 10), null)
})

test("kids: QR con prefijo o token suelto; rechaza basura", () => {
  const token = "abcDEF123456_-xyz7890"
  assert.equal(parseQrPayload(qrPayload(token)), token)
  assert.equal(parseQrPayload(token), token)
  assert.equal(parseQrPayload("hola"), null)
  assert.equal(parseQrPayload("<script>"), null)
  assert.equal(parseQrPayload(42), null)
})

test("kids: lista de verificación solo con elementos conocidos", () => {
  assert.deepEqual(sanitizeChecklist({ Pañales: true, Cobija: false, Otro: true, Chupón: "sí" }), { Pañales: true, Cobija: false })
  assert.deepEqual(sanitizeChecklist(null), {})
})

test("kids: fecha de nacimiento válida", () => {
  const ref = d("2026-10-12")
  assert.equal(isValidBirthDate(d("2020-01-01"), ref), true)
  assert.equal(isValidBirthDate(d("2027-01-01"), ref), false)
  assert.equal(isValidBirthDate(d("1990-01-01"), ref), false)
})
