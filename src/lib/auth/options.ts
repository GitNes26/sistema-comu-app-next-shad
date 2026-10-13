import type { NextAuthOptions } from "next-auth"
import type { $Enums } from "@/generated/prisma/client"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/db"
import { verifyPassword, normalizeIdentifier } from "@/lib/auth/users"
import { permissionsForRole } from "@/lib/auth/server-permissions"
import { planDeniedPermissions } from "@/lib/billing/subscriptions"
import type { AppRole } from "@/lib/auth/permissions"
import type { PermissionKey } from "@/lib/auth/permission-keys"

// NextAuth v4 con Credentials (JWT).
// Identificador de acceso: correo | código de creyente | teléfono.
// scope: "superadmin" (plataforma), "app" (panel administrativo) o "portal"
// (creyente: solo su espacio personal «Mi espacio»).

export type AuthScope = "superadmin" | "app" | "portal"

export type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
  role: AppRole
  /** Nombre legible del rol resuelto (Role.name de la membresía, p. ej. «Tesorero»). */
  roleName: string | null
  organizationId: string | null
  /** Iglesia en la que el usuario está operando (superadmin / multi-iglesia). */
  activeOrganizationId: string | null
  /** Nombre de la iglesia activa (contexto visual en encabezados). */
  organizationName: string | null
  permissions: PermissionKey[]
  /** Permisos que el plan de la iglesia activa no incluye (aplican a todos, propietario incluido). */
  planDenied: PermissionKey[]
  scope: AuthScope
}

declare module "next-auth" {
  interface Session {
    user: SessionUser
  }
  interface User {
    role?: AppRole
    roleName?: string | null
    organizationId?: string | null
    activeOrganizationId?: string | null
    organizationName?: string | null
    permissions?: PermissionKey[]
    planDenied?: PermissionKey[]
    scope?: AuthScope
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role?: AppRole
    roleName?: string | null
    organizationId?: string | null
    activeOrganizationId?: string | null
    organizationName?: string | null
    permissions?: PermissionKey[]
    planDenied?: PermissionKey[]
    scope?: AuthScope
    /** Sesión invalidada por re-validación en BD (usuario desactivado/eliminado). */
    invalid?: boolean
    authCheckedAt?: number
    authVersion?: number
  }
}

type ResolvedLoginUser = {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  passwordHash: string
  isActive: boolean
  isSuperadmin: boolean
  authVersion: number
  activationRequired: boolean
  /** Última iglesia activa recordada (para retomarla al volver a entrar). */
  lastOrganizationId: string | null
  memberships: {
    organizationId: string
    role: $Enums.OrgRole
    roleId: string | null
  }[]
}

const loginUserSelect = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  passwordHash: true,
  isActive: true,
  isSuperadmin: true,
  authVersion: true,
  activationRequired: true,
  lastOrganizationId: true,
  memberships: { select: { organizationId: true, role: true, roleId: true } },
} as const

/** Solo dígitos; los últimos 10 identifican el número (sin lada de país). */
const phoneKey = (value: string) => value.replace(/\D/g, "").slice(-10)

/**
 * Busca al usuario por el identificador del login, en este orden:
 * correo → código de creyente → teléfono (usuario o creyente). Si un teléfono
 * corresponde a varias cuentas, la contraseña decide cuál es; sin contraseña
 * (o si ninguna coincide) no se resuelve.
 */
export async function resolveLoginUser(
  identifier: string,
  password?: string
): Promise<ResolvedLoginUser | null> {
  const value = normalizeIdentifier(identifier)
  const active = (u: ResolvedLoginUser | null | undefined) => (u?.isActive ? u : null)

  if (value.includes("@")) {
    return active(await prisma.user.findUnique({ where: { email: value }, select: loginUserSelect }))
  }

  const byCode = await prisma.member.findFirst({
    where: { memberCode: value, isActive: true, userId: { not: null } },
    select: { user: { select: loginUserSelect } },
  })
  if (byCode?.user) return active(byCode.user)

  const key = phoneKey(value)
  if (key.length < 10) return null
  // Los teléfonos se guardan con formato libre («871 000 0000»): se filtran
  // candidatos por los últimos 4 dígitos y se comparan normalizados.
  const tail = key.slice(-4)
  const [users, members] = await Promise.all([
    prisma.user.findMany({ where: { phone: { contains: tail } }, select: { ...loginUserSelect, phone: true }, take: 50 }),
    prisma.member.findMany({
      where: { phone: { contains: tail }, isActive: true, userId: { not: null } },
      select: { phone: true, user: { select: loginUserSelect } },
      take: 50,
    }),
  ])
  const candidates = new Map<string, ResolvedLoginUser>()
  for (const u of users) if (u.phone && phoneKey(u.phone) === key && u.isActive) candidates.set(u.id, u)
  for (const m of members) {
    if (m.phone && m.user && phoneKey(m.phone) === key && m.user.isActive) candidates.set(m.user.id, m.user)
  }

  const list = [...candidates.values()]
  if (list.length <= 1) return list[0] ?? null
  if (!password) return null
  const matches: ResolvedLoginUser[] = []
  for (const u of list) if (await verifyPassword(password, u.passwordHash)) matches.push(u)
  return matches.length === 1 ? matches[0] : null
}

