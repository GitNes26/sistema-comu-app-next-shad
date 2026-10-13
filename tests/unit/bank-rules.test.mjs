import test from "node:test"
import assert from "node:assert/strict"
import { autoMatches, candidatesFor, dedupeKeys, parseAmount, parseBankCsv, parseBankDate } from "../../src/lib/finance/bank-rules.ts"

test("fechas del banco: formatos comunes, día primero, e inválidas", () => {
  assert.equal(parseBankDate("2026-10-05"), "2026-10-05")
  assert.equal(parseBankDate("05/10/2026"), "2026-10-05")
  assert.equal(parseBankDate("5-10-26"), "2026-10-05")
  assert.equal(parseBankDate("05 oct 2026"), "2026-10-05")
  assert.equal(parseBankDate("5 Oct. 2026"), "2026-10-05")
  assert.equal(parseBankDate("31/02/2026"), null)
  assert.equal(parseBankDate("hola"), null)
})

test("importes: símbolos, miles, paréntesis, signo al final y formato europeo", () => {
  assert.equal(parseAmount("$1,234.56"), 1234.56)
  assert.equal(parseAmount("(500.00)"), -500)
  assert.equal(parseAmount("-250"), -250)
  assert.equal(parseAmount("250.00-"), -250)
  assert.equal(parseAmount("1.234,56"), 1234.56)
  assert.equal(parseAmount("  "), null)
  assert.equal(parseAmount("-"), null)
  assert.equal(parseAmount("abc"), null)
})

test("CSV con columnas separadas de cargo y abono", () => {
  const csv = [
    "Fecha,Descripción,Cargo,Abono,Saldo",
    '05/10/2026,"SPEI recibido, diezmo",,"1,500.00","10,000.00"',
    "06/10/2026,Pago de luz CFE,820.50,,9179.50",
    "TOTAL,,820.50,1500.00,",
  ].join("\n")
  const r = parseBankCsv(csv)
  assert.equal(r.lines.length, 2)
  assert.deepEqual(r.lines[0], { date: "2026-10-05", description: "SPEI recibido, diezmo", reference: null, amount: 1500, balance: 10000 })
  assert.equal(r.lines[1].amount, -820.5)
  assert.equal(r.columns.credit, "Abono")
})

test("CSV con importe con signo, punto y coma y datos de cuenta antes del encabezado", () => {
  const csv = ["Cuenta;1234567890", "Titular;Iglesia", "Fecha;Concepto;Importe;Referencia", "2026-10-07;Ofrenda domingo;2000;REF77", "2026-10-08;Papelería;-310.40;"].join("\r\n")
  const r = parseBankCsv(csv)
  assert.equal(r.delimiter, ";")
  assert.equal(r.lines.length, 2)
  assert.equal(r.lines[0].reference, "REF77")
  assert.equal(r.lines[1].amount, -310.4)
})

test("CSV sin columnas reconocibles y filas dañadas", () => {
  const bad = parseBankCsv("a,b,c\n1,2,3")
  assert.equal(bad.lines.length, 0)
  assert.ok(bad.errors.length > 0)
  const mixed = parseBankCsv("Fecha,Concepto,Importe\n05/10/2026,Bien,100\nnofecha,Mal,200\n06/10/2026,SinImporte,")
  assert.equal(mixed.lines.length, 1)
  assert.equal(mixed.errors.length, 2)
})

test("claves de duplicado: estables y distinguen movimientos idénticos", () => {
  const l = { date: "2026-10-05", description: "Depósito", reference: null, amount: 500, balance: null }
  const a = dedupeKeys([l, l])
  assert.notEqual(a[0], a[1]) // dos depósitos iguales el mismo día
  assert.deepEqual(dedupeKeys([l, l]), a) // estable al reimportar
})

test("sugerencias: mismo sentido, importe exacto, fecha cercana y referencia", () => {
  const movs = [
    { id: "i1", kind: "income", amount: 1500, date: "2026-10-04", text: "Diezmo domingo", reference: null },
    { id: "i2", kind: "income", amount: 1500, date: "2026-10-30", text: "Otro", reference: null },
    { id: "e1", kind: "expense", amount: 1500, date: "2026-10-05", text: "Renta", reference: null },
    { id: "i3", kind: "income", amount: 1500.01, date: "2026-10-05", text: "Casi", reference: null },
  ]
  const c = candidatesFor({ date: "2026-10-05", amount: 1500, description: "SPEI diezmo", reference: null }, movs)
  assert.deepEqual(c.map((x) => x.id), ["i1"])
  assert.equal(c[0].daysApart, 1)
  const withRef = candidatesFor({ date: "2026-10-05", amount: -1500, description: "Pago", reference: "RENTA-10" }, [{ id: "e2", kind: "expense", amount: 1500, date: "2026-10-05", text: "x", reference: "renta-10" }])
  assert.ok(withRef[0].score >= 90)
})

test("conciliación automática: solo con un candidato claro y sin disputas", () => {
  const movs = [
    { id: "i1", kind: "income", amount: 100, date: "2026-10-05", text: "A", reference: null },
    { id: "i2", kind: "income", amount: 200, date: "2026-10-05", text: "B", reference: null },
    { id: "i3", kind: "income", amount: 200, date: "2026-10-06", text: "C", reference: null },
  ]
  const lines = [
    { id: "l1", date: "2026-10-05", amount: 100, description: "", reference: null },
    { id: "l2", date: "2026-10-05", amount: 200, description: "", reference: null }, // dos candidatos: ambiguo
    { id: "l3", date: "2026-10-05", amount: 100, description: "", reference: null }, // disputa i1 con l1
  ]
  assert.deepEqual(autoMatches(lines, movs), [])
  const one = autoMatches([lines[0]], movs)
  assert.deepEqual(one.map((m) => [m.lineId, m.movement.id]), [["l1", "i1"]])
})
