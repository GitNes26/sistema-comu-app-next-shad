import test from "node:test"
import assert from "node:assert/strict"
import { contrastRatio, defaultFlyer, excerpt, normalizeFlyer } from "../../src/lib/portal/flyer.ts"
import { matchesAllWords, matchesSearch, normalizeSearch } from "../../src/lib/search.ts"

test("flyer: sin datos válidos no hay flyer", () => {
  assert.equal(normalizeFlyer(null), null)
  assert.equal(normalizeFlyer("x"), null)
  assert.equal(normalizeFlyer({ mode: "otro" }), null)
  assert.equal(normalizeFlyer({ mode: "upload", url: "javascript:alert(1)" }), null)
  assert.deepEqual(normalizeFlyer({ mode: "upload", url: "https://x.test/f.png" }), { mode: "upload", url: "https://x.test/f.png" })
  assert.deepEqual(normalizeFlyer({ mode: "upload", url: "/api/media/o/f.png" }), { mode: "upload", url: "/api/media/o/f.png" })
})

test("flyer: la plantilla sigue al tipo y se descartan colores, fuentes y enlaces inválidos", () => {
  const f = normalizeFlyer({ mode: "template", template: "devotional", bg: "red", fg: "#FFAA00", accent: "nope", font: "comic", imageUrl: "http://inseguro", subtitle: "  Hola  ", footer: "" }, "news")
  const base = defaultFlyer("devotional")
  assert.equal(f.template, "devotional")
  assert.equal(f.bg, base.bg)
  assert.equal(f.fg, "#ffaa00")
  assert.equal(f.accent, base.accent)
  assert.equal(f.font, base.font)
  assert.equal(f.imageUrl, null)
  assert.equal(f.subtitle, "Hola")
  assert.equal(f.footer, null)
  assert.equal(normalizeFlyer({ mode: "template", template: "desconocido" }, "news").template, "news")
})

test("flyer: extracto sin enlaces y contraste", () => {
  assert.equal(excerpt("Mira https://x.test/a   esto  hoy"), "Mira esto hoy")
  assert.ok(excerpt("a".repeat(300)).length <= 140)
  assert.ok(contrastRatio("#000000", "#ffffff") > 20)
  assert.ok(contrastRatio("#777777", "#7a7a7a") < 1.2)
})

test("búsqueda: ignora mayúsculas, acentos y espacios", () => {
  assert.equal(normalizeSearch("  JOSÉ   Peña "), "jose pena")
  assert.equal(matchesSearch("José Luis Muñoz", "jose"), true)
  assert.equal(matchesSearch("José Luis Muñoz", "MUNOZ"), true)
  assert.equal(matchesSearch("Alabanza", ""), true)
  assert.equal(matchesSearch("Alabanza", "adoración"), false)
  assert.equal(matchesAllWords("Ministerio de Alabanza y Adoración", "adoracion alabanza"), true)
  assert.equal(matchesAllWords("Ministerio de Alabanza", "alabanza kids"), false)
})
