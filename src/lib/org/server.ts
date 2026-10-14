import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/ministries/server"

// Organigrama de la iglesia: pastores arriba, luego ministerios (la misión) y áreas de
// servicio (lo que sostiene la organización), con sus líderes. Solo nombres y puestos:
// ningún dato de contacto sale por aquí, por eso lo ve cualquier persona con sesión.

export interface OrgPerson {
  name: string
  title: string | null
  role: "leader" | "assistant"
}
export interface OrgNode {
  id: string
  name: string
  shortName: string | null
  kind: string
  category: "ministry" | "service"
  imageUrl: string | null
  description: string | null
  leaders: OrgPerson[]
  servers: number
  children: OrgNode[]
}
export interface OrgChartDto {
  pastors: { name: string; senior: boolean }[]
  ministries: OrgNode[]
  services: OrgNode[]
}

export async function getOrgChart(actor: Actor): Promise<OrgChartDto> {
  const [rows, pastors] = await Promise.all([
    prisma.ministry.findMany({
      where: { organizationId: actor.organizationId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        parentId: true,
        name: true,
        shortName: true,
        kind: true,
        category: true,
        imageUrl: true,
        description: true,
        members: {
          where: { isActive: true },
          select: { role: true, positionTitle: true, member: { select: { fullName: true } } },
        },
      },
    }),
    prisma.member.findMany({
      where: { organizationId: actor.organizationId, isActive: true, hierarchy: { in: ["pastor", "senior_pastor"] } },
      select: { fullName: true, hierarchy: true },
      orderBy: { fullName: "asc" },
    }),
  ])

  const nodes = new Map<string, OrgNode>()
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      name: r.name,
      shortName: r.shortName,
      kind: r.kind,
      category: r.category === "service" ? "service" : "ministry",
      imageUrl: r.imageUrl,
      description: r.description,
      leaders: r.members
        .filter((m) => m.role === "leader" || m.role === "assistant")
        .sort((a, b) => (a.role === b.role ? 0 : a.role === "leader" ? -1 : 1))
        .map((m) => ({ name: m.member.fullName, title: m.positionTitle, role: m.role as "leader" | "assistant" })),
      servers: r.members.length,
      children: [],
    })
  }
  const roots: OrgNode[] = []
  for (const r of rows) {
    const node = nodes.get(r.id)!
    const parent = r.parentId ? nodes.get(r.parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return {
    pastors: pastors
      .sort((a, b) => Number(b.hierarchy === "senior_pastor") - Number(a.hierarchy === "senior_pastor"))
      .map((p) => ({ name: p.fullName, senior: p.hierarchy === "senior_pastor" })),
    ministries: roots.filter((n) => n.category === "ministry"),
    services: roots.filter((n) => n.category === "service"),
  }
}
