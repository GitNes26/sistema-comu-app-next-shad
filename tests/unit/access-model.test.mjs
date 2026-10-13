import test from "node:test"
import assert from "node:assert/strict"
import { PERMISSIONS } from "../../src/lib/auth/permission-keys.ts"
import { SYSTEM_ROLES, systemRoleIdForLevel } from "../../src/lib/auth/system-roles.ts"
import { hasPermission, isFullAccessRole, isPortalSession } from "../../src/lib/auth/permissions.ts"
import { planDeniedKeys, isPlanBlockedPath } from "../../src/lib/billing/plan-permissions.ts"
import { homeForRole } from "../../src/lib/auth/redirect.ts"
import { roleAllowedInOrg } from "../../src/lib/settings/system-roles.ts"

const keys = new Set(PERMISSIONS.map((p) => p.key))
const session = (role, permissions = [], planDenied = []) => ({ user: { role, permissions, planDenied } })

test("el catálogo no repite claves y sigue la convención modulo.accion", () => {
  assert.equal(keys.size, PERMISSIONS.length)
  for (const p of PERMISSIONS) assert.equal(p.key, `${p.module}.${p.action}`)
})

test("los roles de sistema solo usan permisos del catálogo", () => {
  for (const role of SYSTEM_ROLES) {
    for (const key of role.permissions) assert.ok(keys.has(key), `${role.id} usa ${key}`)
  }
})

test("organizations.manage es exclusivo del superadmin", () => {
  for (const role of SYSTEM_ROLES) {
    const has = role.permissions.includes("organizations.manage")
    assert.equal(has, role.id === "system-superadmin", role.id)
  }
  assert.equal(hasPermission(session("owner"), "organizations.manage"), false)
  assert.equal(hasPermission(session("admin"), "organizations.manage"), false)
  assert.equal(hasPermission(session("superadmin"), "organizations.manage"), true)
})

test("el creyente no recibe permisos administrativos", () => {
  const believer = SYSTEM_ROLES.find((r) => r.id === "system-believer")
  assert.deepEqual([...believer.permissions], [])
  assert.equal(hasPermission(session("believer"), "members.view"), false)
  assert.equal(isPortalSession(session("believer")), true)
  assert.equal(isPortalSession(session("leader")), false)
})

test("owner/admin pasan siempre, salvo lo que el plan no incluye", () => {
  assert.equal(isFullAccessRole("owner"), true)
  assert.equal(hasPermission(session("owner"), "members.manage"), true)
  assert.equal(hasPermission(session("owner", [], ["members.manage"]), "members.manage"), false)
})

test("permiso del rol ∩ plan para el resto de niveles", () => {
  assert.equal(hasPermission(session("servant", ["members.view"]), "members.view"), true)
  assert.equal(hasPermission(session("servant", ["members.view"]), "members.manage"), false)
  assert.equal(hasPermission(session("servant", ["members.view"], ["members.view"]), "members.view"), false)
})

test("cada nivel tiene un rol de sistema por defecto", () => {
  for (const level of ["superadmin", "owner", "admin", "leader", "servant", "believer"]) {
    const id = systemRoleIdForLevel(level)
    const role = SYSTEM_ROLES.find((r) => r.id === id)
    assert.ok(role, level)
    assert.equal(role.level, level)
  }
})

test("un rol propio solo se asigna dentro de su iglesia", () => {
  assert.equal(roleAllowedInOrg({ isSystem: true, organizationId: null }, "org-a"), true)
  assert.equal(roleAllowedInOrg({ isSystem: false, organizationId: "org-a" }, "org-a"), true)
  assert.equal(roleAllowedInOrg({ isSystem: false, organizationId: "org-b" }, "org-a"), false)
  assert.equal(roleAllowedInOrg({ isSystem: false, organizationId: null }, "org-a"), false)
})

test("planes: sin lista no restringe; con lista deniega lo demás", () => {
  assert.deepEqual(planDeniedKeys(null), [])
  const denied = planDeniedKeys(["members.view"])
  assert.ok(denied.includes("members.manage"))
  assert.ok(!denied.includes("members.view"))
  assert.equal(isPlanBlockedPath("/admin/locations", ["locations.view", "locations.manage"]), true)
  assert.equal(isPlanBlockedPath("/admin/members", ["locations.view", "locations.manage"]), false)
})

test("destino post-login por nivel", () => {
  assert.equal(homeForRole("believer"), "/mi")
  assert.equal(homeForRole("owner"), "/admin")
  assert.equal(homeForRole("leader"), "/admin")
  assert.equal(homeForRole(undefined), "/auth/login")
})
