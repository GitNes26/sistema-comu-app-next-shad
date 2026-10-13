import test from "node:test"
import assert from "node:assert/strict"
import sharp from "sharp"
import { PDFDocument } from "pdf-lib"
import { renderDiplomaPdf } from "../../src/lib/school/diploma-pdf.ts"

const base = {
  name: "María Fernanda Gómez Ruiz",
  serial: "DIP-2026-0001",
  issuedAt: new Date("2026-10-13T12:00:00Z"),
  organizationName: "Iglesia de prueba",
  schoolName: "Escuela de ministerio",
  eventName: "Lanzamiento",
  director: "Ana Pérez",
  subdirector: null,
  placement: { x: 0.5, y: 0.5, size: 0.06, color: "#1f2937", showSerial: true },
}

test("diploma generado: un PDF carta horizontal de una página", async () => {
  const bytes = await renderDiplomaPdf({ ...base, mode: "generated", template: null })
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-")
  const doc = await PDFDocument.load(bytes)
  assert.equal(doc.getPageCount(), 1)
  assert.deepEqual([doc.getPage(0).getWidth(), doc.getPage(0).getHeight()], [792, 612])
})

test("diploma sobre imagen subida: la página toma la proporción de la imagen", async () => {
  const png = await sharp({ create: { width: 1000, height: 500, channels: 3, background: "#ffffff" } }).png().toBuffer()
  const bytes = await renderDiplomaPdf({ ...base, mode: "uploaded", template: { bytes: png, mime: "image/png" } })
  const doc = await PDFDocument.load(bytes)
  assert.equal(doc.getPageCount(), 1)
  assert.equal(Math.round(doc.getPage(0).getHeight()), 396) // 792 × 500 / 1000
})

test("diploma sobre WEBP: se convierte y se genera", async () => {
  const webp = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#fffdf7" } }).webp().toBuffer()
  const bytes = await renderDiplomaPdf({ ...base, mode: "uploaded", template: { bytes: webp, mime: "image/webp" } })
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1)
})

test("diploma sobre PDF subido: conserva solo la primera página", async () => {
  const src = await PDFDocument.create()
  src.addPage([600, 400])
  src.addPage([600, 400])
  const pdf = await src.save()
  const bytes = await renderDiplomaPdf({ ...base, mode: "uploaded", template: { bytes: pdf, mime: "application/pdf" } })
  const doc = await PDFDocument.load(bytes)
  assert.equal(doc.getPageCount(), 1)
  assert.deepEqual([doc.getPage(0).getWidth(), doc.getPage(0).getHeight()], [600, 400])
})

test("diploma: un nombre muy largo y una posición fuera de rango no rompen el PDF", async () => {
  const png = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#ffffff" } }).png().toBuffer()
  const bytes = await renderDiplomaPdf({
    ...base,
    name: "María de los Ángeles Guadalupe Fernanda Josefina Gómez de la Rosa y Fernández de Córdoba",
    mode: "uploaded",
    template: { bytes: png, mime: "image/png" },
    placement: { x: 4, y: -2, size: 0.12, color: "no-es-color", showSerial: false },
  })
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1)
})
