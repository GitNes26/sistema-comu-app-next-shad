import test from "node:test"
import assert from "node:assert/strict"
import {
  canTransitionRequest,
  createsCycle,
  isAttendanceStatus,
  isMinistryRole,
  summarizeAttendance,
} from "../../src/lib/ministries/rules.ts"

test("resumen de asistencia: los justificados no cuentan como falta", () => {
  const s = summarizeAttendance(["present", "present", "absent", "excused"])
  assert.deepEqual(s, { total: 4, present: 2, absent: 1, excused: 1, rate: 67 })
})

test("resumen de asistencia: sin registros no hay porcentaje", () => {
  assert.equal(summarizeAttendance([]).rate, null)
  assert.equal(summarizeAttendance(["excused"]).rate, null)
})

test("requisiciones: solo la administración aprueba, rechaza y entrega", () => {
  assert.equal(canTransitionRequest("pending", "approved", "admin"), true)
  assert.equal(canTransitionRequest("pending", "approved", "requester"), false)
  assert.equal(canTransitionRequest("approved", "delivered", "admin"), true)
  assert.equal(canTransitionRequest("approved", "delivered", "requester"), false)
})

test("requisiciones: quien la pidió solo cancela mientras está pendiente", () => {
  assert.equal(canTransitionRequest("pending", "cancelled", "requester"), true)
  assert.equal(canTransitionRequest("approved", "cancelled", "requester"), false)
  assert.equal(canTransitionRequest("delivered", "cancelled", "admin"), false)
  assert.equal(canTransitionRequest("rejected", "approved", "admin"), false)
})

test("jerarquía de ministerios: detecta ciclos", () => {
  const parents = new Map([
    ["producción", null],
    ["audio", "producción"],
    ["micrófonos", "audio"],
  ])
  assert.equal(createsCycle("producción", "micrófonos", parents), true)
  assert.equal(createsCycle("audio", "audio", parents), true)
  assert.equal(createsCycle("micrófonos", "producción", parents), false)
  assert.equal(createsCycle("audio", null, parents), false)
})

test("validadores de enums", () => {
  assert.equal(isMinistryRole("leader"), true)
  assert.equal(isMinistryRole("admin"), false)
  assert.equal(isAttendanceStatus("present"), true)
  assert.equal(isAttendanceStatus("late"), false)
})
