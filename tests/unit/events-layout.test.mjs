import test from "node:test"
import assert from "node:assert/strict"
import { bestSeats, computeSeats, rowPoints, sanitizeLayout, sellableSeats, zoneStats, stageAnchor } from "../../src/lib/events/rules.ts"
import {
  alignElements,
  buildTemplate,
  cloneElements,
  DEFAULT_TEMPLATE,
  expandGroups,
  genArcSection,
  genBlockFromRect,
  genStraightSection,
  makeRow,
  mirrorElement,
  rotateElement,
  seatsInBox,
} from "../../src/lib/events/layout-tools.ts"

const base = (extra = {}) => ({ sections: [{ id: "s1", name: "VIP", color: "#2563eb" }, { id: "s2", name: "General", color: "#16a34a" }], blocked: [], ...extra })

test("fila libre: asientos equidistantes con numeración desde startNo y reversa", () => {
  const row = makeRow({ x: 0, y: 0, x2: 170, y2: 0, seats: 6, prefix: "P", rowLabel: "A", startNo: 10 })
  const seats = computeSeats({ ...base(), elements: [row] })
  assert.deepEqual(seats.map((s) => s.code), ["PA-10", "PA-11", "PA-12", "PA-13", "PA-14", "PA-15"])
  const gaps = seats.slice(1).map((s, i) => Math.round(s.x - seats[i].x))
  assert.ok(gaps.every((g) => g === 34), `separación ${gaps}`)
  const rev = computeSeats({ ...base(), elements: [{ ...row, reverse: true }] })
  assert.equal(rev[0].code, "PA-15")
  assert.equal(rev[5].code, "PA-10")
})

test("fila curva: los asientos siguen la curva y sus extremos coinciden con los puntos", () => {
  const row = makeRow({ x: 0, y: 100, x2: 300, y2: 100, bend: 60, seats: 9, prefix: "", rowLabel: "A" })
  const pts = rowPoints(row)
  assert.equal(pts.length, 9)
  assert.ok(Math.abs(pts[0].x - 0) < 1 && Math.abs(pts[8].x - 300) < 1)
  // bend positivo = hacia la derecha de quien avanza (en pantalla, hacia abajo)
  const mid = pts[4]
  assert.ok(mid.y > 100 + 40, `punto medio y=${mid.y}`)
})

test("sección en arco: filas concéntricas a su radio y sin códigos repetidos (anillo completo)", () => {
  const g = genArcSection({ cx: 500, cy: 400, innerRadius: 150, rows: 3, startAngle: -90, endAngle: 270, growth: 0, prefix: "R", groupName: "Anillo", rowStyle: "letters" })
  const layout = sanitizeLayout({ ...base(), elements: g.elements, groups: g.groups }, 1000, 800)
  const seats = computeSeats(layout)
  assert.equal(new Set(seats.map((s) => s.code)).size, seats.length)
  assert.ok(g.elements.length >= 12) // 3 filas × 4 tramos de 90°
  const radii = seats.filter((s) => s.rowName === "A").map((s) => Math.hypot(s.x - 500, s.y - 400))
  assert.ok(radii.every((r) => Math.abs(r - 150) < 8), `radios ${radii.map(Math.round)}`)
  // la numeración continúa entre tramos de la misma fila
  const nums = seats.filter((s) => s.rowName === "A").map((s) => s.seatNo).sort((a, b) => a - b)
  assert.deepEqual(nums, nums.map((_, i) => i + 1))
})

test("sección recta con crecimiento por fila y números en orden", () => {
  const g = genStraightSection({ x: 100, y: 100, rows: 4, seatsPerRow: 6, growth: 2, bend: 0, prefix: "A", groupName: "Platea", rowStyle: "letters", frontFirst: true })
  assert.deepEqual(g.elements.map((e) => e.seats), [6, 8, 10, 12])
  assert.deepEqual(g.elements.map((e) => e.rowLabel), ["A", "B", "C", "D"])
  assert.ok(g.elements.every((e) => e.groupId === g.groups[0].id))
})

test("recuadro: crea filas y asientos según el tamaño", () => {
  const g = genBlockFromRect({ x: 0, y: 0, w: 340, h: 114 }, { prefix: "X", groupName: "Bloque" })
  assert.equal(g.elements.length, 4)
  assert.equal(g.elements[0].seats, 11)
})

