import test from "node:test"
import assert from "node:assert/strict"
import {
  addDays,
  canResolveAudition,
  monthRange,
  moveItem,
  normalizeKey,
  sanitizeLinks,
  toYmd,
  weekStartOf,
} from "../../src/lib/worship/rules.ts"

test("tonos: normaliza mayúsculas, menores y alteraciones", () => {
  assert.equal(normalizeKey("g"), "G")
  assert.equal(normalizeKey("f#m"), "F#m")
  assert.equal(normalizeKey(" Am "), "Am")
  assert.equal(normalizeKey("bb"), "Bb")
  assert.equal(normalizeKey("H"), null)
  assert.equal(normalizeKey(""), null)
  assert.equal(normalizeKey(5), null)
})

test("enlaces: solo http(s), con etiqueta y máximo 10", () => {
  const links = sanitizeLinks([
    { label: "YouTube", url: "https://youtube.com/watch?v=1" },
    { label: "", url: "http://www.example.com/x" },
    { label: "Malo", url: "javascript:alert(1)" },
    { label: "Sin esquema", url: "example.com" },
    null,
  ])
  assert.deepEqual(links, [
    { label: "YouTube", url: "https://youtube.com/watch?v=1" },
    { label: "example.com", url: "http://www.example.com/x" },
  ])
  const many = sanitizeLinks(Array.from({ length: 20 }, (_, i) => ({ label: `L${i}`, url: `https://x.com/${i}` })))
  assert.equal(many.length, 10)
})

test("semana: inicia en lunes (domingo pertenece a la semana que termina)", () => {
  assert.equal(toYmd(weekStartOf("2026-10-12")), "2026-10-12") // lunes
  assert.equal(toYmd(weekStartOf("2026-10-14")), "2026-10-12") // miércoles
  assert.equal(toYmd(weekStartOf("2026-10-18")), "2026-10-12") // domingo
  assert.equal(toYmd(weekStartOf("2026-10-19")), "2026-10-19")
  assert.equal(toYmd(addDays(weekStartOf("2026-10-12"), -7)), "2026-10-05")
})

test("mes: rango [inicio, fin)", () => {
  const { from, to } = monthRange("2026-12")
  assert.equal(toYmd(from), "2026-12-01")
  assert.equal(toYmd(to), "2027-01-01")
  assert.throws(() => monthRange("2026-13"))
  assert.throws(() => monthRange("octubre"))
})

test("audiciones: solo se resuelven mientras están programadas", () => {
  assert.equal(canResolveAudition("scheduled", "passed"), true)
  assert.equal(canResolveAudition("scheduled", "cancelled"), true)
  assert.equal(canResolveAudition("passed", "failed"), false)
  assert.equal(canResolveAudition("scheduled", "scheduled"), false)
})

test("reordenar el programa", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 2), ["b", "c", "a"])
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 1), ["a", "c", "b"])
  assert.deepEqual(moveItem(["a", "b"], 0, 5), ["a", "b"])
})
