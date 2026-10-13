import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { prisma } from "@/lib/db"
import { fireAndForget, notifyMembers } from "@/lib/notifications/church"
import { uploadsRoot } from "@/lib/uploads/storage"
import { renderDiplomaPdf } from "@/lib/school/diploma-pdf"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { STAGE_ORDER, encounterStageForEventKind, growthCheckForEventKind, stageIndex as idx, type GrowthCheck, type Stage } from "@/lib/school/growth-rules"

// Crecimiento en la visión ligado a la escuela y a los encuentros:
//  - Aprobar un libro de la Escuela de ministerio avanza al creyente a la etapa «Escuela».
//  - Asistir al Encuentro con Jesús lo lleva a «Encuentro» y al Lanzamiento (el segundo
//    encuentro) a «Lanzamiento». En el Lanzamiento se entrega el DIPLOMA de la escuela
//    a quien aprobó todos sus libros.
// El avance nunca retrocede: solo sube de etapa.

/** Sube de etapa (nunca baja) y deja constancia en la bitácora. Devuelve true si cambió. */
export async function advanceStage(organizationId: string, memberId: string, target: Stage, note: string, userId?: string | null): Promise<boolean> {
  const m = await prisma.member.findFirst({ where: { id: memberId, organizationId }, select: { visionStage: true } })
  if (!m || idx(target) <= idx(m.visionStage as Stage)) return false
  await prisma.$transaction([
    prisma.member.update({ where: { id: memberId }, data: { visionStage: target } }),
    prisma.memberStageLog.create({ data: { organizationId, memberId, stage: target, note: note.slice(0, 255), changedById: userId ?? null } }),
  ])
  return true
}

/** Libros activos de la Escuela de ministerio y cuáles aprobó la persona. */
export async function ministryProgress(organizationId: string, memberId: string) {
  const school = await prisma.school.findFirst({ where: { organizationId, kind: "ministry" }, select: { id: true, name: true } })
  if (!school) return null
  const [courses, passed] = await Promise.all([
    prisma.course.findMany({ where: { schoolId: school.id, isActive: true }, select: { id: true } }),
    prisma.enrollment.findMany({ where: { memberId, passed: true, group: { course: { schoolId: school.id } } }, select: { group: { select: { courseId: true } } } }),
  ])
  const passedIds = new Set(passed.map((p) => p.group.courseId))
  return {
    schoolId: school.id,
    schoolName: school.name,
    total: courses.length,
    passed: courses.filter((c) => passedIds.has(c.id)).length,
    complete: courses.length > 0 && courses.every((c) => passedIds.has(c.id)),
  }
}

/** Al aprobar un libro: etapa «Escuela» y, si completó todos, constancia en la bitácora. */
export async function onCoursePassed(organizationId: string, memberId: string, courseName: string, schoolKind: "ministry" | "university", userId?: string | null) {
  if (schoolKind !== "ministry") return
  await advanceStage(organizationId, memberId, "school", `Aprobó el libro «${courseName}»`, userId)
  const progress = await ministryProgress(organizationId, memberId)
  if (progress?.complete) {
    const m = await prisma.member.findFirst({ where: { id: memberId, organizationId }, select: { visionStage: true } })
    if (m) {
      await prisma.memberStageLog.create({
        data: { organizationId, memberId, stage: m.visionStage, note: `Completó los ${progress.total} libros de la Escuela de ministerio`, changedById: userId ?? null },
      })
    }
  }
}

async function nextSerial(organizationId: string, schoolId: string) {
  const year = new Date().getFullYear()
  const count = await prisma.diploma.count({ where: { organizationId, schoolId, serial: { startsWith: `DIP-${year}-` } } })
  return `DIP-${year}-${String(count + 1).padStart(4, "0")}`
}

