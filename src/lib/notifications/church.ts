import { prisma } from "@/lib/db"
import { persistNotification } from "@/lib/notifications/helpers"

// Avisos de la iglesia: cada uno se guarda en la bandeja de la persona, se emite en
// vivo y llega como notificación push a sus dispositivos suscritos. Siempre se llama
// «sin esperar»: un fallo al avisar nunca debe romper la operación que lo origina.

export interface ChurchNotice {
  kind: string
  title: string
  body?: string
  link?: string
  severity?: "info" | "success" | "warning"
  /** No avisar a quien originó la acción. */
  excludeUserId?: string | null
}

async function deliver(organizationId: string, userIds: string[], n: ChurchNotice) {
  const unique = [...new Set(userIds)].filter((id) => id && id !== n.excludeUserId)
  // Por lotes pequeños para no saturar la base ni el servicio de push.
  for (let i = 0; i < unique.length; i += 25) {
    await Promise.all(
      unique.slice(i, i + 25).map((recipientUserId) =>
        persistNotification({
          organizationId,
          recipientUserId,
          kind: n.kind,
          title: n.title,
          body: n.body,
          link: n.link,
          severity: n.severity ?? "info",
        }).catch((err) => console.error("[notify] no se pudo avisar:", err))
      )
    )
  }
  return unique.length
}

/** Avisa a usuarios concretos. */
export function notifyUsers(organizationId: string, userIds: (string | null | undefined)[], n: ChurchNotice) {
  return deliver(organizationId, userIds.filter((x): x is string => Boolean(x)), n)
}

/** Avisa a creyentes por su ficha (solo a quienes tienen cuenta). */
export async function notifyMembers(organizationId: string, memberIds: (string | null | undefined)[], n: ChurchNotice) {
  const ids = memberIds.filter((x): x is string => Boolean(x))
  if (ids.length === 0) return 0
  const rows = await prisma.member.findMany({ where: { organizationId, id: { in: ids }, userId: { not: null } }, select: { userId: true } })
  return deliver(organizationId, rows.map((r) => r.userId!), n)
}

/** Avisa a toda la iglesia, o solo a líderes (jerarquía sobre creyente o líder/asistente de ministerio). */
export async function notifyChurch(organizationId: string, n: ChurchNotice, opts: { leadersOnly?: boolean } = {}) {
  const members = await prisma.member.findMany({
    where: {
      organizationId,
      isActive: true,
      userId: { not: null },
      user: { isActive: true },
      ...(opts.leadersOnly
        ? { OR: [{ hierarchy: { not: "believer" } }, { ministryMemberships: { some: { isActive: true, role: { in: ["leader", "assistant"] } } } }] }
        : {}),
    },
    select: { userId: true },
  })
  return deliver(organizationId, members.map((m) => m.userId!), n)
}

/** Avisa a quien tiene un permiso (rol propietario/administrador o permiso concedido en su rol). */
export async function notifyPermission(organizationId: string, permissionKey: string, n: ChurchNotice) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId, user: { isActive: true } },
    select: {
      userId: true,
      role: true,
      user: { select: { isSuperadmin: true } },
      roleRef: { select: { permissions: { select: { permissionKey: true, allowed: true } } } },
    },
  })
  const ids = memberships
    .filter(
      (m) =>
        m.user.isSuperadmin ||
        ["owner", "admin"].includes(m.role) ||
        m.roleRef?.permissions.some((p) => p.permissionKey === permissionKey && p.allowed)
    )
    .map((m) => m.userId)
  return deliver(organizationId, ids, n)
}

/** Líderes y asistentes de un ministerio. */
export async function notifyMinistryLeaders(organizationId: string, ministryId: string, n: ChurchNotice) {
  const rows = await prisma.ministryMember.findMany({
    where: { organizationId, ministryId, isActive: true, role: { in: ["leader", "assistant"] }, member: { userId: { not: null } } },
    select: { member: { select: { userId: true } } },
  })
  return deliver(organizationId, rows.map((r) => r.member.userId!), n)
}

/** Atajo «sin esperar»: registra el error y sigue. */
export function fireAndForget(p: Promise<unknown>) {
  p.catch((err) => console.error("[notify]", err))
}
