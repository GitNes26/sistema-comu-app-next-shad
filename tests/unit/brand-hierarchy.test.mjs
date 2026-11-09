import test from "node:test"
import assert from "node:assert/strict"
import { brandImageFor } from "../../src/lib/brand/ministry-images.ts"
import { DEFAULT_HIERARCHY, HIERARCHY_LEVELS, duplicateHierarchyLabel, resolveHierarchy, sanitizeHierarchy } from "../../src/lib/org/hierarchy.ts"
import { devAccounts, DEV_ACCOUNT_EMAILS } from "../../src/lib/auth/dev-accounts.ts"
import { SYSTEM_ROLES } from "../../src/lib/auth/system-roles.ts"
import { existsSync } from "node:fs"

test("imágenes de marca: por nombre, sin importar mayúsculas ni acentos, y todas existen en public/images", () => {
  assert.equal(brandImageFor("Comunidad Kids")?.forLight, "/images/comunidad_kids.png")
  assert.equal(brandImageFor("COMUNIDAD BABIES")?.forLight, "/images/comunidad_babies.png")
  assert.equal(brandImageFor("Encuentro con Jesús")?.forLight, "/images/encuentro_con_jesus.png")
  assert.equal(brandImageFor("Lanzamiento")?.forDark, "/images/lanzamiento.png")
  assert.equal(brandImageFor("Escuela de Ministerio")?.forLight, "/images/escuela_de_ministerio.png")
  assert.equal(brandImageFor("Intercesión")?.forLight, "/images/intercesion.png")
  assert.equal(brandImageFor("Mesa de Amor")?.forLight, "/images/mesa_de_amor.png")
  assert.equal(brandImageFor("Talleres")?.forLight, "/images/talleres.png")
  assert.equal(brandImageFor("Audio"), null)
  assert.equal(brandImageFor(null, undefined, "Alabanza"), null)
  assert.equal(brandImageFor("Audio", "kids")?.forLight, "/images/comunidad_kids.png")
  for (const n of ["Comunidad Kids", "Comunidad Babies", "Encuentro con Jesús", "Lanzamiento", "Escuela de ministerio", "Intercesión", "Mesa de amor", "Primicias", "Talleres"]) {
    const img = brandImageFor(n)
    assert.ok(img, n)
    for (const src of [img.forLight, img.forDark]) assert.ok(existsSync(`public${src}`), `falta ${src}`)
  }
})

test("imágenes con pareja: la oscura (_dark) va en tema claro y la clara en tema oscuro", () => {
  const p = brandImageFor("Primicias")
  assert.equal(p.paired, true)
  assert.equal(p.forLight, "/images/primicias_dark.png")
  assert.equal(p.forDark, "/images/primicias.png")
})

test("jerarquía editable: solo se guardan los cambios, se resuelven valores por defecto y no se oculta Creyente", () => {
  const stored = sanitizeHierarchy({
    senior_pastor: { label: "  Pastor   presidente ", description: DEFAULT_HIERARCHY.senior_pastor.description },
    servant: { label: "Servidor" },
    leader: { isActive: false },
    believer: { isActive: false },
    inventado: { label: "x" },
  })
  assert.deepEqual(Object.keys(stored).sort(), ["leader", "senior_pastor"])
  assert.equal(stored.senior_pastor.label, "Pastor presidente")
  const full = resolveHierarchy(stored)
  assert.equal(full.length, HIERARCHY_LEVELS.length)
  assert.equal(full.find((e) => e.level === "senior_pastor").label, "Pastor presidente")
  assert.equal(full.find((e) => e.level === "pastor").label, "Pastor")
  assert.equal(full.find((e) => e.level === "leader").isActive, false)
  assert.equal(full.find((e) => e.level === "believer").isActive, true)
  assert.equal(duplicateHierarchyLabel(full), null)
  assert.equal(duplicateHierarchyLabel(resolveHierarchy({ leader: { label: "pastór" }, pastor: { label: "Pastor" } })), "Pastor")
})

test("accesos de desarrollo: un botón por rol de sistema (salvo superadmin)", () => {
  const accounts = devAccounts()
  assert.equal(accounts.length, SYSTEM_ROLES.filter((r) => r.id !== "system-superadmin").length)
  assert.ok(accounts.every((a) => a.email.endsWith("@comuapp.test")))
  assert.equal(new Set(Object.values(DEV_ACCOUNT_EMAILS)).size, Object.keys(DEV_ACCOUNT_EMAILS).length)
})
