import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import type { Actor } from "@/lib/ministries/server"
import { getApprovalsReport } from "@/lib/school/server"
import { STAGE_ORDER } from "@/lib/school/growth-rules"
import { avg, compareMetrics, comparisonPeriod, formatDay, formatMetric, INCOME_KIND_LABEL, INCOME_SOURCE_LABEL, money, pct, periodBounds, periodLabel, round1, round2 } from "./rules"
import type { ChartUnit, CompareMode, ReportCatalogItem, ReportChart, ReportDoc, ReportPeriod, ReportSection } from "./types"

// Reportes: cada uno consulta solo lo que la persona puede ver (permiso del módulo)
// y siempre acotado a la iglesia de la sesión.

const ymd = (d: Date) => d.toISOString().slice(0, 10)
const num = (d: { toString(): string } | null | undefined) => (d === null || d === undefined ? 0 : Number(d.toString()))
const int = (n: number) => n.toLocaleString("es-MX")

const STAGE_LABEL: Record<string, string> = {
  win: "Ganar",
  consolidate: "Consolidar",
  encounter: "Encuentro con Jesús",
  school: "Escuela de ministerio",
  launch: "Lanzamiento",
  leadership: "Liderazgo",
  discipleship: "Discipulado",
}
const HIERARCHY_LABEL: Record<string, string> = { pastor: "Pastor", disciple: "Discípulo", leader: "Líder", believer: "Creyente" }
const EXPENSE_LABEL: Record<string, string> = {
  renta: "Renta",
  servicios: "Servicios",
  material: "Material",
  hotel: "Hotel",
  comida: "Comida",
  transporte: "Transporte",
  honorarios: "Honorarios",
  nomina: "Nómina",
  vehiculos: "Vehículos",
  otro: "Otros",
}

interface ReportDef extends ReportCatalogItem {
  allowed: (a: Actor) => boolean
  build: (a: Actor, p: ReportPeriod) => Promise<ReportDoc>
}

// ── Asistencia a reuniones ───────────────────────────────────────────────────

