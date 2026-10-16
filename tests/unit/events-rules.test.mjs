import test from "node:test"
import assert from "node:assert/strict"
import {
  attendeeMayChoose,
  audienceAllows,
  autoAssignSeat,
  capacityOfLayout,
  computeSeats,
  sanitizeLayout,
  sellableSeats,
  staffMayAssign,
  ticketBalance,
  ticketStatusFor,
} from "../../src/lib/events/rules.ts"

const layout = () =>
  sanitizeLayout({
    sections: [{ id: "s1", name: "Centro", color: "#2563eb" }],
    elements: [
      { id: "b1", type: "block", x: 100, y: 100, rows: 3, cols: 4, prefix: "C", sectionId: "s1" },
      { id: "t1", type: "table", x: 500, y: 300, code: "m1", seats: 6, shape: "round" },
      { id: "st", type: "stage", x: 100, y: 10, w: 300, h: 50 },
    ],
    blocked: ["CA-1", "NOEXISTE-9"],
  })

test("plano: asientos de bloques y mesas con códigos únicos", () => {
  const l = layout()
  const seats = computeSeats(l)
  assert.equal(seats.length, 3 * 4 + 6)
  assert.ok(seats.some((s) => s.code === "CA-1"))
  assert.ok(seats.some((s) => s.code === "CC-4"))
  assert.ok(seats.some((s) => s.code === "M1-6"))
  assert.equal(new Set(seats.map((s) => s.code)).size, seats.length)
})

test("plano: los bloqueados no se venden y los inexistentes se descartan", () => {
  const l = layout()
  assert.deepEqual(l.blocked, ["CA-1"])
  assert.equal(capacityOfLayout(l), 17)
  assert.ok(!sellableSeats(l).some((s) => s.code === "CA-1"))
})

test("plano: rechaza códigos repetidos y exceso de asientos", () => {
  assert.throws(
    () =>
      sanitizeLayout({
        elements: [
          { id: "a", type: "block", x: 0, y: 0, rows: 1, cols: 3, prefix: "X" },
          { id: "b", type: "block", x: 0, y: 100, rows: 1, cols: 3, prefix: "X" },
        ],
      }),
    /se repite/
  )
  assert.throws(
    () =>
      sanitizeLayout({
        elements: Array.from({ length: 70 }, (_, i) => ({ id: `e${i}`, type: "block", x: 0, y: 0, rows: 60, cols: 60, prefix: `P${i}` })),
      }),
    /demasiados asientos/
  )
})

test("pagos: saldo y estado del boleto", () => {
  assert.equal(ticketBalance(500, [200, 100]), 200)
  assert.equal(ticketBalance(500, [600]), 0)
  assert.equal(ticketStatusFor(500, [200]), "reserved")
  assert.equal(ticketStatusFor(500, [500]), "paid")
  assert.equal(ticketStatusFor(0, []), "paid")
})

test("acomodo: quién puede elegir el lugar", () => {
  assert.equal(attendeeMayChoose("seats", "self"), true)
  assert.equal(attendeeMayChoose("seats", "assigned"), false)
  assert.equal(attendeeMayChoose("sections", "self"), false)
  assert.equal(staffMayAssign("seats", "assigned"), true)
  assert.equal(staffMayAssign("seats", "both"), true)
  assert.equal(staffMayAssign("free", "both"), false)
})

test("asignación automática: respeta ocupados y prefiere la sección", () => {
  const seats = sellableSeats(layout())
  const taken = new Set(["CB-1", "CB-2"])
  const s = autoAssignSeat(seats, taken, "s1")
  assert.equal(s?.sectionId, "s1")
  assert.ok(!taken.has(s.code))
  assert.equal(autoAssignSeat(seats, new Set(seats.map((x) => x.code))), null)
})

test("público: abierto, solo líderes o ministerios elegidos", () => {
  const person = { isLeader: false, ministryIds: ["m1"] }
  assert.equal(audienceAllows("open", person, []), true)
  assert.equal(audienceAllows("leaders", person, []), false)
  assert.equal(audienceAllows("leaders", { ...person, isLeader: true }, []), true)
  assert.equal(audienceAllows("ministries", person, ["m1", "m2"]), true)
  assert.equal(audienceAllows("ministries", person, ["m2"]), false)
})

test("parseSeatLabel separa fila, asiento y zona para el boleto", async () => {
  const { parseSeatLabel } = await import("../../src/lib/events/rules.ts")
  assert.deepEqual(parseSeatLabel("Fila C · asiento 5"), { row: "C", seatNo: "5", kind: "fila", area: null })
  assert.deepEqual(parseSeatLabel("Balcón · Fila AA · asiento 12"), { row: "AA", seatNo: "12", kind: "fila", area: "Balcón" })
  assert.deepEqual(parseSeatLabel("Mesa M1 · lugar 3"), { row: "M1", seatNo: "3", kind: "mesa", area: null })
  assert.equal(parseSeatLabel("Sección general"), null)
  assert.equal(parseSeatLabel(null), null)
})
