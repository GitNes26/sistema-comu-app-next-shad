import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import type { Actor } from "@/lib/ministries/server"
import { mailConfigured, sendReportMail } from "@/lib/auth/mail"
import { loadLogoPng } from "@/lib/documents/branding"
import { renderReportPdf } from "./pdf"
import { reportToCsv } from "./rules"
import { buildReportComparative, listReports } from "./server"
import { MAX_RECIPIENTS, normalizeSlot, nextRunAfter, parseRecipients, periodForRun, slotLabel, validTimezone, type Slot } from "./schedule-rules"

// Envío programado de reportes: cada programación arma el reporte del periodo ya
// terminado (última semana o último mes) y lo manda por correo con el PDF adjunto.

export interface ScheduleDto {
  id: string
  reportId: string
  reportTitle: string
  frequency: "weekly" | "monthly"
  dayOfWeek: number
  dayOfMonth: number
  hour: number
  label: string
  recipients: string[]
  includeCsv: boolean
  isActive: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  lastStatus: "sent" | "error" | null
  lastError: string | null
}

const TITLES: Record<string, string> = {
  attendance: "Asistencia a reuniones",
  service: "Servicio en reuniones",
  vision: "Crecimiento en la visión",
  cells: "Células y redes",
  school: "Escuela ministerial",
  events: "Eventos",
  kids: "Comunidad Kids",
  consolidation: "Consolidación",
  finance: "Finanzas",
}

function assertReportsUser(actor: Actor) {
  if (!actor.canViewReports) throw new CrudError("No tienes permiso para programar reportes", 403)
}

async function orgTimezone(organizationId: string) {
  const o = await prisma.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } })
  return o?.timezone && validTimezone(o.timezone) ? o.timezone : "America/Mexico_City"
}

type Row = Awaited<ReturnType<typeof prisma.reportSchedule.findFirstOrThrow>>

const toDto = (r: Row): ScheduleDto => {
  const frequency = r.frequency === "monthly" ? "monthly" : "weekly"
  return {
    id: r.id,
    reportId: r.reportId,
    reportTitle: TITLES[r.reportId] ?? r.reportId,
    frequency,
    dayOfWeek: r.dayOfWeek,
    dayOfMonth: r.dayOfMonth,
    hour: r.hour,
    label: slotLabel({ frequency, dayOfWeek: r.dayOfWeek, dayOfMonth: r.dayOfMonth, hour: r.hour }),
    recipients: Array.isArray(r.recipients) ? r.recipients.map(String) : [],
    includeCsv: r.includeCsv,
    isActive: r.isActive,
    nextRunAt: r.nextRunAt?.toISOString() ?? null,
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    lastStatus: r.lastStatus === "sent" ? "sent" : r.lastStatus === "error" ? "error" : null,
    lastError: r.lastError,
  }
}

export async function listSchedules(actor: Actor): Promise<{ schedules: ScheduleDto[]; mailReady: boolean }> {
  assertReportsUser(actor)
  const rows = await prisma.reportSchedule.findMany({ where: { organizationId: actor.organizationId }, orderBy: { createdAt: "asc" } })
  return { schedules: rows.map(toDto), mailReady: mailConfigured() }
}

function parseInput(input: Record<string, unknown>, current?: Row) {
  const slot = normalizeSlot({
    frequency: input.frequency ?? current?.frequency,
    dayOfWeek: input.dayOfWeek ?? current?.dayOfWeek,
    dayOfMonth: input.dayOfMonth ?? current?.dayOfMonth,
    hour: input.hour ?? current?.hour,
  })
  if (!slot) throw new CrudError("La frecuencia, el día o la hora no son válidos", 400, "frequency")
  let recipients: string[] | undefined
  if (input.recipients !== undefined || !current) {
    const { valid, invalid } = parseRecipients(input.recipients)
    if (invalid.length > 0) throw new CrudError(`Correo no válido: ${invalid[0]}`, 400, "recipients")
    if (valid.length === 0) throw new CrudError("Agrega al menos un correo", 400, "recipients")
    if (valid.length > MAX_RECIPIENTS) throw new CrudError(`Máximo ${MAX_RECIPIENTS} correos`, 400, "recipients")
    recipients = valid
  }
  return { slot, recipients }
}