function scopeForRole(role: AppRole): AuthScope {
  if (role === "superadmin") return "superadmin"
  return role === "believer" ? "portal" : "app"
}

function inferKindFromUser(user: ResolvedLoginUser) {
  // Superadmin por bandera, no por ausencia de membresía.
  if (user.isSuperadmin) {
    return {
      scope: "superadmin" as AuthScope,
      role: "superadmin" as AppRole,
      organizationId: null as string | null,
      roleId: null as string | null,
    }
  }
  // Preferir la última iglesia recordada; si no, la primera membresía.
  const membership =
    user.memberships.find((m) => m.organizationId === user.lastOrganizationId) ??
    user.memberships[0]
  if (!membership) {
    // Sin membresías: cuenta sin acceso a ninguna iglesia.
    return { scope: "portal" as AuthScope, role: "believer" as AppRole, organizationId: null as string | null, roleId: null as string | null }
  }
  return {
    scope: scopeForRole(membership.role),
    role: membership.role,
    organizationId: membership.organizationId as string | null,
    roleId: membership.roleId,
  }
}

/** Nombre legible del rol (fila de `roles`) o null si no hay roleId. */
async function resolveRoleName(roleId: string | null): Promise<string | null> {
  if (!roleId) return null
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } })
  return role?.name ?? null
}

// Nombres de cookie propios: en desarrollo varias apps comparten «localhost» (las
// cookies no distinguen puertos) y la sesión de otra app impediría iniciar sesión.
const secureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://")
const cookiePrefix = secureCookies ? "__Secure-" : ""
const cookieBase = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: secureCookies }