test("sanitize: filas, grupos, zonas por asiento y plano de fondo", () => {
  const row = makeRow({ x: 10, y: 10, x2: 110, y2: 10, seats: 4, prefix: "P", rowLabel: "A", sectionId: "s1", groupId: "g1" })
  const layout = sanitizeLayout(
    {
      ...base(),
      groups: [{ id: "g1", name: "Platea" }],
      elements: [row, { ...makeRow({ x: 10, y: 60, x2: 110, y2: 60, seats: 4, prefix: "P", rowLabel: "B", sectionId: "s1" }), groupId: "no-existe" }],
      zoneOf: { "PA-1": "s2", "PA-99": "s2", "PB-1": "zz" },
      background: { url: "https://x.test/plano.png", x: 0, y: 0, w: 500, h: 300, opacity: 40 },
    },
    1000,
    600
  )
  assert.equal(layout.groups.length, 1)
  assert.equal(layout.elements[1].groupId, undefined)
  assert.deepEqual(layout.zoneOf, { "PA-1": "s2" })
  assert.equal(layout.background.opacity, 40)
  const seats = computeSeats(layout)
  assert.equal(seats.find((s) => s.code === "PA-1").sectionId, "s2")
  assert.equal(seats.find((s) => s.code === "PA-2").sectionId, "s1")
  // fondo con protocolo no permitido se descarta
  const bad = sanitizeLayout({ ...base(), elements: [], background: { url: "javascript:alert(1)", w: 10, h: 10 } })
  assert.equal(bad.background, undefined)
})

test("sanitize: dos filas con el mismo código fallan con mensaje claro", () => {
  const a = makeRow({ x: 0, y: 0, x2: 100, y2: 0, seats: 3, prefix: "P", rowLabel: "A" })
  const b = makeRow({ x: 0, y: 50, x2: 100, y2: 50, seats: 3, prefix: "P", rowLabel: "A" })
  assert.throws(() => sanitizeLayout({ ...base(), elements: [a, b] }), /se repite/)
})

test("copiar, espejo y repetir: ids nuevos, códigos únicos y grupos copiados", () => {
  const g = genStraightSection({ x: 100, y: 100, rows: 2, seatsPerRow: 5, growth: 0, bend: 0, prefix: "A", groupName: "Izq", rowStyle: "letters", frontFirst: true })
  const layout = { ...base(), elements: g.elements, groups: g.groups }
  const clone = cloneElements(g.elements, layout, { dx: 0, dy: 0, transform: (el) => mirrorElement(el, "x", 500) })
  const merged = sanitizeLayout({ ...layout, elements: [...layout.elements, ...clone.elements], groups: [...layout.groups, ...clone.groups] }, 1000, 600)
  assert.equal(merged.elements.length, 4)
  const seats = computeSeats(merged)
  assert.equal(new Set(seats.map((s) => s.code)).size, 20)
  assert.equal(merged.groups.length, 2)
  // el espejo queda del otro lado del eje (x=500) y conserva la separación entre asientos
  const copied = seats.filter((s) => clone.elements.some((e) => e.id === s.elementId))
  assert.ok(copied.every((s) => s.x > 500 - 1))
})

test("girar 90° una fila alrededor de su centro", () => {
  const row = makeRow({ x: 0, y: 0, x2: 100, y2: 0, seats: 3, prefix: "", rowLabel: "A" })
  const r = rotateElement(row, 90, 50, 0)
  assert.deepEqual([r.x, r.y, r.x2, r.y2], [50, -50, 50, 50])
})

test("alinear a la izquierda", () => {
  const a = makeRow({ x: 100, y: 0, x2: 200, y2: 0, seats: 3, prefix: "A", rowLabel: "A" })
  const b = makeRow({ x: 300, y: 50, x2: 400, y2: 50, seats: 3, prefix: "B", rowLabel: "A" })
  const out = alignElements([a, b], "left", [a, b])
  assert.equal(out[1].x, out[0].x)
})

test("expandir grupos: tocar una fila selecciona su sección completa", () => {
  const g = genStraightSection({ x: 0, y: 0, rows: 3, seatsPerRow: 4, growth: 0, bend: 0, prefix: "A", groupName: "S", rowStyle: "letters", frontFirst: true })
  const solo = makeRow({ x: 0, y: 500, x2: 100, y2: 500, seats: 3, prefix: "Z", rowLabel: "A" })
  const all = [...g.elements, solo]
  assert.equal(expandGroups([g.elements[0].id], all).length, 3)
  assert.equal(expandGroups([solo.id], all).length, 1)
})