/** Emite el diploma si completó todos los libros y aún no lo tiene. Devuelve el diploma o null. */
export async function issueDiplomaIfEligible(organizationId: string, memberId: string, eventId: string | null, userId?: string | null) {
  const progress = await ministryProgress(organizationId, memberId)
  if (!progress?.complete) return null
  const existing = await prisma.diploma.findUnique({ where: { schoolId_memberId: { schoolId: progress.schoolId, memberId } } })
  if (existing) return existing
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const created = await prisma.diploma.create({
        data: { organizationId, schoolId: progress.schoolId, memberId, serial: await nextSerial(organizationId, progress.schoolId), eventId, issuedByUserId: userId ?? null },
      })
      fireAndForget(
        notifyMembers(organizationId, [memberId], {
          kind: "diploma",
          severity: "success",
          title: "¡Felicidades! Tu diploma está listo",
          body: "Ya puedes verlo y descargarlo.",
          link: `/mi/escuela/diploma/${created.id}`,
        })
      )
      return created
    } catch (err) {
      if (!(typeof err === "object" && err && (err as { code?: string }).code === "P2002")) throw err
    }
  }
  return null
}

// ── Diplomas ─────────────────────────────────────────────────────────────────

export interface DiplomaDto {
  id: string
  serial: string
  issuedAt: string
  memberName: string
  schoolName: string
  organizationName: string
  eventName: string | null
  director: string | null
  subdirector: string | null
}

export async function getDiploma(actor: Actor, id: string): Promise<DiplomaDto> {
  const d = await prisma.diploma.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: {
      member: { select: { id: true, fullName: true, userId: true } },
      school: { include: { director: { select: { fullName: true } }, subdirector: { select: { fullName: true } } } },
      event: { select: { name: true } },
      organization: { select: { name: true } },
    },
  })
  if (!d) throw new CrudError("Diploma no encontrado", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const isOwner = memberId !== null && d.memberId === memberId
  if (!isOwner && !actor.canManageSchool && !actor.canViewSchool) throw new CrudError("Diploma no encontrado", 404)
  return {
    id: d.id,
    serial: d.serial,
    issuedAt: d.issuedAt.toISOString(),
    memberName: d.member.fullName,
    schoolName: d.school.name,
    organizationName: d.organization.name,
    eventName: d.event?.name ?? null,
    director: d.school.director?.fullName ?? null,
    subdirector: d.school.subdirector?.fullName ?? null,
  }
}

export async function listMyDiplomas(actor: Actor) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return []
  const rows = await prisma.diploma.findMany({ where: { organizationId: actor.organizationId, memberId }, include: { school: { select: { name: true } } }, orderBy: { issuedAt: "desc" } })
  return rows.map((d) => ({ id: d.id, serial: d.serial, schoolName: d.school.name, issuedAt: d.issuedAt.toISOString() }))
}

/** Emisión manual (excepción): requiere haber aprobado todos los libros. */
export async function issueDiplomaManually(actor: Actor, memberId: string) {
  if (!actor.canManageSchool) throw new CrudError("No tienes permiso para emitir diplomas", 403)
  const m = await prisma.member.findFirst({ where: { id: memberId, organizationId: actor.organizationId }, select: { id: true } })
  if (!m) throw new CrudError("Persona no encontrada", 404)
  const progress = await ministryProgress(actor.organizationId, memberId)
  if (!progress?.complete) throw new CrudError("La persona aún no aprueba todos los libros de la escuela", 409)
  const d = await issueDiplomaIfEligible(actor.organizationId, memberId, null, actor.userId)
  if (!d) throw new CrudError("No se pudo emitir el diploma", 500)
  return { id: d.id, serial: d.serial }
}

// ── Plantilla y PDF del diploma ──────────────────────────────────────────────

const TEMPLATE_LIMIT = 8 * 1024 * 1024
const TEMPLATE_MIME: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

function templatePath(organizationId: string, fileName: string) {
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(fileName)) throw new CrudError("Archivo inválido", 400)
  return path.join(uploadsRoot(), organizationId, "_docs", fileName)
}

