import { prisma } from "@/lib/db"
import type { $Enums } from "@/generated/prisma/client"

// Resumen del panel: solo lecturas agregadas, siempre acotadas a la iglesia.

export const VISION_STAGES: $Enums.VisionStage[] = [
  "win",
  "consolidate",
  "encounter",
  "school",
  "launch",
  "leadership",
  "discipleship",
]

export interface PanelSummary {
  totalMembers: number
  newThisMonth: number
  withAccess: number
  baptizedWater: number
  baptizedFire: number
  employees: number
  locations: number
  byStage: { stage: $Enums.VisionStage; count: number }[]
  byHierarchy: { hierarchy: $Enums.ChurchHierarchy; count: number }[]
  /** Lo que se mueve esta semana en los módulos operativos. */
  ops: {
    lastGathering: { date: string; total: number } | null
    activeCells: number
    upcomingEvents: number
    openCases: number
    studying: number
  }
}

export async function getPanelSummary(organizationId: string): Promise<PanelSummary> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const active = { organizationId, isActive: true } as const

  const [totalMembers, newThisMonth, withAccess, baptizedWater, baptizedFire, employees, locations, stages, hierarchies] =
    await Promise.all([
      prisma.member.count({ where: active }),
      prisma.member.count({ where: { ...active, createdAt: { gte: monthStart } } }),
      prisma.member.count({ where: { ...active, userId: { not: null } } }),
      prisma.member.count({ where: { ...active, baptizedWater: true } }),
      prisma.member.count({ where: { ...active, baptizedFire: true } }),
      prisma.employee.count({ where: active }),
      prisma.location.count({ where: active }),
      prisma.member.groupBy({ by: ["visionStage"], where: active, _count: { _all: true } }),
      prisma.member.groupBy({ by: ["hierarchy"], where: active, _count: { _all: true } }),
    ])

  const now = new Date()
  const [lastGathering, activeCells, upcomingEvents, openCases, studying] = await Promise.all([
    prisma.gathering.findFirst({
      where: { organizationId },
      orderBy: { date: "desc" },
      select: { date: true, menCount: true, womenCount: true, youthCount: true, kidsCount: true },
    }),
    prisma.cell.count({ where: active }),
    prisma.event.count({
      where: { organizationId, status: "published", startsAt: { gte: now, lt: new Date(now.getTime() + 30 * 86_400_000) } },
    }),
    prisma.consolidationCase.count({ where: { organizationId, status: { in: ["received", "following"] } } }),
    prisma.enrollment.count({ where: { organizationId, status: "enrolled" } }),
  ])

  const stageCount = new Map(stages.map((s) => [s.visionStage, s._count._all]))
  return {
    totalMembers,
    newThisMonth,
    withAccess,
    baptizedWater,
    baptizedFire,
    employees,
    locations,
    byStage: VISION_STAGES.map((stage) => ({ stage, count: stageCount.get(stage) ?? 0 })),
    byHierarchy: hierarchies.map((h) => ({ hierarchy: h.hierarchy, count: h._count._all })),
    ops: {
      lastGathering: lastGathering
        ? {
            date: lastGathering.date.toISOString().slice(0, 10),
            total: lastGathering.menCount + lastGathering.womenCount + lastGathering.youthCount + lastGathering.kidsCount,
          }
        : null,
      activeCells,
      upcomingEvents,
      openCases,
      studying,
    },
  }
}
