import { prisma } from "@/lib/db"
import { cellSheetAccess } from "@/lib/cells/server"
import { buildFollowUpSheet, type FollowUpSheet, type SheetMeeting, type SheetPerson } from "@/lib/cells/followup-rules"
import type { Actor } from "@/lib/ministries/server"

// Datos de la «Hoja de seguimiento mensual» de una célula (el mismo formato que se llena en papel).

const ymd = (d: Date) => d.toISOString().slice(0, 10)

export function parseSheetMonth(raw: string | null | undefined): { year: number; monthIndex: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(raw ?? "")
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { year: Number(m[1]), monthIndex: Number(m[2]) - 1 }
  const now = new Date()
  return { year: now.getUTCFullYear(), monthIndex: now.getUTCMonth() }
}

export async function getFollowUpSheet(actor: Actor, cellId: string, monthRaw?: string | null): Promise<FollowUpSheet> {
  const cell = await cellSheetAccess(actor, cellId)
  const { year, monthIndex } = parseSheetMonth(monthRaw)
  const from = new Date(Date.UTC(year, monthIndex, 1))
  const to = new Date(Date.UTC(year, monthIndex + 1, 0))

  const [members, meetings, network, ministryTotal] = await Promise.all([
    prisma.cellMember.findMany({
      where: { cellId, isActive: true },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            baptizedWater: true,
            baptizedFire: true,
            encounterAt: true,
            launchAt: true,
            discipler: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.cellMeeting.findMany({
      where: { cellId, date: { gte: from, lte: to } },
      include: { attendance: { select: { memberId: true, present: true, isNew: true } } },
      orderBy: { date: "asc" },
    }),
    cell.networkId
      ? prisma.cellNetwork.findUnique({ where: { id: cell.networkId }, select: { name: true, leader: { select: { fullName: true } } } })
      : null,
    prisma.course.count({ where: { organizationId: actor.organizationId, isActive: true, school: { kind: "ministry" } } }),
  ])

  // Cursos aprobados por persona, de una sola consulta.
  const ids = members.map((m) => m.memberId)
  const passed = ids.length
    ? await prisma.enrollment.findMany({
        where: { organizationId: actor.organizationId, memberId: { in: ids }, passed: true },
        select: { memberId: true, group: { select: { courseId: true, course: { select: { school: { select: { kind: true } } } } } } },
      })
    : []
  const ministryBy = new Map<string, Set<string>>()
  const theologyBy = new Map<string, Set<string>>()
  for (const e of passed) {
    const map = e.group.course.school.kind === "ministry" ? ministryBy : theologyBy
    const set = map.get(e.memberId) ?? new Set<string>()
    set.add(e.group.courseId)
    map.set(e.memberId, set)
  }

  const people: SheetPerson[] = members.map((m) => ({
    memberId: m.memberId,
    fullName: m.member.fullName,
    phone: m.member.phone,
    role: m.role,
    baptizedWater: m.member.baptizedWater,
    baptizedFire: m.member.baptizedFire,
    encounterAt: m.member.encounterAt,
    launchAt: m.member.launchAt,
    ministryPassed: ministryBy.get(m.memberId)?.size ?? 0,
    ministryTotal,
    theologyPassed: theologyBy.get(m.memberId)?.size ?? 0,
  }))
  const sheetMeetings: SheetMeeting[] = meetings.map((m) => ({
    date: ymd(m.date),
    notes: m.notes,
    attendance: new Map(m.attendance.map((a) => [a.memberId, { present: a.present, isNew: a.isNew }])),
  }))

  const leaderMember = members.find((m) => m.role === "leader")
  const pastor = network?.leader?.fullName ?? leaderMember?.member.discipler?.fullName ?? null

  return buildFollowUpSheet({
    year,
    monthIndex,
    cell: {
      name: cell.name,
      dayOfWeek: cell.dayOfWeek,
      startTime: cell.startTime,
      host: cell.host?.fullName ?? cell.hostName,
      network: network?.name ?? null,
      pastor,
      street: cell.street,
      neighborhood: cell.neighborhood,
    },
    people,
    meetings: sheetMeetings,
  })
}