async function managedSchool(actor: Actor, schoolId: string) {
  const school = await prisma.school.findFirst({ where: { id: schoolId, organizationId: actor.organizationId } })
  if (!school) throw new CrudError("Programa no encontrado", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const isDirector = memberId !== null && (school.directorMemberId === memberId || school.subdirectorMemberId === memberId)
  if (!actor.canManageSchool && !isDirector) throw new CrudError("No tienes permiso para configurar el diploma", 403)
  return school
}

export interface DiplomaConfigDto {
  schoolId: string
  schoolName: string
  mode: "generated" | "uploaded"
  hasTemplate: boolean
  templateKind: "pdf" | "image" | null
  nameX: number
  nameY: number
  nameSize: number
  nameColor: string
  showSerial: boolean
}

export async function getDiplomaConfig(actor: Actor, schoolId: string): Promise<DiplomaConfigDto> {
  const s = await managedSchool(actor, schoolId)
  return {
    schoolId: s.id,
    schoolName: s.name,
    mode: s.diplomaMode === "uploaded" ? "uploaded" : "generated",
    hasTemplate: Boolean(s.diplomaFile),
    templateKind: s.diplomaMime ? (s.diplomaMime === "application/pdf" ? "pdf" : "image") : null,
    nameX: s.diplomaNameX,
    nameY: s.diplomaNameY,
    nameSize: s.diplomaNameSize,
    nameColor: s.diplomaNameColor,
    showSerial: s.diplomaShowSerial,
  }
}

export async function saveDiplomaConfig(
  actor: Actor,
  schoolId: string,
  input: { mode?: unknown; nameX?: unknown; nameY?: unknown; nameSize?: unknown; nameColor?: unknown; showSerial?: unknown }
) {
  const s = await managedSchool(actor, schoolId)
  const mode = input.mode === "uploaded" ? "uploaded" : "generated"
  if (mode === "uploaded" && !s.diplomaFile) throw new CrudError("Sube primero la imagen o el PDF del diploma", 409, "mode")
  const frac = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
  }
  const color = typeof input.nameColor === "string" && /^#[0-9a-fA-F]{6}$/.test(input.nameColor) ? input.nameColor : s.diplomaNameColor
  await prisma.school.update({
    where: { id: schoolId },
    data: {
      diplomaMode: mode,
      diplomaNameX: frac(input.nameX, 0, 1, s.diplomaNameX),
      diplomaNameY: frac(input.nameY, 0, 1, s.diplomaNameY),
      diplomaNameSize: frac(input.nameSize, 0.02, 0.15, s.diplomaNameSize),
      diplomaNameColor: color,
      diplomaShowSerial: input.showSerial === undefined ? s.diplomaShowSerial : input.showSerial !== false,
    },
  })
  return { ok: true }
}

export async function uploadDiplomaTemplate(actor: Actor, schoolId: string, file: File) {
  const s = await managedSchool(actor, schoolId)
  const ext = TEMPLATE_MIME[file.type]
  if (!ext) throw new CrudError("Sube una imagen PNG, JPG o WEBP, o un PDF", 415)
  if (file.size > TEMPLATE_LIMIT) throw new CrudError("El archivo excede 8 MB", 413)
  const bytes = Buffer.from(await file.arrayBuffer())
  if (ext === "pdf") {
    try {
      const { PDFDocument } = await import("pdf-lib")
      const doc = await PDFDocument.load(bytes)
      if (doc.getPageCount() < 1) throw new Error("vacío")
    } catch {
      throw new CrudError("No se pudo leer el PDF", 400)
    }
  }
  const fileName = `diploma-${randomUUID()}.${ext}`
  const dir = path.join(uploadsRoot(), actor.organizationId, "_docs")
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, fileName), bytes)
  if (s.diplomaFile) await unlink(templatePath(actor.organizationId, s.diplomaFile)).catch(() => {})
  await prisma.school.update({ where: { id: schoolId }, data: { diplomaFile: fileName, diplomaMime: file.type, diplomaMode: "uploaded" } })
  return { ok: true }
}