export async function createSchedule(actor: Actor, input: Record<string, unknown>) {
  assertReportsUser(actor)
  const reportId = String(input.reportId ?? "")
  // Solo puede programar un reporte al que su propio rol ya tiene acceso.
  if (!listReports(actor).some((r) => r.id === reportId)) throw new CrudError("Reporte no disponible para tu rol", 403, "reportId")
  const { slot, recipients } = parseInput(input)
  const tz = await orgTimezone(actor.organizationId)
  const count = await prisma.reportSchedule.count({ where: { organizationId: actor.organizationId } })
  if (count >= 20) throw new CrudError("Ya tienes 20 envíos programados; elimina alguno", 409)
  const row = await prisma.reportSchedule.create({
    data: {
      organizationId: actor.organizationId,
      reportId,
      frequency: slot.frequency,
      dayOfWeek: slot.dayOfWeek,
      dayOfMonth: slot.dayOfMonth,
      hour: slot.hour,
      recipients: recipients!,
      includeCsv: input.includeCsv === true,
      isActive: input.isActive !== false,
      nextRunAt: nextRunAfter(slot, new Date(), tz),
      createdByUserId: actor.userId,
    },
  })
  return { id: row.id }
}

async function ownSchedule(actor: Actor, id: string) {
  assertReportsUser(actor)
  const row = await prisma.reportSchedule.findFirst({ where: { id, organizationId: actor.organizationId } })
  if (!row) throw new CrudError("Programación no encontrada", 404)
  return row
}

export async function updateSchedule(actor: Actor, id: string, input: Record<string, unknown>) {
  const row = await ownSchedule(actor, id)
  const { slot, recipients } = parseInput(input, row)
  const tz = await orgTimezone(actor.organizationId)
  const isActive = input.isActive === undefined ? row.isActive : input.isActive === true
  await prisma.reportSchedule.update({
    where: { id },
    data: {
      frequency: slot.frequency,
      dayOfWeek: slot.dayOfWeek,
      dayOfMonth: slot.dayOfMonth,
      hour: slot.hour,
      ...(recipients ? { recipients } : {}),
      ...(input.includeCsv !== undefined ? { includeCsv: input.includeCsv === true } : {}),
      isActive,
      nextRunAt: isActive ? nextRunAfter(slot, new Date(), tz) : null,
    },
  })
  return { ok: true }
}

export async function deleteSchedule(actor: Actor, id: string) {
  await ownSchedule(actor, id)
  await prisma.reportSchedule.delete({ where: { id } })
  return { ok: true }
}

// ── Ejecución ────────────────────────────────────────────────────────────────