async function attendance(a: Actor, p: ReportPeriod): Promise<ReportDoc> {
  const { start, end } = periodBounds(p)
  const rows = await prisma.gathering.findMany({
    where: { organizationId: a.organizationId, date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
    include: { series: { select: { name: true } }, ownerMinistry: { select: { name: true } } },
  })
  const total = (g: (typeof rows)[number]) => g.menCount + g.womenCount + g.youthCount + g.kidsCount
  const sum = (f: (g: (typeof rows)[number]) => number) => rows.reduce((s, g) => s + f(g), 0)
  const bySeries = new Map<string, number[]>()
  for (const g of rows) {
    const k = g.series?.name ?? g.ownerMinistry?.name ?? "Sin horario"
    bySeries.set(k, [...(bySeries.get(k) ?? []), total(g)])
  }
  return {
    id: "attendance",
    title: "Asistencia a reuniones",
    periodLabel: periodLabel(p),
    metrics: [
      { key: "gatherings", label: "Reuniones", value: rows.length, unit: "number" },
      { key: "total", label: "Asistencia total", value: sum(total), unit: "number" },
      { key: "avg", label: "Promedio por reunión", value: avg(rows.map(total)), unit: "number" },
      { key: "men", label: "Hombres", value: sum((g) => g.menCount), unit: "number" },
      { key: "women", label: "Mujeres", value: sum((g) => g.womenCount), unit: "number" },
      { key: "youth", label: "Jóvenes", value: sum((g) => g.youthCount), unit: "number" },
      { key: "kids", label: "Niños", value: sum((g) => g.kidsCount), unit: "number" },
      { key: "new", label: "Personas nuevas", value: sum((g) => g.newCount), unit: "number" },
    ],
    charts: [
      {
        id: "attendance-trend",
        title: "Asistencia por reunión",
        kind: "line",
        unit: "number",
        categories: rows.map((g) => formatDay(ymd(g.date)).slice(0, -5)),
        series: [
          { name: "Total", values: rows.map(total) },
          { name: "Nuevos", values: rows.map((g) => g.newCount) },
        ],
      },
    ],
    kpis: [
      { label: "Reuniones", value: int(rows.length) },
      { label: "Asistencia total", value: int(sum(total)) },
      { label: "Promedio por reunión", value: String(avg(rows.map(total))) },
      { label: "Personas nuevas", value: int(sum((g) => g.newCount)) },
    ],
    sections: [
      {
        title: "Por reunión",
        note: "Los nuevos son un subconjunto de la asistencia (no suman al total).",
        columns: [
          { key: "date", label: "Fecha" },
          { key: "name", label: "Reunión" },
          { key: "men", label: "Hombres", align: "right" },
          { key: "women", label: "Mujeres", align: "right" },
          { key: "youth", label: "Jóvenes", align: "right" },
          { key: "kids", label: "Niños", align: "right" },
          { key: "total", label: "Total", align: "right" },
          { key: "new", label: "Nuevos", align: "right" },
        ],
        rows: rows.map((g) => ({
          date: formatDay(ymd(g.date)),
          name: g.series?.name ?? g.ownerMinistry?.name ?? g.topic ?? "Reunión",
          men: g.menCount,
          women: g.womenCount,
          youth: g.youthCount,
          kids: g.kidsCount,
          total: total(g),
          new: g.newCount,
        })),
        totals: {
          date: "Total",
          name: "",
          men: sum((g) => g.menCount),
          women: sum((g) => g.womenCount),
          youth: sum((g) => g.youthCount),
          kids: sum((g) => g.kidsCount),
          total: sum(total),
          new: sum((g) => g.newCount),
        },
      },
      {
        title: "Promedio por horario",
        columns: [
          { key: "name", label: "Horario o grupo" },
          { key: "count", label: "Reuniones", align: "right" },
          { key: "avg", label: "Promedio", align: "right" },
          { key: "max", label: "Máximo", align: "right" },
        ],
        rows: [...bySeries.entries()].map(([name, v]) => ({ name, count: v.length, avg: avg(v), max: Math.max(...v) })),
      },
    ],
  }
}

// ── Crecimiento en la visión ─────────────────────────────────────────────────

async function vision(a: Actor, p: ReportPeriod): Promise<ReportDoc> {
  const { start, end } = periodBounds(p)
  const org = { organizationId: a.organizationId, isActive: true }
  const inRange = { gte: start, lt: end }
  const [total, byStage, byHierarchy, baptizedTotal, newMembers, baptizedInRange, encounterInRange, launchInRange, encounterTotal, launchTotal, diplomas] = await Promise.all([
    prisma.member.count({ where: org }),
    prisma.member.groupBy({ by: ["visionStage"], where: org, _count: { _all: true } }),
    prisma.member.groupBy({ by: ["hierarchy"], where: org, _count: { _all: true } }),
    prisma.member.count({ where: { ...org, baptizedWater: true } }),
    prisma.member.count({ where: { ...org, createdAt: inRange } }),
    prisma.member.count({ where: { ...org, baptizedWaterAt: inRange } }),
    prisma.member.count({ where: { ...org, encounterAt: inRange } }),
    prisma.member.count({ where: { ...org, launchAt: inRange } }),
    prisma.member.count({ where: { ...org, encounterAt: { not: null } } }),
    prisma.member.count({ where: { ...org, launchAt: { not: null } } }),
    prisma.diploma.count({ where: { organizationId: a.organizationId, issuedAt: inRange } }),
  ])
  const stage = new Map(byStage.map((s) => [s.visionStage as string, s._count._all]))
  return {
    id: "vision",
    title: "Crecimiento en la visión",
    periodLabel: periodLabel(p),
    metrics: [
      { key: "newMembers", label: "Altas", value: newMembers, unit: "number" },
      { key: "baptized", label: "Bautismos en aguas", value: baptizedInRange, unit: "number" },
      { key: "encounter", label: "Encuentros con Jesús", value: encounterInRange, unit: "number" },
      { key: "launch", label: "Lanzamientos", value: launchInRange, unit: "number" },
      { key: "diplomas", label: "Diplomas", value: diplomas, unit: "number" },
    ],
    kpis: [
      { label: "Creyentes activos", value: int(total) },
      { label: "Altas en el periodo", value: int(newMembers) },
      { label: "Bautizados en aguas (total)", value: `${int(baptizedTotal)} (${pct(baptizedTotal, total)}%)` },
      { label: "Diplomas en el periodo", value: int(diplomas) },
    ],
    sections: [
      {
        title: "Dónde va cada persona",
        columns: [
          { key: "stage", label: "Etapa" },
          { key: "count", label: "Creyentes", align: "right" },
          { key: "pct", label: "%", align: "right" },
        ],
        rows: STAGE_ORDER.map((s) => ({ stage: STAGE_LABEL[s], count: stage.get(s) ?? 0, pct: `${pct(stage.get(s) ?? 0, total)}%` })),
        totals: { stage: "Total", count: total, pct: "100%" },
      },
      {
        title: "Checks del camino",
        note: "Se marcan al finalizar cada evento, con la asistencia verificada.",
        columns: [
          { key: "check", label: "Evento" },
          { key: "range", label: "En el periodo", align: "right" },
          { key: "all", label: "Acumulado", align: "right" },
        ],
        rows: [
          { check: "Bautismo en aguas", range: baptizedInRange, all: baptizedTotal },
          { check: "Encuentro con Jesús", range: encounterInRange, all: encounterTotal },
          { check: "Lanzamiento", range: launchInRange, all: launchTotal },
        ],
      },
      {
        title: "Jerarquía",
        columns: [
          { key: "h", label: "Nivel" },
          { key: "count", label: "Personas", align: "right" },
        ],
        rows: byHierarchy.map((h) => ({ h: HIERARCHY_LABEL[h.hierarchy] ?? h.hierarchy, count: h._count._all })),
      },
    ],
  }
}

// ── Células y redes ──────────────────────────────────────────────────────────

async function cells(a: Actor, p: ReportPeriod): Promise<ReportDoc> {
  const { start, end } = periodBounds(p)
  const weeks = Math.max(1, Math.round((end.getTime() - start.getTime()) / (7 * 86_400_000)))
  const list = await prisma.cell.findMany({
    where: { organizationId: a.organizationId, isActive: true },
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      network: { select: { name: true } },
      type: { select: { name: true } },
      members: { where: { isActive: true }, select: { role: true, member: { select: { fullName: true } } } },
      meetings: { where: { date: { gte: start, lt: end } }, select: { attendance: { where: { present: true }, select: { id: true, isNew: true } } } },
    },
    orderBy: { name: "asc" },
  })
  const stats = list.map((c) => {
    const attendees = c.meetings.map((m) => m.attendance.length)
    return {
      name: c.name,
      network: c.network?.name ?? "Sin red",
      type: c.type?.name ?? "—",
      leader: c.members.filter((m) => m.role === "leader").map((m) => m.member.fullName).join(", ") || "—",
      members: c.members.length,
      meetings: c.meetings.length,
      avgAttendance: avg(attendees),
      news: c.meetings.reduce((s, m) => s + m.attendance.filter((x) => x.isNew).length, 0),
    }
  })
  const networks = new Map<string, typeof stats>()
  for (const s of stats) networks.set(s.network, [...(networks.get(s.network) ?? []), s])
  const reported = stats.filter((s) => s.meetings > 0).length
  return {
    id: "cells",
    title: "Células y redes",
    periodLabel: periodLabel(p),
    metrics: [
      { key: "meetings", label: "Reuniones reportadas", value: stats.reduce((s, c) => s + c.meetings, 0), unit: "number" },
      { key: "avg", label: "Asistencia promedio", value: avg(stats.filter((c) => c.meetings > 0).map((c) => c.avgAttendance)), unit: "number" },
      { key: "news", label: "Personas nuevas", value: stats.reduce((s, c) => s + c.news, 0), unit: "number" },
      { key: "delivery", label: "Cumplimiento de reportes", value: pct(reported, stats.length), unit: "percent" },
    ],
    kpis: [
      { label: "Células activas", value: int(stats.length) },
      { label: "Integrantes", value: int(stats.reduce((s, c) => s + c.members, 0)) },
      { label: "Reuniones reportadas", value: int(stats.reduce((s, c) => s + c.meetings, 0)) },
      { label: "Entregaron reporte", value: `${reported} de ${stats.length} (${pct(reported, stats.length)}%)` },
    ],
    sections: [
      {
        title: "Por red",
        columns: [
          { key: "network", label: "Red" },
          { key: "cells", label: "Células", align: "right" },
          { key: "members", label: "Integrantes", align: "right" },
          { key: "meetings", label: "Reuniones", align: "right" },
          { key: "avg", label: "Asist. promedio", align: "right" },
          { key: "news", label: "Nuevos", align: "right" },
          { key: "delivery", label: "Entregaron", align: "right" },
        ],
        rows: [...networks.entries()].map(([network, v]) => ({
          network,
          cells: v.length,
          members: v.reduce((s, c) => s + c.members, 0),
          meetings: v.reduce((s, c) => s + c.meetings, 0),
          avg: avg(v.filter((c) => c.meetings > 0).map((c) => c.avgAttendance)),
          news: v.reduce((s, c) => s + c.news, 0),
          delivery: `${pct(v.filter((c) => c.meetings > 0).length, v.length)}%`,
        })),
      },
      {
        title: "Detalle por célula",
        note: `Reuniones esperadas por célula en el periodo: ${weeks} (una por semana).`,
        columns: [
          { key: "name", label: "Célula" },
          { key: "type", label: "Tipo" },
          { key: "leader", label: "Líder" },
          { key: "members", label: "Integrantes", align: "right" },
          { key: "meetings", label: "Reuniones", align: "right" },
          { key: "avg", label: "Asist. promedio", align: "right" },
        ],
        rows: stats.map((c) => ({ name: c.name, type: c.type, leader: c.leader, members: c.members, meetings: c.meetings, avg: c.avgAttendance })),
      },
      {
        title: "Sin reporte en el periodo",
        columns: [
          { key: "name", label: "Célula" },
          { key: "leader", label: "Líder" },
          { key: "network", label: "Red" },
        ],
        rows: stats.filter((c) => c.meetings === 0).map((c) => ({ name: c.name, leader: c.leader, network: c.network })),
      },
    ],
  }
}

