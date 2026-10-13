import test from "node:test"
import assert from "node:assert/strict"
import { sanitizeRects, visiblePagesFor } from "../../src/lib/school/document-rules.ts"
import { encounterStageForEventKind } from "../../src/lib/school/growth-rules.ts"
import { paginateHtml, sanitizeDocxHtml } from "../../src/lib/school/document-rules.ts"

test("libro digital: sin secciones todo el documento es visible", () => {
  assert.deepEqual(visiblePagesFor([], 1, 4), [1, 2, 3, 4])
})

test("libro digital: las páginas se abren con la clase de su semana", () => {
  const ranges = [
    { week: 1, fromPage: 1, toPage: 3 },
    { week: 2, fromPage: 4, toPage: 6 },
    { week: 3, fromPage: 7, toPage: 20 },
  ]
  assert.deepEqual(visiblePagesFor(ranges, 1, 8), [1, 2, 3])
  assert.deepEqual(visiblePagesFor(ranges, 2, 8), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(visiblePagesFor(ranges, 3, 8), [1, 2, 3, 4, 5, 6, 7, 8]) // acotado al total
  assert.deepEqual(visiblePagesFor(ranges, 0, 8), [])
})

test("apuntes: los rectángulos se normalizan y acotan", () => {
  const r = sanitizeRects([{ x: 0.1, y: 0.2, w: 0.5, h: 0.05 }, { x: -1, y: 2, w: 3, h: 0 }, { x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, "x"])
  assert.equal(r.length, 2)
  assert.equal(r[1].x + r[1].w <= 1, true)
  assert.deepEqual(sanitizeRects("no"), [])
})

test("crecimiento: el Encuentro y el Lanzamiento llevan a su etapa", () => {
  assert.equal(encounterStageForEventKind("Lanzamiento"), "launch")
  assert.equal(encounterStageForEventKind("lanzamiento de octubre"), "launch")
  assert.equal(encounterStageForEventKind("Encuentro con Jesús"), "encounter")
  assert.equal(encounterStageForEventKind("Taller"), null)
})

test("Word: el HTML se limpia y se divide en páginas", () => {
  const dirty = '<h1 onclick="x()">Título</h1><p>Hola <a href="javascript:alert(1)">mal</a> <a href="https://a.com">bien</a></p><script>alert(1)</script>'
  const clean = sanitizeDocxHtml(dirty)
  assert.ok(!clean.includes("script"))
  assert.ok(!clean.includes("onclick"))
  assert.ok(!clean.includes("javascript:"))
  assert.ok(clean.includes("https://a.com"))
  const long = Array.from({ length: 60 }, (_, i) => `<p>${"palabra ".repeat(60)}${i}</p>`).join("")
  assert.ok(paginateHtml(long, 3500).length > 3)
  assert.equal(paginateHtml("<p>corto</p>").length, 1)
})