test("plantillas: cada tipo produce un plano válido, con zonas y sin códigos repetidos", () => {
  for (const kind of ["theater", "horseshoe", "arena", "banquet"]) {
    const t = buildTemplate({ ...DEFAULT_TEMPLATE, kind, levels: 3 }, 1000, 600)
    const layout = sanitizeLayout(t.layout, t.planWidth, t.planHeight)
    const seats = sellableSeats(layout)
    assert.ok(seats.length > 20, `${kind}: ${seats.length}`)
    assert.ok(layout.sections.length === 3, kind)
    assert.ok(seats.every((s) => s.sectionId), `${kind}: asientos sin zona`)
    assert.equal(new Set(seats.map((s) => s.code)).size, seats.length, kind)
  }
})

test("zonas: total, libres y cuadro por zona", () => {
  const a = makeRow({ x: 0, y: 0, x2: 102, y2: 0, seats: 4, prefix: "A", rowLabel: "A", sectionId: "s1" })
  const b = makeRow({ x: 0, y: 100, x2: 102, y2: 100, seats: 4, prefix: "B", rowLabel: "A", sectionId: "s2" })
  const layout = sanitizeLayout({ ...base(), elements: [a, b] })
  const stats = zoneStats(layout, new Set(["AA-1", "AA-2"]))
  assert.deepEqual(stats.map((z) => [z.id, z.total, z.free]), [["s1", 4, 2], ["s2", 4, 4]])
  assert.deepEqual(stats[0].box, { x: 0, y: 0, w: 102, h: 0 })
})

test("mejores lugares: tira contigua más cerca del escenario; sin tira, los más cercanos", () => {
  const front = makeRow({ x: 200, y: 100, x2: 438, y2: 100, seats: 8, prefix: "A", rowLabel: "A" })
  const back = makeRow({ x: 200, y: 200, x2: 438, y2: 200, seats: 8, prefix: "B", rowLabel: "A" })
  const layout = sanitizeLayout({ ...base(), elements: [front, back, { id: "st", type: "stage", x: 250, y: 10, w: 140, h: 40 }] })
  const seats = sellableSeats(layout)
  const anchor = stageAnchor(layout, 700)
  const two = bestSeats(seats, new Set(), { count: 2, anchor })
  assert.equal(two.length, 2)
  assert.ok(two.every((s) => s.rowKey === "A:A"))
  assert.equal(two[1].seatNo - two[0].seatNo, 1)
  // la fila de adelante ocupada salvo asientos sueltos (1,3,5,7): para 2 juntos usa la de atrás
  const taken = new Set(["AA-2", "AA-4", "AA-6", "AA-8"])
  const pair = bestSeats(seats, taken, { count: 2, anchor })
  assert.ok(pair.every((s) => s.rowKey === "B:A"))
  // para 9 no hay tira posible: devuelve los 9 más cercanos
  assert.equal(bestSeats(seats, new Set(), { count: 9, anchor }).length, 9)
  // filtro por zona
  assert.equal(bestSeats(seats, new Set(), { count: 1, anchor, sectionId: "nada" }).length, 0)
})

test("asientos dentro de un recuadro", () => {
  const row = makeRow({ x: 0, y: 0, x2: 170, y2: 0, seats: 6, prefix: "A", rowLabel: "A" })
  const seats = computeSeats({ ...base(), elements: [row] })
  assert.equal(seatsInBox(seats, { minX: -5, minY: -5, maxX: 70, maxY: 5 }).length, 3)
})

test("código corto de puerta: alfabeto sin confusiones, normaliza lo que se escribe", async () => {
  const { newShortCode, normalizeShortCode, SHORT_CODE_ALPHABET } = await import("../../src/lib/events/rules.ts")
  for (let i = 0; i < 200; i++) {
    const c = newShortCode()
    assert.equal(c.length, 6)
    assert.ok([...c].every((ch) => SHORT_CODE_ALPHABET.includes(ch)))
  }
  assert.ok(!/[01OI]/.test(SHORT_CODE_ALPHABET))
  assert.equal(normalizeShortCode(" k7m-2qx "), "K7M2QX")
  assert.equal(normalizeShortCode("K7M2Q"), null)
  assert.equal(normalizeShortCode(null), null)
})