// ── Servicio en reuniones generales ──────────────────────────────────────────

async function service(a: Actor, p: ReportPeriod): Promise<ReportDoc> {
  const { start, end } = periodBounds(p)
  const [served, marks] = await Promise.all([
    prisma.gatheringMinistry.findMany({
      where: { organizationId: a.organizationId, gathering: { date: { gte: start, lt: end } } },
      select: { ministryId: true, gatheringId: true, ministry: { select: { name: true } } },
    }),
    prisma.gatheringServer.findMany({
      where: { organizationId: a.organizationId, gathering: { date: { gte: start, lt: end } } },
      select: { ministryId: true, gatheringId: true, memberId: true, status: true, member: { select: { fullName: true } }, ministry: { select: { name: true } } },
    }),
  ])
  type Agg = { name: string; gatherings: Set<string>; withList: Set<string>; present: number; absent: number; excused: number }
  const byMinistry = new Map<string, Agg>()
  const get = (id: string, name: string) => {
    const cur = byMinistry.get(id) ?? { name, gatherings: new Set<string>(), withList: new Set<string>(), present: 0, absent: 0, excused: 0 }
    byMinistry.set(id, cur)
    return cur
  }
  for (const s of served) get(s.ministryId, s.ministry.name).gatherings.add(s.gatheringId)
  const people = new Map<string, { name: string; ministry: string; present: number; absent: number; excused: number }>()
  for (const m of marks) {
    const g = get(m.ministryId, m.ministry.name)
    g.withList.add(m.gatheringId)
    g[m.status] += 1
    const key = `${m.ministryId}:${m.memberId}`
    const person = people.get(key) ?? { name: m.member.fullName, ministry: m.ministry.name, present: 0, absent: 0, excused: 0 }
    person[m.status] += 1
    people.set(key, person)
  }
  const rows = [...byMinistry.values()].sort((x, y) => x.name.localeCompare(y.name, "es"))
  const sum = (f: (r: Agg) => number) => rows.reduce((s, r) => s + f(r), 0)
  const rate = (pr: number, ab: number) => pct(pr, pr + ab)
  const totalPresent = sum((r) => r.present)
  const totalAbsent = sum((r) => r.absent)
  return {
    id: "service",
    title: "Servicio en reuniones",
    periodLabel: periodLabel(p),
    kpis: [
      { label: "Ministerios en servicio", value: int(rows.filter((r) => r.gatherings.size > 0).length) },
      { label: "Veces en servicio", value: int(sum((r) => r.gatherings.size)) },
      { label: "Asistencias de servidores", value: int(totalPresent) },
      { label: "Asistencia", value: `${rate(totalPresent, totalAbsent)}%` },
    ],
    metrics: [
      { key: "times", label: "Veces en servicio", value: sum((r) => r.gatherings.size), unit: "number" },
      { key: "present", label: "Asistencias", value: totalPresent, unit: "number" },
      { key: "absent", label: "Faltas", value: totalAbsent, unit: "number", lowerIsBetter: true },
      { key: "rate", label: "Asistencia", value: rate(totalPresent, totalAbsent), unit: "percent" },
    ],
    charts: [
      {
        id: "service-by-ministry",
        title: "Asistencia de servidores por ministerio (%)",
        kind: "bar",
        unit: "percent",
        categories: rows.filter((r) => r.present + r.absent > 0).map((r) => r.name.slice(0, 18)),
        series: [{ name: "Asistencia", values: rows.filter((r) => r.present + r.absent > 0).map((r) => rate(r.present, r.absent)) }],
      },
    ],
    sections: [
      {
        title: "Por ministerio",
        note: "La asistencia cuenta solo a quienes se les pasó lista; las justificadas no cuentan como falta.",
        columns: [
          { key: "name", label: "Ministerio" },
          { key: "times", label: "Veces en servicio", align: "right" },
          { key: "lists", label: "Con lista", align: "right" },
          { key: "present", label: "Asistieron", align: "right" },
          { key: "absent", label: "Faltaron", align: "right" },
          { key: "excused", label: "Justificadas", align: "right" },
          { key: "rate", label: "Asistencia", align: "right" },
        ],
        rows: rows.map((r) => ({
          name: r.name,
          times: r.gatherings.size,
          lists: r.withList.size,
          present: r.present,
          absent: r.absent,
          excused: r.excused,
          rate: r.present + r.absent === 0 ? "—" : `${rate(r.present, r.absent)}%`,
        })),
      },
      {
        title: "Servidores con más faltas",
        columns: [
          { key: "name", label: "Servidor" },
          { key: "ministry", label: "Ministerio" },
          { key: "present", label: "Asistió", align: "right" },
          { key: "absent", label: "Faltó", align: "right" },
          { key: "excused", label: "Justificó", align: "right" },
          { key: "rate", label: "Asistencia", align: "right" },
        ],
        rows: [...people.values()]
          .filter((x) => x.absent > 0)
          .sort((x, y) => y.absent - x.absent || x.name.localeCompare(y.name, "es"))
          .slice(0, 25)
          .map((x) => ({ name: x.name, ministry: x.ministry, present: x.present, absent: x.absent, excused: x.excused, rate: `${rate(x.present, x.absent)}%` })),
      },
    ],
  }
}