export const authOptions: NextAuthOptions = {
  cookies: {
    sessionToken: { name: `${cookiePrefix}comu-app.session-token`, options: cookieBase },
    callbackUrl: { name: `${cookiePrefix}comu-app.callback-url`, options: { ...cookieBase, httpOnly: false } },
    csrfToken: { name: `${secureCookies ? "__Host-" : ""}comu-app.csrf-token`, options: cookieBase },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Correo, teléfono o código", type: "text" },
        password: { label: "Contraseña", type: "password" },
        // Elección opcional de la iglesia en el login (multi-iglesia).
        organizationId: { label: "Iglesia", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null

        const user = await resolveLoginUser(credentials.identifier, credentials.password)
        if (!user) return null
        if (user.activationRequired) {
          throw new Error("Activa tu cuenta desde el correo de bienvenida o solicita un enlace nuevo en Olvidé mi contraseña.")
        }

        const valid = await verifyPassword(credentials.password, user.passwordHash)
        if (!valid) return null

        const kind = inferKindFromUser(user)
        // Iglesia elegida en el login: se valida contra membresías reales; un
        // valor ajeno o sin membresía se ignora.
        const hintOrgId =
          typeof (credentials as { organizationId?: unknown }).organizationId === "string"
            ? (credentials as { organizationId: string }).organizationId || null
            : null
        const picked =
          kind.scope !== "superadmin" && hintOrgId
            ? (user.memberships.find((m) => m.organizationId === hintOrgId) ?? null)
            : null
        if (picked) {
          kind.organizationId = picked.organizationId
          kind.role = picked.role
          kind.roleId = picked.roleId
          kind.scope = scopeForRole(picked.role)
        }

        const isSuper = kind.scope === "superadmin"
        const candidateOrgId: string | null = isSuper
          ? user.lastOrganizationId
          : kind.organizationId

        // El superadmin opera una iglesia sin ser miembro: sus permisos no dependen de ella.
        const [permissions, roleName] = await Promise.all([
          isSuper
            ? permissionsForRole("superadmin")
            : permissionsForRole(kind.role, kind.roleId, kind.organizationId),
          isSuper ? Promise.resolve(null) : resolveRoleName(kind.roleId),
        ])

        // Recordar la iglesia activa para el próximo ingreso (best-effort).
        if (candidateOrgId && !isSuper && candidateOrgId !== user.lastOrganizationId) {
          try {
            await prisma.user.update({ where: { id: user.id }, data: { lastOrganizationId: candidateOrgId } })
          } catch (err) {
            console.error("[auth] no se pudo recordar la iglesia del login", err)
          }
        }

        let organizationName: string | null = null
        if (candidateOrgId) {
          const org = await prisma.organization.findUnique({
            where: { id: candidateOrgId },
            select: {
              name: true,
              isBlocked: true,
              blockedReason: true,
              subscription: { select: { id: true, status: true, periodEndsAt: true, graceEndsAt: true, autoBlockOnPastDue: true } },
            },
          })
          organizationName = org?.name ?? null
          const subscriptionExpired = Boolean(
            org?.subscription?.autoBlockOnPastDue &&
              ["active", "past_due"].includes(org.subscription.status) &&
              (org.subscription.graceEndsAt ?? org.subscription.periodEndsAt) < new Date()
          )
          if (subscriptionExpired) {
            await prisma.$transaction([
              prisma.organizationSubscription.update({ where: { id: org!.subscription!.id }, data: { status: "suspended" } }),
              prisma.organization.update({ where: { id: candidateOrgId }, data: { isBlocked: true, blockedReason: "Suscripción vencida sin pago registrado" } }),
            ])
          }
          if ((org?.isBlocked || subscriptionExpired) && !isSuper) {
            throw new Error(org?.blockedReason || "El acceso de esta iglesia está suspendido. Contacta al administrador.")
          }
        }
        // Solo se activa si la iglesia existe (el superadmin con una iglesia borrada
        // vuelve a «sin iglesia» en lugar de quedar en un id colgado).
        const activeOrganizationId = organizationName !== null ? candidateOrgId : null
        // El superadmin no queda limitado por el plan de la iglesia que opera.
        const planDenied = isSuper ? [] : await planDeniedPermissions(activeOrganizationId)

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          image: user.avatarUrl,
          role: kind.role,
          roleName,
          organizationId: kind.organizationId,
          activeOrganizationId,
          organizationName,
          permissions,
          planDenied,
          scope: kind.scope,
          authVersion: user.authVersion,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 días
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session: updatePayload }) {
      if (user) {
        token.id = user.id!
        token.role = user.role
        token.roleName = user.roleName ?? null
        token.organizationId = user.organizationId ?? null
        token.activeOrganizationId = user.activeOrganizationId ?? user.organizationId ?? null
        token.organizationName = user.organizationName ?? null
        token.permissions = user.permissions ?? []
        token.planDenied = user.planDenied ?? []
        token.scope = user.scope ?? "app"
        token.name = user.name
        token.email = user.email
        token.picture = user.image ?? token.picture
        token.authCheckedAt = Date.now()
        token.authVersion = (user as typeof user & { authVersion?: number }).authVersion ?? 0
        return token
      }

      // Cambio de iglesia desde el cliente: `update({ activeOrganizationId })`.
      if (trigger === "update" && updatePayload && "activeOrganizationId" in updatePayload) {
        const next = (updatePayload as { activeOrganizationId?: string | null }).activeOrganizationId ?? null
        if (token.scope !== "superadmin" && next) {
          // Solo se puede cambiar a una iglesia donde el usuario tiene membresía.
          const membership = await prisma.membership.findFirst({
            where: { userId: token.id, organizationId: next },
            select: { role: true, roleId: true },
          })
          if (!membership) return token
          token.organizationId = next
          token.role = membership.role
          token.scope = membership.role === "believer" ? "portal" : "app"
          token.roleName = await resolveRoleName(membership.roleId)
          token.permissions = await permissionsForRole(membership.role, membership.roleId, next)
          token.planDenied = await planDeniedPermissions(next)
        }
        token.activeOrganizationId = next
        if (next) {
          const org = await prisma.organization.findUnique({ where: { id: next }, select: { name: true } })
          token.organizationName = org?.name ?? null
        } else {
          token.organizationName = null
        }
        // Recordar la iglesia activa (best-effort).
        try {
          await prisma.user.update({ where: { id: token.id }, data: { lastOrganizationId: next } })
        } catch (err) {
          console.error("[auth] no se pudo recordar la iglesia activa", err)
        }
      }

      // Re-validación contra BD (throttle 60 s): si el usuario fue desactivado o
      // eliminado, se invalida la sesión para forzar el cierre.
      const lastCheck = typeof token.authCheckedAt === "number" ? token.authCheckedAt : 0
      if (Date.now() - lastCheck > 60_000) {
        const activeOrganizationId = token.activeOrganizationId ?? token.organizationId ?? null
        const [dbUser, activeOrganization] = await Promise.all([
          prisma.user.findUnique({ where: { id: token.id }, select: { id: true, isActive: true, authVersion: true } }),
          activeOrganizationId
            ? prisma.organization.findUnique({ where: { id: activeOrganizationId }, select: { name: true } })
            : Promise.resolve(null),
        ])
        token.authCheckedAt = Date.now()
        if (!dbUser || !dbUser.isActive || dbUser.authVersion !== (token.authVersion ?? 0)) {
          token.invalid = true
        } else if (activeOrganization) {
          token.organizationName = activeOrganization.name
          // Si el superadmin cambia el plan, la sesión lo refleja en ~1 minuto.
          if (token.scope !== "superadmin") token.planDenied = await planDeniedPermissions(activeOrganizationId)
        } else if (activeOrganizationId) {
          token.activeOrganizationId = null
          token.organizationName = null
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.invalid || !token.id) {
        session.user = null as unknown as SessionUser
        return session
      }
      session.user = {
        id: token.id,
        name: token.name ?? "",
        email: token.email ?? "",
        image: typeof token.picture === "string" ? token.picture : null,
        role: token.role ?? "believer",
        roleName: token.roleName ?? null,
        organizationId: token.organizationId ?? null,
        activeOrganizationId: token.activeOrganizationId ?? token.organizationId ?? null,
        organizationName: token.organizationName ?? null,
        permissions: token.permissions ?? [],
        planDenied: token.planDenied ?? [],
        scope: token.scope ?? "app",
      }
      return session
    },
  },
}
