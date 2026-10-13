import test from "node:test"
import assert from "node:assert/strict"
import {
  averageOver,
  canEnroll,
  countBlanks,
  enrollmentBalance,
  finalGrade,
  gradeQuestion,
  isPassing,
  normalizeText,
  percentToGrade,
  sanitizeQuestionConfig,
  studentView,
  submissionPercent,
} from "../../src/lib/school/rules.ts"

test("texto: ignora acentos, mayúsculas y espacios", () => {
  assert.equal(normalizeText("  Jesús   CRISTO "), "jesus cristo")
})

test("configuración: valida cada tipo de pregunta", () => {
  assert.throws(() => sanitizeQuestionConfig("multiple_choice", { options: [{ text: "a" }], correct: 0 }), /2 opciones/)
  assert.throws(() => sanitizeQuestionConfig("multiple_choice", { options: [{ text: "a" }, { text: "b" }], correct: 5 }), /correcta/)
  assert.deepEqual(sanitizeQuestionConfig("true_false", { correct: true }), { kind: "true_false", correct: true })
  assert.throws(() => sanitizeQuestionConfig("fill_blank", { answers: [["Dios"]] }, "___ es amor y ___ es luz"), /2 espacio/)
  assert.equal(countBlanks("A ___ y B ____"), 2)
  assert.throws(() => sanitizeQuestionConfig("matching", { pairs: [{ left: "a", right: "1" }] }), /2 parejas/)
  assert.throws(() => sanitizeQuestionConfig("ordering", { items: ["uno"] }), /2 elementos/)
})

test("calificación: opción múltiple, selección y verdadero/falso", () => {
  const mc = { kind: "multiple_choice", options: [{ text: "a" }, { text: "b" }], correct: 1 }
  assert.equal(gradeQuestion(mc, 1, 2).points, 2)
  assert.equal(gradeQuestion(mc, 0, 2).points, 0)
  assert.equal(gradeQuestion(mc, null, 2).points, 0)
  const ms = { kind: "multiple_select", options: [{ text: "a" }, { text: "b" }, { text: "c" }], correct: [0, 2] }
  assert.equal(gradeQuestion(ms, [2, 0], 3).points, 3)
  assert.equal(gradeQuestion(ms, [0], 3).points, 0)
  assert.equal(gradeQuestion({ kind: "true_false", correct: false }, false, 1).points, 1)
  assert.equal(gradeQuestion({ kind: "true_false", correct: false }, "false", 1).points, 0)
})

test("calificación: completar, relacionar y ordenar dan crédito parcial", () => {
  const fb = { kind: "fill_blank", answers: [["Dios", "El Señor"], ["amor"]] }
  assert.equal(gradeQuestion(fb, ["  DIOS ", "Amor"], 4).points, 4)
  assert.equal(gradeQuestion(fb, ["dios", "odio"], 4).points, 2)
  const mt = { kind: "matching", pairs: [{ left: "Génesis", right: "Principio" }, { left: "Éxodo", right: "Salida" }] }
  assert.equal(gradeQuestion(mt, ["principio", "Salida"], 2).points, 2)
  assert.equal(gradeQuestion(mt, ["Salida", "Principio"], 2).points, 0)
  const od = { kind: "ordering", items: ["Primero", "Segundo", "Tercero"] }
  assert.equal(gradeQuestion(od, ["Primero", "Segundo", "Tercero"], 3).points, 3)
  assert.equal(gradeQuestion(od, ["Primero", "Tercero", "Segundo"], 3).points, 1)
})

test("calificación: la respuesta abierta queda para revisión", () => {
  assert.equal(gradeQuestion({ kind: "open" }, "texto", 5).points, null)
})

test("vista del alumno: no revela respuestas y es estable", () => {
  const mc = { kind: "multiple_choice", options: [{ text: "a" }, { text: "b" }], correct: 1 }
  assert.ok(!("correct" in studentView(mc, "s")))
  const od = { kind: "ordering", items: ["1", "2", "3", "4", "5", "6"] }
  const a = studentView(od, "alumno-1")
  const b = studentView(od, "alumno-1")
  assert.deepEqual(a, b)
  assert.deepEqual([...a.items].sort(), ["1", "2", "3", "4", "5", "6"])
})

test("notas: promedio sobre el total, GRAL y aprobación", () => {
  assert.equal(percentToGrade(85), 8.5)
  assert.equal(percentToGrade(120), 10)
  // 5 de 7 tareas entregadas: lo que falta cuenta como 0, igual que la planilla.
  assert.equal(averageOver([10, 9, 8, 7, 6], 7), 5.71)
  assert.equal(averageOver([], 0), null)
  assert.equal(finalGrade(8, 9), 8.5)
  assert.equal(finalGrade(null, 9), null)
  assert.equal(isPassing(7, 7), true)
  assert.equal(isPassing(6.99, 7), false)
  assert.equal(submissionPercent(7, 10), 70)
  assert.equal(submissionPercent(0, 0), 0)
})

test("inscripción: saldo con libro opcional", () => {
  assert.equal(enrollmentBalance(200, 150, false, [100]), 100)
  assert.equal(enrollmentBalance(200, 150, true, [100]), 250)
  assert.equal(enrollmentBalance(200, 150, true, [400]), 0)
})

test("inscripción: uno a la vez y libros en orden", () => {
  const courses = [
    { courseId: "c1", sortOrder: 1 },
    { courseId: "c2", sortOrder: 2 },
    { courseId: "c3", sortOrder: 3 },
  ]
  assert.deepEqual(canEnroll("ministry", courses[0], courses, []), { ok: true })
  assert.equal(canEnroll("ministry", courses[1], courses, []).ok, false) // falta aprobar el 1
  assert.deepEqual(canEnroll("ministry", courses[1], courses, [{ courseId: "c1", sortOrder: 1, passed: true, active: false }]), { ok: true })
  // Reprobó el 1: no pasa al 2, pero puede repetir el 1.
  assert.equal(canEnroll("ministry", courses[1], courses, [{ courseId: "c1", sortOrder: 1, passed: false, active: false }]).ok, false)
  assert.deepEqual(canEnroll("ministry", courses[0], courses, [{ courseId: "c1", sortOrder: 1, passed: false, active: false }]), { ok: true })
  // Dos al mismo tiempo, no.
  assert.equal(canEnroll("ministry", courses[0], courses, [{ courseId: "c1", sortOrder: 1, passed: false, active: true }]).ok, false)
  // Universidad: sin orden obligatorio.
  assert.deepEqual(canEnroll("university", courses[2], courses, []), { ok: true })
})