// ── Escuela ──────────────────────────────────────────────────────────────────

async function school(a: Actor, p: ReportPeriod): Promise<ReportDoc> {
  const { start, end } = periodBounds(p)
  const [approvals, enrolled, requested, diplomas] = await Promise.all([
    getApprovalsReport(a, p.from, p.to),
    prisma.enrollment.count({ where: { organizationId: a.organizationId, status: "enrolled" } }),
    prisma.enrollment.count({ where: { organizationId: a.organizationId, status: "requested" } }),
    prisma.diploma.findMany({
      where: { organizationId: a.organizationId, issuedAt: { gte: start, lt: end } },
      select: { serial: true, issuedAt: true, member: { select: { fullName: true } } },
      orderBy: { issuedAt: "asc" },
    }),
  ])
  return {
    id: "school",
    title: "Escuela ministerial",
    periodLabel: periodLabel(p),
    metrics: [
      { key: "passed", label: "Aprobados", value: approvals.totals.passed, unit: "number" },
      { key: "failed", label: "No aprobados", value: approvals.totals.failed, unit: "number", lowerIsBetter: true },
      { key: "rate", label: "Aprobación", value: approvals.totals.rate, unit: "percent" },
      { key: "diplomas", label: "Diplomas entregados", value: diplomas.length, unit: "number" },
    ],
    kpis: [
      { label: "Cursando ahora", value: int(enrolled) },
      { label: "Solicitudes por revisar", value: int(requested) },
      { label: "Aprobados en el periodo", value: `${int(approvals.totals.passed)} de ${int(approvals.totals.total)}` },
      { label: "Diplomas entregados", value: int(diplomas.length) },
    ],
    sections: [
      {
        title: "Aprobación por libro",
        columns: [
          { key: "course", label: "Libro o curso" },
          { key: "total", label: "Alumnos", align: "right" },
          { key: "passed", label: "Aprobaron", align: "right" },
          { key: "failed", label: "No aprobaron", align: "right" },
          { key: "rate", label: "% aprob.", align: "right" },
        ],
        rows: approvals.byCourse.map((c) => ({ course: c.courseName, total: c.total, passed: c.passed, failed: c.failed, rate: `${c.rate}%` })),
        totals: { course: "Total", total: approvals.totals.total, passed: approvals.totals.passed, failed: approvals.totals.failed, rate: `${approvals.totals.rate}%` },
      },
      {
        title: "Grupos cerrados",
        columns: [
          { key: "group", label: "Grupo" },
          { key: "course", label: "Libro" },
          { key: "closed", label: "Cierre" },
          { key: "total", label: "Alumnos", align: "right" },
          { key: "passed", label: "Aprobaron", align: "right" },
          { key: "avg", label: "Promedio", align: "right" },
        ],
        rows: approvals.groups.map((g) => ({
          group: g.groupName,
          course: g.courseName,
          closed: g.closedAt ? formatDay(g.closedAt.slice(0, 10)) : "",
          total: g.total,
          passed: g.passed,
          avg: g.average ?? "—",
        })),
      },
      {
        title: "Diplomas entregados",
        columns: [
          { key: "name", label: "Persona" },
          { key: "serial", label: "Folio" },
          { key: "date", label: "Fecha" },
        ],
        rows: diplomas.map((d) => ({ name: d.member.fullName, serial: d.serial, date: formatDay(ymd(d.issuedAt)) })),
      },
    ],
  }
}