export async function readDiplomaTemplate(actor: Actor, schoolId: string) {
  const s = await managedSchool(actor, schoolId)
  if (!s.diplomaFile || !s.diplomaMime) throw new CrudError("Aún no hay una plantilla", 404)
  const data = await readFile(templatePath(actor.organizationId, s.diplomaFile)).catch(() => null)
  if (!data) throw new CrudError("La plantilla ya no está disponible", 404)
  return { data, mime: s.diplomaMime }
}

interface SchoolTemplateFields {
  name: string
  diplomaMode: string
  diplomaFile: string | null
  diplomaMime: string | null
  diplomaNameX: number
  diplomaNameY: number
  diplomaNameSize: number
  diplomaNameColor: string
  diplomaShowSerial: boolean
}

async function renderFor(
  organizationId: string,
  school: SchoolTemplateFields,
  extra: { name: string; serial: string; issuedAt: Date; eventName: string | null; organizationName: string; director: string | null; subdirector: string | null }
) {
  const useUploaded = school.diplomaMode === "uploaded" && school.diplomaFile && school.diplomaMime
  const template = useUploaded ? await readFile(templatePath(organizationId, school.diplomaFile!)).catch(() => null) : null
  return renderDiplomaPdf({
    ...extra,
    schoolName: school.name,
    mode: useUploaded && template ? "uploaded" : "generated",
    template: template ? { bytes: template, mime: school.diplomaMime! } : null,
    placement: {
      x: school.diplomaNameX,
      y: school.diplomaNameY,
      size: school.diplomaNameSize,
      color: school.diplomaNameColor,
      showSerial: school.diplomaShowSerial,
    },
  })
}

/** PDF de ejemplo con la plantilla y la posición guardadas (para ajustarla). */
export async function renderSampleDiploma(actor: Actor, schoolId: string) {
  const s = await managedSchool(actor, schoolId)
  const [org, dir, sub] = await Promise.all([
    prisma.organization.findUnique({ where: { id: actor.organizationId }, select: { name: true } }),
    s.directorMemberId ? prisma.member.findUnique({ where: { id: s.directorMemberId }, select: { fullName: true } }) : null,
    s.subdirectorMemberId ? prisma.member.findUnique({ where: { id: s.subdirectorMemberId }, select: { fullName: true } }) : null,
  ])
  return renderFor(actor.organizationId, s, {
    name: "María Fernanda Gómez Ruiz",
    serial: "DIP-0000-0001",
    issuedAt: new Date(),
    eventName: null,
    organizationName: org?.name ?? "",
    director: dir?.fullName ?? null,
    subdirector: sub?.fullName ?? null,
  })
}