/** Contexto con acceso de lectura a todos los reportes: lo que se envía ya lo autorizó quien programó. */
function systemActor(organizationId: string): Actor {
  return {
    userId: "system",
    organizationId,
    canViewAll: true,
    canManageAll: false,
    canViewCells: true,
    canViewGatherings: true,
    canViewEvents: true,
    canViewSchool: true,
    canViewFinance: true,
    canViewStats: true,
    canViewReports: true,
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

/** Arma y envía el reporte del periodo que le corresponde. */
async function deliver(row: Row, runAt: Date): Promise<void> {
  if (!mailConfigured()) throw new Error("El correo (SMTP) no está configurado en el servidor")
  const recipients = Array.isArray(row.recipients) ? row.recipients.map(String) : []
  if (recipients.length === 0) throw new Error("No hay destinatarios")
  const tz = await orgTimezone(row.organizationId)
  const frequency = row.frequency === "monthly" ? "monthly" : "weekly"
  const period = periodForRun(frequency, runAt, tz)
  // Los reportes programados llevan siempre el comparativo con el periodo anterior.
  const doc = await buildReportComparative(systemActor(row.organizationId), row.reportId, period, "previous")
  const [org, profile] = await Promise.all([
    prisma.organization.findUnique({ where: { id: row.organizationId }, select: { name: true } }),
    prisma.companyProfile.findUnique({ where: { organizationId: row.organizationId }, select: { tradeName: true, logoUrl: true } }),
  ])
  const churchName = profile?.tradeName ?? org?.name ?? "Iglesia"
  const pdf = await renderReportPdf(doc, { organizationName: churchName, logo: await loadLogoPng(profile?.logoUrl, 240) })
  const file = `reporte-${row.reportId}-${period.from}_${period.to}`
  const kpis = doc.kpis.map((k) => `<tr><td style="padding:6px 0;color:#64748b">${escapeHtml(k.label)}</td><td style="padding:6px 0;text-align:right;font-weight:700">${escapeHtml(k.value)}</td></tr>`).join("")
  await sendReportMail({
    to: recipients,
    churchName,
    subject: `${doc.title} · ${doc.periodLabel}`,
    title: doc.title,
    html: `<p style="line-height:1.6">Adjuntamos el reporte de <strong>${escapeHtml(doc.periodLabel.toLowerCase())}</strong>.</p>${
      kpis ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #e5e7eb">${kpis}</table>` : ""
    }<p style="font-size:13px;color:#626b76">También puedes consultarlo y exportarlo en el sistema, en Reportes.</p>`,
    attachments: [
      { filename: `${file}.pdf`, content: pdf, contentType: "application/pdf" },
      ...(row.includeCsv ? [{ filename: `${file}.csv`, content: Buffer.from(reportToCsv(doc), "utf8"), contentType: "text/csv; charset=utf-8" }] : []),
    ],
  })
}

async function record(row: Row, runAt: Date, error: string | null, advance: boolean) {
  const tz = await orgTimezone(row.organizationId)
  const slot: Slot = { frequency: row.frequency === "monthly" ? "monthly" : "weekly", dayOfWeek: row.dayOfWeek, dayOfMonth: row.dayOfMonth, hour: row.hour }
  await prisma.reportSchedule.update({
    where: { id: row.id },
    data: {
      lastRunAt: runAt,
      lastStatus: error ? "error" : "sent",
      lastError: error ? error.slice(0, 290) : null,
      ...(advance ? { nextRunAt: row.isActive ? nextRunAfter(slot, runAt, tz) : null } : {}),
    },
  })
}

/** «Enviar ahora»: manda el reporte del último periodo completo sin mover el calendario. */
export async function runScheduleNow(actor: Actor, id: string) {
  const row = await ownSchedule(actor, id)
  const now = new Date()
  try {
    await deliver(row, now)
    await record(row, now, null, false)
    return { ok: true, sent: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    await record(row, now, msg, false)
    throw new CrudError(msg, 502)
  }
}

/**
 * Procesa lo que ya toca enviar. Cada programación se «reclama» con una actualización
 * condicional de su `nextRunAt`, así dos servidores o dos llamadas simultáneas no la
 * envían doble.
 */
export async function runDueSchedules(now = new Date()): Promise<{ checked: number; sent: number; failed: number }> {
  const due = await prisma.reportSchedule.findMany({ where: { isActive: true, nextRunAt: { lte: now } }, take: 50, orderBy: { nextRunAt: "asc" } })
  let sent = 0
  let failed = 0
  for (const row of due) {
    const tz = await orgTimezone(row.organizationId)
    const slot: Slot = { frequency: row.frequency === "monthly" ? "monthly" : "weekly", dayOfWeek: row.dayOfWeek, dayOfMonth: row.dayOfMonth, hour: row.hour }
    const claimed = await prisma.reportSchedule.updateMany({
      where: { id: row.id, nextRunAt: row.nextRunAt },
      data: { nextRunAt: nextRunAfter(slot, now, tz) },
    })
    if (claimed.count === 0) continue
    try {
      await deliver(row, now)
      await record({ ...row, isActive: true }, now, null, false)
      sent += 1
    } catch (err) {
      await record({ ...row, isActive: true }, now, err instanceof Error ? err.message : "Error desconocido", false)
      failed += 1
    }
  }
  return { checked: due.length, sent, failed }
}