// ── Eventos ──────────────────────────────────────────────────────────────────

async function events(a: Actor, p: ReportPeriod): Promise<ReportDoc> {
  const { start, end } = periodBounds(p)
  const list = await prisma.event.findMany({
    where: { organizationId: a.organizationId, status: { not: "cancelled" }, startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      name: true,
      kind: true,
      startsAt: true,
      price: true,
      tickets: { where: { status: { not: "cancelled" } }, select: { checkedInAt: true, payments: { select: { amount: true } } } },
      expenses: { select: { amount: true } },
    },
  })
  const rows = list.map((e) => {
    const collected = e.tickets.reduce((s, t) => s + t.payments.reduce((x, y) => x + num(y.amount), 0), 0)
    const expenses = e.expenses.reduce((s, x) => s + num(x.amount), 0)
    return {
      name: e.name,
      kind: e.kind,
      date: formatDay(ymd(e.startsAt)),
      tickets: e.tickets.length,
      present: e.tickets.filter((t) => t.checkedInAt).length,
      collected: round2(collected),
      expenses: round2(expenses),
      net: round2(collected - expenses),
    }
  })
  const sum = (k: "tickets" | "present" | "collected" | "expenses" | "net") => rows.reduce((s, r) => s + r[k], 0)
  return {
    id: "events",
    title: "Eventos",
    periodLabel: periodLabel(p),
    metrics: [
      { key: "events", label: "Eventos", value: rows.length, unit: "number" },
      { key: "tickets", label: "Boletos", value: sum("tickets"), unit: "number" },
      { key: "present", label: "Asistieron", value: sum("present"), unit: "number" },
      { key: "collected", label: "Cobrado", value: round2(sum("collected")), unit: "money" },
      { key: "expenses", label: "Gastos", value: round2(sum("expenses")), unit: "money", lowerIsBetter: true },
      { key: "net", label: "Resultado", value: round2(sum("net")), unit: "money" },
    ],
    charts: [
      {
        id: "events-money",
        title: "Cobrado y gastos por evento",
        kind: "bar",
        unit: "money",
        categories: rows.map((r) => r.name.slice(0, 18)),
        series: [
          { name: "Cobrado", values: rows.map((r) => r.collected) },
          { name: "Gastos", values: rows.map((r) => r.expenses) },
        ],
      },
    ],
    kpis: [
      { label: "Eventos", value: int(rows.length) },
      { label: "Boletos", value: int(sum("tickets")) },
      { label: "Asistieron", value: `${int(sum("present"))} (${pct(sum("present"), sum("tickets"))}%)` },
      { label: "Resultado", value: money(round2(sum("net"))) },
    ],
    sections: [
      {
        title: "Por evento",
        columns: [
          { key: "date", label: "Fecha" },
          { key: "name", label: "Evento" },
          { key: "kind", label: "Clase" },
          { key: "tickets", label: "Boletos", align: "right" },
          { key: "present", label: "Entradas", align: "right" },
          { key: "collected", label: "Cobrado", align: "right" },
          { key: "expenses", label: "Gastos", align: "right" },
          { key: "net", label: "Resultado", align: "right" },
        ],
        rows: rows.map((r) => ({ ...r, collected: money(r.collected), expenses: money(r.expenses), net: money(r.net) })),
        totals: {
          date: "Total",
          name: "",
          kind: "",
          tickets: sum("tickets"),
          present: sum("present"),
          collected: money(round2(sum("collected"))),
          expenses: money(round2(sum("expenses"))),
          net: money(round2(sum("net"))),
        },
      },
    ],
  }
}

// ── Comunidad Kids ───────────────────────────────────────────────────────────