/** PDF del diploma entregado (su dueño o la administración de la escuela). */
export async function renderDiplomaPdfFor(actor: Actor, diplomaId: string) {
  const d = await prisma.diploma.findFirst({
    where: { id: diplomaId, organizationId: actor.organizationId },
    include: {
      member: { select: { fullName: true } },
      school: true,
      event: { select: { name: true } },
      organization: { select: { name: true } },
    },
  })
  if (!d) throw new CrudError("Diploma no encontrado", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if ((memberId === null || d.memberId !== memberId) && !actor.canManageSchool) throw new CrudError("Diploma no encontrado", 404)
  const [dir, sub] = await Promise.all([
    d.school.directorMemberId ? prisma.member.findUnique({ where: { id: d.school.directorMemberId }, select: { fullName: true } }) : null,
    d.school.subdirectorMemberId ? prisma.member.findUnique({ where: { id: d.school.subdirectorMemberId }, select: { fullName: true } }) : null,
  ])
  const pdf = await renderFor(actor.organizationId, d.school, {
    name: d.member.fullName,
    serial: d.serial,
    issuedAt: d.issuedAt,
    eventName: d.event?.name ?? null,
    organizationName: d.organization.name,
    director: dir?.fullName ?? null,
    subdirector: sub?.fullName ?? null,
  })
  return { pdf, fileName: `diploma-${d.serial}.pdf` }
}

// ── Entrega al finalizar el Lanzamiento ──────────────────────────────────────

export interface LaunchResultDto {
  issued: { memberId: string; name: string; serial: string }[]
  /** Asistieron pero aún no completan los libros. */
  pending: { memberId: string; name: string; passed: number; total: number }[]
  /** Ya tenían su diploma. */
  already: number
}

/** Al finalizar el Lanzamiento: entrega el diploma a quienes asistieron y completaron la escuela. */
export async function deliverLaunchDiplomas(
  organizationId: string,
  event: { id: string; kind: string },
  userId: string | null
): Promise<LaunchResultDto> {
  const out: LaunchResultDto = { issued: [], pending: [], already: 0 }
  if (encounterStageForEventKind(event.kind) !== "launch") return out
  const attendees = await prisma.eventTicket.findMany({
    where: { eventId: event.id, organizationId, status: { not: "cancelled" }, checkedInAt: { not: null }, memberId: { not: null } },
    select: { memberId: true, member: { select: { fullName: true } } },
  })
  for (const a of attendees) {
    const memberId = a.memberId!
    const progress = await ministryProgress(organizationId, memberId)
    if (!progress) continue
    const existing = await prisma.diploma.findUnique({ where: { schoolId_memberId: { schoolId: progress.schoolId, memberId } } })
    if (existing) {
      out.already += 1
      continue
    }
    if (!progress.complete) {
      out.pending.push({ memberId, name: a.member?.fullName ?? "Persona", passed: progress.passed, total: progress.total })
      continue
    }
    const d = await issueDiplomaIfEligible(organizationId, memberId, event.id, userId)
    if (d) out.issued.push({ memberId, name: a.member?.fullName ?? "Persona", serial: d.serial })
  }
  return out
}

// ── Mi avance hacia el diploma ───────────────────────────────────────────────

export interface DiplomaJourneyDto {
  schoolName: string
  total: number
  passed: number
  books: { id: string; name: string; status: "passed" | "studying" | "pending" }[]
  /** Etapa actual de su camino. */
  stage: Stage
  /** Marcas del camino (se ponen al finalizar cada evento). */
  baptized: boolean
  baptizedAt: string | null
  encounterDone: boolean
  encounterAt: string | null
  /** Ya asistió al Lanzamiento (donde se entrega el diploma). */
  launchDone: boolean
  launchAt: string | null
  hasDiploma: boolean
}

export async function myDiplomaJourney(actor: Actor): Promise<DiplomaJourneyDto | null> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return null
  const school = await prisma.school.findFirst({ where: { organizationId: actor.organizationId, kind: "ministry" }, select: { id: true, name: true } })
  if (!school) return null
  const [courses, enrollments, member, diploma] = await Promise.all([
    prisma.course.findMany({ where: { schoolId: school.id, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.enrollment.findMany({
      where: { memberId, group: { course: { schoolId: school.id } } },
      select: { passed: true, status: true, group: { select: { courseId: true } } },
    }),
    prisma.member.findFirst({
      where: { id: memberId, organizationId: actor.organizationId },
      select: { visionStage: true, baptizedWater: true, baptizedWaterAt: true, encounterAt: true, launchAt: true },
    }),
    prisma.diploma.findUnique({ where: { schoolId_memberId: { schoolId: school.id, memberId } }, select: { id: true } }),
  ])
  if (courses.length === 0) return null
  const passedIds = new Set(enrollments.filter((e) => e.passed).map((e) => e.group.courseId))
  const studyingIds = new Set(enrollments.filter((e) => e.status === "enrolled").map((e) => e.group.courseId))
  const stage = (STAGE_ORDER as readonly string[]).includes(member?.visionStage ?? "") ? (member!.visionStage as Stage) : "win"
  const books = courses.map((c) => ({
    id: c.id,
    name: c.name,
    status: passedIds.has(c.id) ? ("passed" as const) : studyingIds.has(c.id) ? ("studying" as const) : ("pending" as const),
  }))
  return {
    schoolName: school.name,
    total: courses.length,
    passed: books.filter((b) => b.status === "passed").length,
    books,
    stage,
    baptized: Boolean(member?.baptizedWater),
    baptizedAt: member?.baptizedWaterAt ? member.baptizedWaterAt.toISOString().slice(0, 10) : null,
    encounterDone: Boolean(member?.encounterAt),
    encounterAt: member?.encounterAt ? member.encounterAt.toISOString().slice(0, 10) : null,
    launchDone: Boolean(member?.launchAt),
    launchAt: member?.launchAt ? member.launchAt.toISOString().slice(0, 10) : null,
    hasDiploma: Boolean(diploma),
  }
}

// ── Marcas del camino al finalizar el evento ─────────────────────────────────

export interface GrowthResultDto {
  check: GrowthCheck
  /** Personas a las que se les marcó ahora. */
  marked: { memberId: string; name: string }[]
  /** Ya tenían la marca. */
  already: number
  /** Con boleto que no registraron entrada (no se marcan). */
  absent: number
  /** Solo en el Lanzamiento. */
  diplomas: LaunchResultDto | null
}

const dateOnly = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`)

/**
 * Al finalizar un Bautismo en aguas, Encuentro con Jesús o Lanzamiento: a quienes
 * registraron su entrada se les marca el check en su crecimiento. Es idempotente.
 */
export async function completeGrowthEvent(
  organizationId: string,
  event: { id: string; name: string; kind: string; startsAt: Date },
  userId: string | null
): Promise<GrowthResultDto | null> {
  const check = growthCheckForEventKind(event.kind)
  if (!check) return null
  const tickets = await prisma.eventTicket.findMany({
    where: { eventId: event.id, organizationId, status: { not: "cancelled" } },
    select: { memberId: true, checkedInAt: true, member: { select: { fullName: true, baptizedWater: true, encounterAt: true, launchAt: true } } },
  })
  const at = dateOnly(event.startsAt)
  const out: GrowthResultDto = { check, marked: [], already: 0, absent: 0, diplomas: null }
  for (const t of tickets) {
    if (!t.memberId || !t.member) continue
    if (!t.checkedInAt) {
      out.absent += 1
      continue
    }
    const name = t.member.fullName
    if (check === "baptism") {
      if (t.member.baptizedWater) {
        out.already += 1
        continue
      }
      const m = await prisma.member.update({
        where: { id: t.memberId },
        data: { baptizedWater: true, baptizedWaterAt: at },
        select: { visionStage: true },
      })
      await prisma.memberStageLog.create({
        data: { organizationId, memberId: t.memberId, stage: m.visionStage, note: `Bautismo en aguas: «${event.name}»`.slice(0, 255), changedById: userId },
      })
    } else if (check === "encounter") {
      if (t.member.encounterAt) {
        out.already += 1
        continue
      }
      await prisma.member.update({ where: { id: t.memberId }, data: { encounterAt: at } })
      await advanceStage(organizationId, t.memberId, "encounter", `Asistió a «${event.name}»`, userId)
    } else {
      if (t.member.launchAt) {
        out.already += 1
        continue
      }
      await prisma.member.update({ where: { id: t.memberId }, data: { launchAt: at } })
      await advanceStage(organizationId, t.memberId, "launch", `Asistió a «${event.name}»`, userId)
    }
    out.marked.push({ memberId: t.memberId, name })
  }
  if (out.marked.length > 0) {
    const label = { baptism: "Bautismo en aguas", encounter: "Encuentro con Jesús", launch: "Lanzamiento" }[check]
    fireAndForget(
      notifyMembers(organizationId, out.marked.map((m) => m.memberId), {
        kind: "growth",
        severity: "success",
        title: `${label}: ¡un paso más en tu camino!`,
        body: "Quedó registrado en tu crecimiento.",
        link: "/mi",
      })
    )
  }
  if (check === "launch") out.diplomas = await deliverLaunchDiplomas(organizationId, { id: event.id, kind: event.kind }, userId)
  return out
}
