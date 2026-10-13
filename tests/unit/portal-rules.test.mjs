import test from "node:test"
import assert from "node:assert/strict"
import { isPostKind, parseStreamUrl, weeklySlotLabel } from "../../src/lib/portal/rules.ts"

test("transmisión: reconoce los formatos de enlace de YouTube", () => {
  const id = "dQw4w9WgXcQ"
  for (const url of [
    "https://www.youtube.com/watch?v=" + id,
    "https://youtu.be/" + id + "?t=10",
    "https://www.youtube.com/live/" + id + "?feature=share",
    "https://m.youtube.com/watch?v=" + id + "&list=abc",
    "https://www.youtube.com/embed/" + id,
  ]) {
    const r = parseStreamUrl(url)
    assert.ok(r, url)
    assert.equal(r.platform, "youtube")
    assert.equal(r.url, "https://www.youtube.com/watch?v=" + id)
    assert.equal(r.embedUrl, "https://www.youtube-nocookie.com/embed/" + id)
  }
})

test("transmisión: directo permanente de un canal de YouTube", () => {
  const ch = "UC" + "a".repeat(22)
  const r = parseStreamUrl("https://www.youtube.com/channel/" + ch + "/live")
  assert.equal(r?.embedUrl, "https://www.youtube-nocookie.com/embed/live_stream?channel=" + ch)
})

test("transmisión: Facebook solo con videos y se codifica el enlace", () => {
  const r = parseStreamUrl("https://www.facebook.com/miiglesia/videos/123456789/")
  assert.equal(r?.platform, "facebook")
  assert.ok(r.embedUrl.startsWith("https://www.facebook.com/plugins/video.php?href="))
  assert.ok(r.embedUrl.includes(encodeURIComponent("https://www.facebook.com/miiglesia/videos/123456789/")))
  assert.equal(parseStreamUrl("https://www.facebook.com/miiglesia"), null) // página, no video
})

test("transmisión: rechaza http, otros sitios y valores raros", () => {
  assert.equal(parseStreamUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null)
  assert.equal(parseStreamUrl("https://evil.example/watch?v=dQw4w9WgXcQ"), null)
  assert.equal(parseStreamUrl("https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ"), null)
  assert.equal(parseStreamUrl("https://www.youtube.com/watch?v=corto"), null)
  assert.equal(parseStreamUrl("javascript:alert(1)"), null)
  assert.equal(parseStreamUrl(""), null)
})

test("publicaciones: tipos válidos y etiqueta semanal", () => {
  assert.equal(isPostKind("devotional"), true)
  assert.equal(isPostKind("otro"), false)
  assert.equal(weeklySlotLabel(3, "19:30"), "Miércoles · 19:30")
  assert.equal(weeklySlotLabel(0, "10:00"), "Domingo · 10:00")
})