async function kids(a: Actor, p: ReportPeriod): Promise<ReportDoc> {
  const { start, end } = periodBounds(p)
  const [rooms, sessions] = await Promise.all([
    prisma.kidsRoom.findMany({ where: { organizationId: a.organizationId }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.kidsSession.findMany({
      where: { organizationId: a.organizationId, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
      select: { date: true, label: true, kind: true, attendance: { select: { roomId: true, childId: true } } },
    }),
  ])
  const unique = new Set<string>()
  const byRoom = new Map<string, number>()
  let total = 0
  for (const s of sessions)
    for (const x of s.attendance) {
      unique.add(x.childId)
      byRoom.set(x.roomId, (byRoom.get(x.roomId) ?? 0) + 1)
      total += 1
    }
  return {
    id: "kids",
    title: "Comunidad Kids",
    periodLabel: periodLabel(p),
    metrics: [
      { key: "sessions", label: "Servicios y eventos", value: sessions.length, unit: "number" },
      { key: "entries", label: "Entradas de niños", value: total, unit: "number" },
      { key: "unique", label: "Niños distintos", value: unique.size, unit: "number" },
      { key: "avg", label: "Promedio por servicio", value: sessions.length === 0 ? 0 : round1(total / sessions.length), unit: "number" },
    ],
    charts: [
      {
        id: "kids-trend",
        title: "Niños por servicio",
        kind: "line",
        unit: "number",
        categories: sessions.map((s) => formatDay(ymd(s.date)).slice(0, -5)),
        series: [{ name: "Niños", values: sessions.map((s) => s.attendance.length) }],
      },
    ],
    kpis: [
      { label: "Servicios y eventos", value: int(sessions.length) },
      { label: "Entradas de niños", value: int(total) },
      { label: "Niños distintos", value: int(unique.size) },
      { label: "Promedio por servicio", value: String(sessions.length === 0 ? 0 : round1(total / sessions.length)) },
    ],
    sections: [
      {
        title: "Por servicio",
        columns: [
          { key: "date", label: "Fecha" },
          { key: "label", label: "Servicio" },
          { key: "kind", label: "Tipo" },
          { key: "total", label: "Niños", align: "right" },
        ],
        rows: sessions.map((s) => ({ date: formatDay(ymd(s.date)), label: s.label, kind: s.kind === "event" ? "Evento" : "Servicio", total: s.attendance.length })),
        totals: { date: "Total", label: "", kind: "", total },
      },
      {
        title: "Por salón",
        columns: [
          { key: "room", label: "Salón" },
          { key: "count", label: "Entradas", align: "right" },
        ],
        rows: rooms.filter((r) => byRoom.has(r.id)).map((r) => ({ room: r.name, count: byRoom.get(r.id) ?? 0 })),
      },
    ],
  }
}

// ── Finanzas ─────────────────────────────────────────────────────────────────

async function finance(a: Actor, p: ReportPeriod): Promise<ReportDoc> {
  const { start, end } = periodBounds(p)
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: { organizationId: a.organizationId, receivedAt: { gte: start, lt: end } }, select: { kind: true, source: true, amount: true, receivedAt: true } }),
    prisma.expense.findMany({ where: { organizationId: a.organizationId, spentAt: { gte: start, lt: end } }, select: { category: true, amount: true, spentAt: true } }),
  ])
  const group = <T,>(rows: T[], key: (r: T) => string, value: (r: T) => number) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(key(r), round2((m.get(key(r)) ?? 0) + value(r)))
    return [...m.entries()].sort((x, y) => y[1] - x[1])
  }
  const incomeTotal = round2(incomes.reduce((s, i) => s + num(i.amount), 0))
  const expenseTotal = round2(expenses.reduce((s, e) => s + num(e.amount), 0))
  const months = new Map<string, { income: number; expense: number }>()
  for (const i of incomes) {
    const k = ymd(i.receivedAt).slice(0, 7)
    const m = months.get(k) ?? { income: 0, expense: 0 }
    m.income = round2(m.income + num(i.amount))
    months.set(k, m)
  }
  for (const e of expenses) {
    const k = ymd(e.spentAt).slice(0, 7)
    const m = months.get(k) ?? { income: 0, expense: 0 }
    m.expense = round2(m.expense + num(e.amount))
    months.set(k, m)
  }
  return {
    id: "finance",
    title: "Finanzas",
    periodLabel: periodLabel(p),
    metrics: [
      { key: "income", label: "Ingresos", value: incomeTotal, unit: "money" },
      { key: "expense", label: "Gastos", value: expenseTotal, unit: "money", lowerIsBetter: true },
      { key: "balance", label: "Saldo", value: round2(incomeTotal - expenseTotal), unit: "money" },
    ],
    charts: [
      {
        id: "finance-months",
        title: "Ingresos y gastos por mes",
        kind: "bar",
        unit: "money",
        categories: [...months.keys()].sort(),
        series: [
          { name: "Ingresos", values: [...months.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([, v]) => v.income) },
          { name: "Gastos", values: [...months.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([, v]) => v.expense) },
        ],
      },
    ],
    kpis: [
      { label: "Ingresos", value: money(incomeTotal) },
      { label: "Gastos", value: money(expenseTotal) },
      { label: "Saldo", value: money(round2(incomeTotal - expenseTotal)) },
      { label: "Movimientos", value: int(incomes.length + expenses.length) },
    ],
    sections: [
      {
        title: "Ingresos por tipo",
        columns: [
          { key: "k", label: "Tipo" },
          { key: "v", label: "Monto", align: "right" },
        ],
        rows: group(incomes, (i) => i.kind, (i) => num(i.amount)).map(([k, v]) => ({ k: INCOME_KIND_LABEL[k] ?? k, v: money(v) })),
        totals: { k: "Total", v: money(incomeTotal) },
      },
      {
        title: "Ingresos por forma de recibirlos",
        columns: [
          { key: "k", label: "Forma" },
          { key: "v", label: "Monto", align: "right" },
        ],
        rows: group(incomes, (i) => i.source, (i) => num(i.amount)).map(([k, v]) => ({ k: INCOME_SOURCE_LABEL[k] ?? k, v: money(v) })),
      },
      {
        title: "Gastos por categoría",
        columns: [
          { key: "k", label: "Categoría" },
          { key: "v", label: "Monto", align: "right" },
        ],
        rows: group(expenses, (e) => e.category, (e) => num(e.amount)).map(([k, v]) => ({ k: EXPENSE_LABEL[k] ?? k, v: money(v) })),
        totals: { k: "Total", v: money(expenseTotal) },
      },
      {
        title: "Por mes",
        columns: [
          { key: "m", label: "Mes" },
          { key: "i", label: "Ingresos", align: "right" },
          { key: "e", label: "Gastos", align: "right" },
          { key: "b", label: "Saldo", align: "right" },
        ],
        rows: [...months.entries()]
          .sort((x, y) => x[0].localeCompare(y[0]))
          .map(([m, v]) => ({ m, i: money(v.income), e: money(v.expense), b: money(round2(v.income - v.expense)) })),
      },
    ],
  }
}

