import test from "node:test"
import assert from "node:assert/strict"
import { isValidSlug, slotRange, slugify, validateCard } from "../../src/lib/connect/rules.ts"

test("dirección pública: se normaliza y rechaza palabras reservadas", () => {
  assert.equal(slugify("Comunidad Torreón"), "comunidad-torreon")
  assert.equal(slugify("  ¡Iglesia   Nueva! "), "iglesia-nueva")
  assert.equal(isValidSlug("comunidad-torreon"), true)
  assert.equal(isValidSlug("ab"), false)
  assert.equal(isValidSlug("-malo-"), false)
  assert.equal(isValidSlug("admin"), false)
  assert.equal(isValidSlug("api"), false)
})

test("tarjeta: nombre y un medio de contacto; teléfono y correo válidos", () => {
  assert.equal(validateCard({ kind: "visitor", name: "Ana" }).ok, false)
  const noPhone = validateCard({ kind: "visitor", name: "Ana", phone: "123" })
  assert.equal(noPhone.ok, false)
  assert.equal(noPhone.field, "phone")
  assert.equal(validateCard({ kind: "visitor", name: "Ana", email: "mal" }).ok, false)
  const ok = validateCard({ kind: "visitor", name: "  Ana   Pérez ", phone: "871 427 4445", email: "ANA@X.COM" })
  assert.equal(ok.ok, true)
  assert.equal(ok.value.name, "Ana Pérez")
  assert.equal(ok.value.email, "ana@x.com")
  assert.equal(ok.value.interest, null)
})

test("tarjeta: grupo siempre trae interés válido; oración puede ser anónima pero lleva texto", () => {
  // El interés es el tipo de hogar de amor (texto libre del catálogo); vacío = cualquiera.
  assert.equal(validateCard({ kind: "group", name: "Ana", phone: "8714274445" }).value.interest, "any")
  assert.equal(validateCard({ kind: "group", name: "Ana", phone: "8714274445", interest: "Matrimonios", cellId: "c1" }).value.interest, "Matrimonios")
  assert.equal(validateCard({ kind: "group", name: "Ana", phone: "8714274445", cellId: "c1" }).value.cellId, "c1")
  assert.equal(validateCard({ kind: "visitor", name: "Ana", phone: "8714274445", cellId: "c1" }).value.cellId, null)
  assert.equal(validateCard({ kind: "prayer", message: "" }).ok, false)
  const anon = validateCard({ kind: "prayer", message: "Por mi salud" })
  assert.equal(anon.ok, true)
  assert.equal(anon.value.name, "Anónimo")
  assert.equal(validateCard({ kind: "otra", name: "Ana", phone: "8714274445" }).ok, false)
})

test("horario: rango de horas", () => {
  assert.equal(slotRange("20:00", "23:00"), "20:00 – 23:00")
  assert.equal(slotRange("10:00", null), "10:00")
})