// ── Consolidación ────────────────────────────────────────────────────────────

async function consolidation(a: Actor, p: ReportPeriod): Promise<ReportDoc> {
  const { start, end } = periodBounds(p)
  const cases = await prisma.consolidationCase.findMany({
    where: { organizationId: a.organizationId, visitedAt: { gte: start, lt: end } },
    select: {
      status: true,
      outcome: true,
      acceptedChrist: true,
      assignedTo: { select: { fullName: true } },
      _count: { select: { contacts: true } },
    },
  })
  const count = (f: (c: (typeof cases)[number]) => boolean) => cases.filter(f).length
  const byFollower = new Map<string, { total: number; channeled: number; contacts: number }>()
  for (const c of cases) {
    const k = c.assignedTo?.fullName ?? "Sin asignar"
    const v = byFollower.get(k) ?? { total: 0, channeled: 0, contacts: 0 }
    v.total += 1
    if (c.status === "channeled") v.channeled += 1
    v.contacts += c._count.contacts
    byFollower.set(k, v)
  }
  const STATUS: Record<string, string> = { received: "Recibidos", following: "En seguimiento", channeled: "Canalizados", closed: "Cerrados" }
  const OUTCOME: Record<string, string> = { cell: "A una célula", meeting: "A una reunión", none: "Sin continuidad" }
  const outcomes = new Map<string, number>()
  for (const c of cases) if (c.outcome) outcomes.set(c.outcome, (outcomes.get(c.outcome) ?? 0) + 1)
  return {
    id: "consolidation",
    title: "Consolidación",
    periodLabel: periodLabel(p),
    metrics: [
      { key: "received", label: "Personas recibidas", value: cases.length, unit: "number" },
      { key: "christ", label: "Aceptaron a Cristo", value: count((c) => c.acceptedChrist), unit: "number" },
      { key: "channeled", label: "Canalizadas", value: count((c) => c.status === "channeled"), unit: "number" },
      { key: "rate", label: "% canalizadas", value: pct(count((c) => c.status === "channeled"), cases.length), unit: "percent" },
    ],
    kpis: [
      { label: "Personas recibidas", value: int(cases.length) },
      { label: "Aceptaron a Cristo", value: int(count((c) => c.acceptedChrist)) },
      { label: "Canalizadas", value: `${int(count((c) => c.status === "channeled"))} (${pct(count((c) => c.status === "channeled"), cases.length)}%)` },
      { label: "Sin asignar", value: int(count((c) => !c.assignedTo && c.status !== "closed")) },
    ],
    sections: [
      {
        title: "Estado del seguimiento",
        columns: [
          { key: "k", label: "Estado" },
          { key: "v", label: "Personas", align: "right" },
        ],
        rows: Object.entries(STATUS).map(([k, label]) => ({ k: label, v: count((c) => c.status === k) })),
        totals: { k: "Total", v: cases.length },
      },
      {
        title: "A dónde se canalizaron",
        columns: [
          { key: "k", label: "Destino" },
          { key: "v", label: "Personas", align: "right" },
        ],
        rows: [...outcomes.entries()].map(([k, v]) => ({ k: OUTCOME[k] ?? k, v })),
      },
      {
        title: "Por quien da seguimiento",
        columns: [
          { key: "name", label: "Responsable" },
          { key: "total", label: "Casos", align: "right" },
          { key: "contacts", label: "Contactos", align: "right" },
          { key: "channeled", label: "Canalizados", align: "right" },
        ],
        rows: [...byFollower.entries()].map(([name, v]) => ({ name, total: v.total, contacts: v.contacts, channeled: v.channeled })),
      },
    ],
  }
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

const REPORTS: ReportDef[] = [
  {
    id: "attendance",
    title: "Asistencia a reuniones",
    description: "Hombres, mujeres, jóvenes, niños y nuevos por reunión, con promedios por horario.",
    allowed: (a) => Boolean(a.canViewGatherings || a.canManageGatherings),
    build: attendance,
  },
  {
    id: "service",
    title: "Servicio en reuniones",
    description: "Asistencia de los servidores de cada ministerio a las reuniones generales en que estuvo en servicio.",
    allowed: (a) => Boolean(a.canViewGatherings || a.canManageGatherings),
    build: service,
  },
  {
    id: "vision",
    title: "Crecimiento en la visión",
    description: "Etapas, bautizos en aguas, encuentros, lanzamientos y diplomas.",
    allowed: (a) => Boolean(a.canViewStats || a.canManageMembers),
    build: vision,
  },
  {
    id: "cells",
    title: "Células y redes",
    description: "Reuniones, asistencia promedio y cumplimiento de reportes por red y célula.",
    allowed: (a) => Boolean(a.canViewCells || a.canManageCells),
    build: cells,
  },
  {
    id: "school",
    title: "Escuela ministerial",
    description: "Aprobación por libro, grupos cerrados y diplomas entregados.",
    allowed: (a) => Boolean(a.canViewSchool || a.canManageSchool),
    build: school,
  },
  {
    id: "events",
    title: "Eventos",
    description: "Boletos, entradas, cobros, gastos y resultado de cada evento.",
    allowed: (a) => Boolean(a.canViewEvents || a.canManageEvents),
    build: events,
  },
  {
    id: "kids",
    title: "Comunidad Kids",
    description: "Entradas de niños por servicio y por salón.",
    allowed: (a) => Boolean(a.canViewAll),
    build: kids,
  },
  {
    id: "consolidation",
    title: "Consolidación",
    description: "Personas recibidas, seguimiento y canalización a células.",
    allowed: (a) => Boolean(a.canViewAll),
    build: consolidation,
  },
  {
    id: "finance",
    title: "Finanzas",
    description: "Ingresos por tipo, gastos por categoría, saldo y comparativo por mes.",
    allowed: (a) => Boolean(a.canViewFinance || a.canManageFinance),
    build: finance,
  },
]

export function listReports(actor: Actor): ReportCatalogItem[] {
  if (!actor.canViewReports) return []
  return REPORTS.filter((r) => r.allowed(actor)).map(({ id, title, description }) => ({ id, title, description }))
}

export async function buildReport(actor: Actor, id: string, period: ReportPeriod): Promise<ReportDoc> {
  const def = REPORTS.find((r) => r.id === id)
  if (!def) throw new CrudError("Reporte no encontrado", 404)
  if (!actor.canViewReports || !def.allowed(actor)) throw new CrudError("No tienes permiso para ver este reporte", 403)
  return def.build(actor, period)
}


/**
 * Reporte con comparativo: además del periodo pedido arma el equivalente anterior
 * (o el mismo del año pasado) y agrega la tabla de variaciones y sus gráficas.
 */
export async function buildReportComparative(actor: Actor, id: string, period: ReportPeriod, mode: CompareMode): Promise<ReportDoc> {
  const doc = await buildReport(actor, id, period)
  const other = comparisonPeriod(period, mode)
  if (!other || !doc.metrics || doc.metrics.length === 0) return { ...doc, comparedWith: null }
  const prevDoc = await buildReport(actor, id, other)
  const rows = compareMetrics(doc.metrics, prevDoc.metrics ?? [])
  const label = mode === "year" ? "el mismo periodo del año anterior" : "el periodo anterior"
  const prevLabel = periodLabel(other)

  const section: ReportSection = {
    title: `Comparativo con ${label}`,
    note: `Actual: ${doc.periodLabel}. Anterior: ${prevLabel}.`,
    columns: [
      { key: "metric", label: "Cifra" },
      { key: "current", label: "Actual", align: "right" },
      { key: "previous", label: "Anterior", align: "right" },
      { key: "change", label: "Variación", align: "right" },
    ],
    rows: rows.map((m) => ({
      metric: m.label,
      current: formatMetric(m.value, m.unit),
      previous: formatMetric(m.previous, m.unit),
      change: m.changeLabel,
      // Solo para colorear en pantalla: si subir es bueno o malo según la cifra.
      tone: m.change === null || m.change === 0 ? "flat" : (m.change > 0) !== Boolean(m.lowerIsBetter) ? "good" : "bad",
    })),
  }

  // Una gráfica por tipo de unidad: no se mezclan pesos con personas ni porcentajes.
  const units: ChartUnit[] = ["number", "money", "percent"]
  const UNIT_TITLE: Record<ChartUnit, string> = { number: "Cifras", money: "Montos", percent: "Porcentajes" }
  const charts: ReportChart[] = []
  for (const unit of units) {
    const group = rows.filter((m) => m.unit === unit)
    if (group.length < 1) continue
    charts.push({
      id: `compare-${unit}`,
      title: `${UNIT_TITLE[unit]}: actual vs ${mode === "year" ? "año anterior" : "periodo anterior"}`,
      kind: "bar",
      unit,
      categories: group.map((m) => m.label),
      series: [
        { name: "Actual", values: group.map((m) => m.value) },
        { name: mode === "year" ? "Año anterior" : "Anterior", values: group.map((m) => m.previous) },
      ],
    })
  }
  return {
    ...doc,
    comparedWith: { label, period: other },
    charts: [...charts, ...(doc.charts ?? [])],
    sections: [section, ...doc.sections],
  }
}
