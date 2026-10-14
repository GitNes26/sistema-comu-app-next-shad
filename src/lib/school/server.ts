import { prisma } from "@/lib/db"
import { fireAndForget, notifyMembers } from "@/lib/notifications/church"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { documentsForEnrollment } from "@/lib/school/documents"
import { listMyDiplomas, myDiplomaJourney, onCoursePassed, type DiplomaJourneyDto } from "@/lib/school/growth"
import {
  QUESTION_TYPES,
  averageOver,
  canEnroll,
  enrollmentBalance,
  finalGrade,
  gradeQuestion,
  isPassing,
  isQuestionType,
  percentToGrade,
  sanitizeQuestionConfig,
  studentView,
  submissionPercent,
  type QuestionConfig,
  type QuestionTypeKey,
} from "@/lib/school/rules"

// Escuela ministerial: Escuela de ministerio (libros en orden) y Universidad
// Teológica, con su plataforma educativa (material por semana, tareas y ejercicios
// con 7 tipos de pregunta, pase de lista, calificaciones y planilla).
//
// Acceso por RELACIÓN, nunca por reasignar el rol base:
//  - Administración (`school.manage`), director o subdirector: configura el programa.
//  - Maestro / apoyo de un grupo: pasa lista, califica y ve la planilla de su grupo.
//  - Alumno: ve su inscripción, su material, responde y ve sus notas.
//  - Cualquier creyente: ve el catálogo y solicita inscripción.

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const money = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null
}
const toDate = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null
  const d = new Date(`${v.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const num = (d: { toString(): string } | null | undefined) => (d === null || d === undefined ? null : Number(d.toString()))

// ── Acceso ───────────────────────────────────────────────────────────────────

async function schoolManage(actor: Actor, schoolId: string): Promise<{ school: NonNullable<Awaited<ReturnType<typeof loadSchool>>>; memberId: string | null }> {
  const school = await loadSchool(actor.organizationId, schoolId)
  if (!school) throw new CrudError("Programa no encontrado", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const isDirector = memberId !== null && (school.directorMemberId === memberId || school.subdirectorMemberId === memberId)
  if (!actor.canManageSchool && !isDirector) throw new CrudError("No tienes permiso para configurar la escuela", 403)
  return { school, memberId }
}
function loadSchool(organizationId: string, id: string) {
  return prisma.school.findFirst({ where: { id, organizationId } })
}

interface GroupAccess {
  group: NonNullable<Awaited<ReturnType<typeof loadGroup>>>
  memberId: string | null
  canManage: boolean
  isTeacher: boolean
  /** Maestro, apoyo, director o administración. */
  canTeach: boolean
  canView: boolean
}
function loadGroup(organizationId: string, id: string) {
  return prisma.courseGroup.findFirst({
    where: { id, organizationId },
    include: {
      course: { include: { school: true } },
      teacher: { select: { fullName: true } },
      assistant: { select: { fullName: true } },
    },
  })
}
async function groupAccess(actor: Actor, groupId: string): Promise<GroupAccess> {
  const group = await loadGroup(actor.organizationId, groupId)
  if (!group) throw new CrudError("Grupo no encontrado", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const school = group.course.school
  const isDirector = memberId !== null && (school.directorMemberId === memberId || school.subdirectorMemberId === memberId)
  const canManage = Boolean(actor.canManageSchool) || isDirector
  const isTeacher = memberId !== null && (group.teacherMemberId === memberId || group.assistantMemberId === memberId)
  const canTeach = canManage || isTeacher
  const canView = canTeach || Boolean(actor.canViewSchool)
  return { group, memberId, canManage, isTeacher, canTeach, canView }
}

async function ensureSchools(organizationId: string) {
  const count = await prisma.school.count({ where: { organizationId } })
  if (count >= 2) return
  const existing = new Set((await prisma.school.findMany({ where: { organizationId }, select: { kind: true } })).map((s) => s.kind))
  if (!existing.has("ministry")) {
    await prisma.school.create({
      data: { organizationId, kind: "ministry", name: "Escuela de ministerio", description: "El proceso para formar líderes, libro por libro." },
    })
  }
  if (!existing.has("university")) {
    await prisma.school.create({
      data: { organizationId, kind: "university", name: "Universidad Teológica", description: "Cursos de teología impartidos por el pastor o discípulos que ya los cursaron." },
    })
  }
}

// ── Catálogo y portal del alumno ─────────────────────────────────────────────

export interface GroupLiteDto {
  id: string
  name: string
  status: "planned" | "open" | "closed"
  teacherName: string | null
  assistantName: string | null
  startDate: string | null
  endDate: string | null
  capacity: number | null
  enrolled: number
}
export interface CourseDto {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  sortOrder: number
  weeks: number
  tasksCount: number
  exercisesCount: number
  enrollmentFee: number
  bookPrice: number
  digitalBookUrl: string | null
  isActive: boolean
  /** Para quien consulta: aprobado antes, o puede inscribirse ahora. */
  passed: boolean
  groups: GroupLiteDto[]
}
export interface EnrollmentLiteDto {
  id: string
  status: "requested" | "enrolled" | "completed" | "failed" | "dropped" | "rejected"
  courseName: string
  schoolKind: "ministry" | "university"
  groupName: string
  finalGrade: number | null
  passed: boolean | null
  balance: number
}
export interface SchoolDto {
  id: string
  kind: "ministry" | "university"
  name: string
  description: string | null
  directorName: string | null
  subdirectorName: string | null
  directorMemberId: string | null
  subdirectorMemberId: string | null
  passScore: number
  enrollmentFee: number
  isActive: boolean
  courses: CourseDto[]
  canManage: boolean
  /** Inscripción activa o en trámite en este programa (solo se puede una). */
  blockedReason: string | null
}
export interface SchoolOverviewDto {
  schools: SchoolDto[]
  mine: EnrollmentLiteDto[]
  /** Grupos que enseña (maestro o apoyo). */
  teaching: { id: string; name: string; courseName: string; schoolKind: "ministry" | "university"; status: string; enrolled: number }[]
  access: { canManage: boolean; canView: boolean }
  /** Diplomas recibidos. */
  diplomas: { id: string; serial: string; schoolName: string; issuedAt: string }[]
  /** Avance de la persona hacia el diploma (libros aprobados y Lanzamiento). */
  journey: DiplomaJourneyDto | null
}

export async function getOverview(actor: Actor): Promise<SchoolOverviewDto> {
  await ensureSchools(actor.organizationId)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const [schools, myEnrollments, teaching] = await Promise.all([
    prisma.school.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { kind: "asc" },
      include: {
        director: { select: { fullName: true } },
        subdirector: { select: { fullName: true } },
        courses: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            groups: {
              where: { status: { in: ["planned", "open"] } },
              include: {
                teacher: { select: { fullName: true } },
                assistant: { select: { fullName: true } },
                _count: { select: { enrollments: { where: { status: { in: ["enrolled", "requested"] } } } } },
              },
              orderBy: { startDate: "asc" },
            },
          },
        },
      },
    }),
    memberId
      ? prisma.enrollment.findMany({
          where: { organizationId: actor.organizationId, memberId },
          include: { group: { include: { course: { include: { school: { select: { kind: true } } } } } }, payments: true },
          orderBy: { requestedAt: "desc" },
        })
      : Promise.resolve([]),
    memberId
      ? prisma.courseGroup.findMany({
          where: { organizationId: actor.organizationId, OR: [{ teacherMemberId: memberId }, { assistantMemberId: memberId }], status: { not: "closed" } },
          include: { course: { include: { school: { select: { kind: true } } } }, _count: { select: { enrollments: { where: { status: "enrolled" } } } } },
        })
      : Promise.resolve([]),
  ])

  const mine: EnrollmentLiteDto[] = myEnrollments.map((e) => ({
    id: e.id,
    status: e.status,
    courseName: e.group.course.name,
    schoolKind: e.group.course.school.kind,
    groupName: e.group.name,
    finalGrade: num(e.finalGrade),
    passed: e.passed,
    balance: enrollmentBalance(Number(e.fee), Number(e.bookPrice), e.wantsBook, e.payments.map((p) => Number(p.amount))),
  }))

  const out: SchoolDto[] = schools.map((s) => {
    const history = myEnrollments.filter((e) => e.group.course.schoolId === s.id)
    const active = history.find((e) => e.status === "enrolled" || e.status === "requested")
    return {
      id: s.id,
      kind: s.kind,
      name: s.name,
      description: s.description,
      directorName: s.director?.fullName ?? null,
      subdirectorName: s.subdirector?.fullName ?? null,
      directorMemberId: s.directorMemberId,
      subdirectorMemberId: s.subdirectorMemberId,
      passScore: Number(s.passScore),
      enrollmentFee: Number(s.enrollmentFee),
      isActive: s.isActive,
      canManage: Boolean(actor.canManageSchool) || (memberId !== null && (s.directorMemberId === memberId || s.subdirectorMemberId === memberId)),
      blockedReason: active ? `Ya estás en «${active.group.course.name}»; solo se puede un libro a la vez` : null,
      courses: s.courses.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        sortOrder: c.sortOrder,
        weeks: c.weeks,
        tasksCount: c.tasksCount,
        exercisesCount: c.exercisesCount,
        enrollmentFee: c.enrollmentFee !== null ? Number(c.enrollmentFee) : Number(s.enrollmentFee),
        bookPrice: Number(c.bookPrice),
        digitalBookUrl: null,
        isActive: c.isActive,
        passed: history.some((e) => e.group.courseId === c.id && e.passed === true),
        groups: c.groups.map((g) => ({
          id: g.id,
          name: g.name,
          status: g.status,
          teacherName: g.teacher?.fullName ?? null,
          assistantName: g.assistant?.fullName ?? null,
          startDate: ymd(g.startDate),
          endDate: ymd(g.endDate),
          capacity: g.capacity,
          enrolled: g._count.enrollments,
        })),
      })),
    }
  })

  return {
    schools: out,
    mine,
    teaching: teaching.map((g) => ({
      id: g.id,
      name: g.name,
      courseName: g.course.name,
      schoolKind: g.course.school.kind,
      status: g.status,
      enrolled: g._count.enrollments,
    })),
    access: { canManage: Boolean(actor.canManageSchool), canView: Boolean(actor.canViewSchool || actor.canManageSchool) },
    diplomas: await listMyDiplomas(actor),
    journey: await myDiplomaJourney(actor),
  }
}

// ── Administración: programa, libros, material ───────────────────────────────

export async function saveSchool(actor: Actor, schoolId: string, input: Record<string, unknown>) {
  await schoolManage(actor, schoolId)
  const name = text(input.name, 100)
  if (!name) throw new CrudError("Escribe el nombre del programa", 400, "name")
  const passScore = input.passScore === undefined ? undefined : money(input.passScore)
  if (passScore !== undefined && (passScore === null || passScore > 10)) throw new CrudError("La calificación mínima va de 0 a 10", 400, "passScore")
  const fee = input.enrollmentFee === undefined ? undefined : money(input.enrollmentFee)
  if (fee === null) throw new CrudError("Costo inválido", 400, "enrollmentFee")
  const ids: Record<string, string | null> = {}
  for (const key of ["directorMemberId", "subdirectorMemberId"] as const) {
    if (input[key] === undefined) continue
    const v = text(input[key], 40)
    if (v) {
      const ok = await prisma.member.findFirst({ where: { id: v, organizationId: actor.organizationId, isActive: true }, select: { id: true } })
      if (!ok) throw new CrudError("Persona no válida", 400, key)
    }
    ids[key] = v
  }
  await prisma.school.update({
    where: { id: schoolId },
    data: { name, description: input.description !== undefined ? text(input.description, 1000) : undefined, passScore: passScore ?? undefined, enrollmentFee: fee ?? undefined, ...ids },
  })
  return { id: schoolId }
}

export async function saveCourse(actor: Actor, schoolId: string, id: string | null, input: Record<string, unknown>) {
  await schoolManage(actor, schoolId)
  const name = text(input.name, 120)
  if (!name) throw new CrudError("Escribe el nombre del libro", 400, "name")
  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = v === undefined || v === "" ? fallback : Number(v)
    if (!Number.isInteger(n) || n < min || n > max) throw new CrudError(`Valor inválido (${min}–${max})`, 400)
    return n
  }
  const fee = input.enrollmentFee === undefined || input.enrollmentFee === null || input.enrollmentFee === "" ? null : money(input.enrollmentFee)
  const book = input.bookPrice === undefined || input.bookPrice === "" ? 0 : money(input.bookPrice)
  if (book === null || (input.enrollmentFee !== undefined && input.enrollmentFee !== null && input.enrollmentFee !== "" && fee === null)) throw new CrudError("Costo inválido", 400)
  const data = {
    name,
    description: text(input.description, 2000),
    imageUrl: text(input.imageUrl, 500),
    sortOrder: int(input.sortOrder, 0, 99, 0),
    weeks: int(input.weeks, 1, 52, 8),
    tasksCount: int(input.tasksCount, 0, 30, 7),
    exercisesCount: int(input.exercisesCount, 0, 30, 7),
    enrollmentFee: fee,
    bookPrice: book,
    digitalBookUrl: text(input.digitalBookUrl, 500),
    ...(input.isActive !== undefined ? { isActive: input.isActive !== false } : {}),
  }
  try {
    if (id) {
      const r = await prisma.course.updateMany({ where: { id, schoolId, organizationId: actor.organizationId }, data })
      if (r.count === 0) throw new CrudError("Libro no encontrado", 404)
      return { id }
    }
    const row = await prisma.course.create({ data: { ...data, organizationId: actor.organizationId, schoolId } })
    return { id: row.id }
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") throw new CrudError("Ya existe un libro con ese nombre", 409, "name")
    throw err
  }
}

export async function courseManage(actor: Actor, courseId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, organizationId: actor.organizationId }, include: { school: true } })
  if (!course) throw new CrudError("Libro no encontrado", 404)
  await schoolManage(actor, course.schoolId)
  return course
}

export interface CourseAdminDto {
  course: CourseDto & { schoolId: string; schoolKind: "ministry" | "university"; passScore: number }
  contents: { id: string; week: number; title: string; type: string; url: string | null; body: string | null; isPublished: boolean }[]
  assessments: { id: string; kind: "task" | "exercise"; number: number; week: number | null; title: string; isPublished: boolean; questions: number; submissions: number }[]
}

export async function getCourseAdmin(actor: Actor, courseId: string): Promise<CourseAdminDto> {
  const c = await courseManage(actor, courseId)
  const [contents, assessments, groups] = await Promise.all([
    prisma.courseContent.findMany({ where: { courseId }, orderBy: [{ week: "asc" }, { sortOrder: "asc" }] }),
    prisma.assessment.findMany({
      where: { courseId },
      orderBy: [{ kind: "asc" }, { number: "asc" }],
      include: { _count: { select: { questions: true, submissions: true } } },
    }),
    prisma.courseGroup.findMany({
      where: { courseId, organizationId: actor.organizationId },
      include: { teacher: { select: { fullName: true } }, assistant: { select: { fullName: true } }, _count: { select: { enrollments: { where: { status: { in: ["enrolled", "requested"] } } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ])
  return {
    course: {
      id: c.id,
      name: c.name,
      description: c.description,
      imageUrl: c.imageUrl,
      sortOrder: c.sortOrder,
      weeks: c.weeks,
      tasksCount: c.tasksCount,
      exercisesCount: c.exercisesCount,
      enrollmentFee: c.enrollmentFee !== null ? Number(c.enrollmentFee) : Number(c.school.enrollmentFee),
      bookPrice: Number(c.bookPrice),
      digitalBookUrl: c.digitalBookUrl,
      isActive: c.isActive,
      passed: false,
      schoolId: c.schoolId,
      schoolKind: c.school.kind,
      passScore: Number(c.school.passScore),
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        status: g.status,
        teacherName: g.teacher?.fullName ?? null,
        assistantName: g.assistant?.fullName ?? null,
        startDate: ymd(g.startDate),
        endDate: ymd(g.endDate),
        capacity: g.capacity,
        enrolled: g._count.enrollments,
      })),
    },
    contents: contents.map((x) => ({ id: x.id, week: x.week, title: x.title, type: x.type, url: x.url, body: x.body, isPublished: x.isPublished })),
    assessments: assessments.map((a) => ({
      id: a.id,
      kind: a.kind,
      number: a.number,
      week: a.week,
      title: a.title,
      isPublished: a.isPublished,
      questions: a._count.questions,
      submissions: a._count.submissions,
    })),
  }
}

export async function saveContent(actor: Actor, courseId: string, id: string | null, input: Record<string, unknown>) {
  const course = await courseManage(actor, courseId)
  const title = text(input.title, 150)
  if (!title) throw new CrudError("Escribe el título del material", 400, "title")
  const week = Number(input.week)
  if (!Number.isInteger(week) || week < 1 || week > course.weeks) throw new CrudError(`La semana va de 1 a ${course.weeks}`, 400, "week")
  const type = ["text", "pdf", "video", "link", "image"].includes(String(input.type)) ? (String(input.type) as "text" | "pdf" | "video" | "link" | "image") : "text"
  const url = text(input.url, 500)
  if (type !== "text" && !url) throw new CrudError("Agrega el enlace del material", 400, "url")
  if (url && !/^(https?:\/\/|\/)/.test(url)) throw new CrudError("El enlace debe iniciar con http:// o https://", 400, "url")
  const data = { title, week, type, url, body: type === "text" ? text(input.body, 20000) : null, isPublished: input.isPublished !== false }
  if (id) {
    const r = await prisma.courseContent.updateMany({ where: { id, courseId, organizationId: actor.organizationId }, data })
    if (r.count === 0) throw new CrudError("Material no encontrado", 404)
    return { id }
  }
  const row = await prisma.courseContent.create({ data: { ...data, organizationId: actor.organizationId, courseId } })
  return { id: row.id }
}

export async function deleteContent(actor: Actor, courseId: string, id: string) {
  await courseManage(actor, courseId)
  const r = await prisma.courseContent.deleteMany({ where: { id, courseId, organizationId: actor.organizationId } })
  if (r.count === 0) throw new CrudError("Material no encontrado", 404)
  return { ok: true }
}

// ── Cuestionarios (tareas y ejercicios) ──────────────────────────────────────

export interface QuestionAdminDto {
  id?: string
  type: QuestionTypeKey
  prompt: string
  imageUrl: string | null
  videoUrl: string | null
  points: number
  /** Configuración completa (con respuestas correctas): solo para quien administra. */
  config: Record<string, unknown>
}
export interface AssessmentAdminDto {
  id: string
  courseId: string
  kind: "task" | "exercise"
  number: number
  week: number | null
  title: string
  instructions: string | null
  maxAttempts: number
  timeLimitMin: number | null
  isPublished: boolean
  submissions: number
  questions: QuestionAdminDto[]
}

const configForEditor = (c: QuestionConfig): Record<string, unknown> => {
  const { kind, ...rest } = c
  void kind
  return rest
}

export async function getAssessmentAdmin(actor: Actor, assessmentId: string): Promise<AssessmentAdminDto> {
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, organizationId: actor.organizationId },
    include: { questions: { orderBy: { sortOrder: "asc" } }, _count: { select: { submissions: true } } },
  })
  if (!a) throw new CrudError("Actividad no encontrada", 404)
  await courseManage(actor, a.courseId)
  return {
    id: a.id,
    courseId: a.courseId,
    kind: a.kind,
    number: a.number,
    week: a.week,
    title: a.title,
    instructions: a.instructions,
    maxAttempts: a.maxAttempts,
    timeLimitMin: a.timeLimitMin,
    isPublished: a.isPublished,
    submissions: a._count.submissions,
    questions: a.questions.map((q) => {
      let config: Record<string, unknown> = {}
      try {
        config = configForEditor(sanitizeQuestionConfig(q.type, q.config, q.prompt))
      } catch {
        config = (q.config ?? {}) as Record<string, unknown>
      }
      return { id: q.id, type: q.type, prompt: q.prompt, imageUrl: q.imageUrl, videoUrl: q.videoUrl, points: Number(q.points), config }
    }),
  }
}

export async function saveAssessment(actor: Actor, courseId: string, id: string | null, input: Record<string, unknown>) {
  const course = await courseManage(actor, courseId)
  const kind = input.kind === "exercise" ? "exercise" : "task"
  const limit = kind === "task" ? course.tasksCount : course.exercisesCount
  const number = Number(input.number)
  if (!Number.isInteger(number) || number < 1 || number > Math.max(1, limit)) throw new CrudError(`El número va de 1 a ${limit}`, 400, "number")
  const title = text(input.title, 150)
  if (!title) throw new CrudError("Escribe el título", 400, "title")
  const maxAttempts = Number(input.maxAttempts ?? 1)
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new CrudError("Intentos: de 1 a 10", 400, "maxAttempts")
  const timeLimit = input.timeLimitMin === null || input.timeLimitMin === undefined || input.timeLimitMin === "" ? null : Number(input.timeLimitMin)
  if (timeLimit !== null && (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 600)) throw new CrudError("Tiempo límite inválido (minutos)", 400, "timeLimitMin")
  const week = input.week === null || input.week === undefined || input.week === "" ? null : Number(input.week)
  if (week !== null && (!Number.isInteger(week) || week < 1 || week > course.weeks)) throw new CrudError(`La semana va de 1 a ${course.weeks}`, 400, "week")

  // Preguntas: se validan todas antes de tocar la base.
  const rawQuestions = Array.isArray(input.questions) ? input.questions.slice(0, 40) : null
  const questions = rawQuestions?.map((q, i) => {
    const o = (q ?? {}) as Record<string, unknown>
    if (!isQuestionType(o.type)) throw new CrudError(`Pregunta ${i + 1}: tipo no válido`, 400, "questions")
    const prompt = text(o.prompt, 4000)
    if (!prompt) throw new CrudError(`Pregunta ${i + 1}: escribe el enunciado`, 400, "questions")
    const points = money(o.points ?? 1)
    if (points === null || points <= 0) throw new CrudError(`Pregunta ${i + 1}: los puntos deben ser mayores a cero`, 400, "questions")
    let config: QuestionConfig
    try {
      config = sanitizeQuestionConfig(o.type, o.config, prompt)
    } catch (err) {
      throw new CrudError(`Pregunta ${i + 1}: ${err instanceof Error ? err.message : "configuración inválida"}`, 400, "questions")
    }
    const { kind: _k, ...stored } = config
    void _k
    return {
      type: o.type as QuestionTypeKey,
      prompt,
      imageUrl: text(o.imageUrl, 500),
      videoUrl: text(o.videoUrl, 500),
      points,
      sortOrder: i,
      config: stored,
    }
  })
  const publish = input.isPublished === true
  if (publish && (questions?.length ?? 0) === 0 && !id) throw new CrudError("Agrega al menos una pregunta antes de publicar", 400, "questions")

  const base = { kind, number, title, instructions: text(input.instructions, 4000), maxAttempts, timeLimitMin: timeLimit, week, isPublished: publish } as const
  try {
    return await prisma.$transaction(async (tx) => {
      let assessmentId = id
      if (id) {
        const found = await tx.assessment.findFirst({ where: { id, courseId, organizationId: actor.organizationId }, select: { id: true, _count: { select: { submissions: true } } } })
        if (!found) throw new CrudError("Actividad no encontrada", 404)
        await tx.assessment.update({ where: { id }, data: base })
        if (questions) {
          if (found._count.submissions > 0) throw new CrudError("Ya hay envíos; las preguntas no se pueden reemplazar. Duplica la actividad si necesitas cambiarlas.", 409, "questions")
          await tx.question.deleteMany({ where: { assessmentId: id } })
        }
      } else {
        const created = await tx.assessment.create({ data: { ...base, organizationId: actor.organizationId, courseId }, select: { id: true } })
        assessmentId = created.id
      }
      if (questions && questions.length > 0) {
        await tx.question.createMany({ data: questions.map((q) => ({ ...q, config: q.config as object, organizationId: actor.organizationId, assessmentId: assessmentId! })) })
      }
      if (publish) {
        const n = await tx.question.count({ where: { assessmentId: assessmentId! } })
        if (n === 0) throw new CrudError("Agrega al menos una pregunta antes de publicar", 400, "questions")
      }
      return { id: assessmentId! }
    })
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") throw new CrudError(`Ya existe la ${kind === "task" ? "tarea" : "ejercicio"} ${number} en este libro`, 409, "number")
    throw err
  }
}

export async function deleteAssessment(actor: Actor, courseId: string, id: string) {
  await courseManage(actor, courseId)
  const used = await prisma.submission.count({ where: { assessmentId: id } })
  if (used > 0) throw new CrudError("Ya tiene envíos; despublícala en lugar de eliminarla", 409)
  const r = await prisma.assessment.deleteMany({ where: { id, courseId, organizationId: actor.organizationId } })
  if (r.count === 0) throw new CrudError("Actividad no encontrada", 404)
  return { ok: true }
}

// ── Grupos ───────────────────────────────────────────────────────────────────

export async function saveGroup(actor: Actor, courseId: string, id: string | null, input: Record<string, unknown>) {
  const course = await courseManage(actor, courseId)
  const name = text(input.name, 100)
  if (!name) throw new CrudError("Escribe el nombre del grupo", 400, "name")
  // Si no se envía maestro o apoyo en una edición, se conservan los actuales.
  const existing = id ? await prisma.courseGroup.findFirst({ where: { id, courseId, organizationId: actor.organizationId }, select: { teacherMemberId: true, assistantMemberId: true } }) : null
  if (id && !existing) throw new CrudError("Grupo no encontrado", 404)
  const teacher = input.teacherMemberId === undefined ? (existing?.teacherMemberId ?? null) : text(input.teacherMemberId, 40)
  const assistant = input.assistantMemberId === undefined ? (existing?.assistantMemberId ?? null) : text(input.assistantMemberId, 40)
  for (const [key, mid] of [["teacherMemberId", teacher], ["assistantMemberId", assistant]] as const) {
    if (!mid) continue
    if (existing && mid === (key === "teacherMemberId" ? existing.teacherMemberId : existing.assistantMemberId)) continue
    const m = await prisma.member.findFirst({ where: { id: mid, organizationId: actor.organizationId, isActive: true }, select: { hierarchy: true } })
    if (!m) throw new CrudError("Persona no válida", 400, key)
    // Universidad Teológica: lo imparte el pastor o un discípulo que ya cursó el libro.
    if (key === "teacherMemberId" && course.school.kind === "university" && m.hierarchy !== "pastor" && m.hierarchy !== "disciple") {
      const passed = await prisma.enrollment.count({ where: { memberId: mid, passed: true, group: { courseId } } })
      if (passed === 0) throw new CrudError("En la Universidad Teológica el maestro debe ser pastor, discípulo o haber cursado el libro", 400, key)
    }
  }
  if (teacher && teacher === assistant) throw new CrudError("El maestro y el apoyo deben ser personas distintas", 400, "assistantMemberId")
  const startDate = input.startDate ? toDate(input.startDate) : null
  const endDate = input.endDate ? toDate(input.endDate) : null
  if ((input.startDate && !startDate) || (input.endDate && !endDate) || (startDate && endDate && endDate < startDate)) throw new CrudError("Fechas inválidas", 400, "endDate")
  const capacity = input.capacity === null || input.capacity === undefined || input.capacity === "" ? null : Number(input.capacity)
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) throw new CrudError("Cupo inválido", 400, "capacity")
  const status = ["planned", "open", "closed"].includes(String(input.status)) ? (String(input.status) as "planned" | "open" | "closed") : "planned"
  const data = { name, teacherMemberId: teacher, assistantMemberId: assistant, startDate, endDate, capacity, status }
  if (id) {
    const r = await prisma.courseGroup.updateMany({ where: { id, courseId, organizationId: actor.organizationId }, data })
    if (r.count === 0) throw new CrudError("Grupo no encontrado", 404)
    return { id }
  }
  const row = await prisma.courseGroup.create({ data: { ...data, organizationId: actor.organizationId, courseId } })
  return { id: row.id }
}

// ── Inscripciones y pagos ────────────────────────────────────────────────────

async function enrollmentCheck(organizationId: string, memberId: string, group: NonNullable<Awaited<ReturnType<typeof loadGroup>>>) {
  const school = group.course.school
  const [courses, history] = await Promise.all([
    prisma.course.findMany({ where: { schoolId: school.id, isActive: true }, select: { id: true, sortOrder: true } }),
    prisma.enrollment.findMany({
      where: { organizationId, memberId, group: { course: { schoolId: school.id } } },
      include: { group: { select: { courseId: true, course: { select: { sortOrder: true } } } } },
    }),
  ])
  return canEnroll(
    school.kind,
    { courseId: group.courseId, sortOrder: group.course.sortOrder },
    courses.map((c) => ({ courseId: c.id, sortOrder: c.sortOrder })),
    history.map((h) => ({ courseId: h.group.courseId, sortOrder: h.group.course.sortOrder, passed: h.passed === true, active: h.status === "enrolled" || h.status === "requested" }))
  )
}

async function createEnrollment(
  actor: Actor,
  group: NonNullable<Awaited<ReturnType<typeof loadGroup>>>,
  memberId: string,
  opts: { wantsBook: boolean; status: "requested" | "enrolled"; force: boolean }
) {
  if (group.status === "closed") throw new CrudError("El grupo ya cerró", 409)
  const dup = await prisma.enrollment.findUnique({ where: { groupId_memberId: { groupId: group.id, memberId } } })
  if (dup && dup.status !== "dropped" && dup.status !== "rejected") throw new CrudError("Ya tienes inscripción en este grupo", 409)
  if (!opts.force) {
    const check = await enrollmentCheck(actor.organizationId, memberId, group)
    // Una inscripción previa a este mismo grupo (dada de baja) no cuenta como activa.
    if (!check.ok) throw new CrudError(check.reason, 409)
  } else {
    const active = await prisma.enrollment.count({
      where: { organizationId: actor.organizationId, memberId, status: { in: ["enrolled", "requested"] }, group: { course: { schoolId: group.course.schoolId } } },
    })
    if (active > 0) throw new CrudError("Esa persona ya cursa otro libro; solo se puede uno a la vez", 409)
  }
  if (group.capacity !== null) {
    const taken = await prisma.enrollment.count({ where: { groupId: group.id, status: { in: ["enrolled", "requested"] } } })
    if (taken >= group.capacity) throw new CrudError("El grupo ya no tiene lugares", 409)
  }
  const fee = group.course.enrollmentFee !== null ? Number(group.course.enrollmentFee) : Number(group.course.school.enrollmentFee)
  const data = {
    status: opts.status,
    fee,
    wantsBook: opts.wantsBook,
    bookPrice: Number(group.course.bookPrice),
    enrolledAt: opts.status === "enrolled" ? new Date() : null,
    decidedByUserId: opts.status === "enrolled" ? actor.userId : null,
    requestedAt: new Date(),
    tasksAvg: null,
    exercisesAvg: null,
    finalGrade: null,
    passed: null,
    completedAt: null,
  }
  if (dup) {
    await prisma.enrollment.update({ where: { id: dup.id }, data })
    return { id: dup.id }
  }
  const row = await prisma.enrollment.create({ data: { ...data, organizationId: actor.organizationId, groupId: group.id, memberId } })
  return { id: row.id }
}

/** El creyente solicita su inscripción a un grupo. */
export async function requestEnrollment(actor: Actor, groupId: string, input: { wantsBook?: unknown }) {
  const group = await loadGroup(actor.organizationId, groupId)
  if (!group || !group.course.isActive || !group.course.school.isActive) throw new CrudError("Grupo no encontrado", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) throw new CrudError("Tu usuario aún no tiene ficha de creyente; pide a la secretaría que la vincule", 409)
  return createEnrollment(actor, group, memberId, { wantsBook: input.wantsBook === true, status: "requested", force: false })
}

/** La administración inscribe directamente a una persona. */
export async function directEnroll(actor: Actor, groupId: string, input: { memberId?: unknown; wantsBook?: unknown }) {
  const a = await groupAccess(actor, groupId)
  if (!a.canManage) throw new CrudError("No tienes permiso para inscribir", 403)
  const memberId = text(input.memberId, 40)
  if (!memberId) throw new CrudError("Elige a la persona", 400, "memberId")
  const m = await prisma.member.findFirst({ where: { id: memberId, organizationId: actor.organizationId, isActive: true }, select: { id: true } })
  if (!m) throw new CrudError("Persona no encontrada", 404, "memberId")
  return createEnrollment(actor, a.group, memberId, { wantsBook: input.wantsBook === true, status: "enrolled", force: false })
}

export async function decideEnrollment(actor: Actor, enrollmentId: string, input: { action?: unknown }) {
  const e = await prisma.enrollment.findFirst({ where: { id: enrollmentId, organizationId: actor.organizationId } })
  if (!e) throw new CrudError("Inscripción no encontrada", 404)
  const a = await groupAccess(actor, e.groupId)
  const action = input.action
  if (action === "cancel") {
    // El alumno retira su solicitud.
    const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
    if (e.memberId !== memberId && !a.canManage) throw new CrudError("Inscripción no encontrada", 404)
    if (e.status !== "requested") throw new CrudError("Solo se puede retirar una solicitud pendiente", 409)
    await prisma.enrollment.update({ where: { id: e.id }, data: { status: "dropped" } })
    return { ok: true }
  }
  if (!a.canManage) throw new CrudError("No tienes permiso para decidir inscripciones", 403)
  if (action === "approve") {
    if (e.status !== "requested") throw new CrudError("La solicitud ya fue resuelta", 409)
    if (a.group.capacity !== null) {
      const taken = await prisma.enrollment.count({ where: { groupId: e.groupId, status: "enrolled" } })
      if (taken >= a.group.capacity) throw new CrudError("El grupo ya no tiene lugares", 409)
    }
    await prisma.enrollment.update({ where: { id: e.id }, data: { status: "enrolled", enrolledAt: new Date(), decidedByUserId: actor.userId } })
    return { ok: true }
  }
  if (action === "reject") {
    if (e.status !== "requested") throw new CrudError("La solicitud ya fue resuelta", 409)
    await prisma.enrollment.update({ where: { id: e.id }, data: { status: "rejected", decidedByUserId: actor.userId } })
    return { ok: true }
  }
  if (action === "drop") {
    if (e.status !== "enrolled") throw new CrudError("Solo se da de baja a quien está inscrito", 409)
    await prisma.enrollment.update({ where: { id: e.id }, data: { status: "dropped", decidedByUserId: actor.userId } })
    return { ok: true }
  }
  throw new CrudError("Acción no válida", 400)
}

export async function addPayment(actor: Actor, enrollmentId: string, input: { concept?: unknown; amount?: unknown; method?: unknown; reference?: unknown }) {
  const e = await prisma.enrollment.findFirst({ where: { id: enrollmentId, organizationId: actor.organizationId }, include: { payments: true } })
  if (!e) throw new CrudError("Inscripción no encontrada", 404)
  const a = await groupAccess(actor, e.groupId)
  if (!a.canManage) throw new CrudError("No tienes permiso para registrar pagos", 403)
  const amount = money(input.amount)
  if (amount === null || amount <= 0) throw new CrudError("Anota un monto mayor a cero", 400, "amount")
  const concept = input.concept === "book" ? "book" : "enrollment"
  if (concept === "book" && !e.wantsBook) throw new CrudError("La persona no pidió el libro de texto", 409, "concept")
  const balance = enrollmentBalance(Number(e.fee), Number(e.bookPrice), e.wantsBook, e.payments.map((p) => Number(p.amount)))
  if (amount > balance) throw new CrudError(`El pago excede el saldo pendiente ($${balance.toFixed(2)})`, 400, "amount")
  const method = ["cash", "transfer", "card", "other"].includes(String(input.method)) ? (String(input.method) as "cash" | "transfer" | "card" | "other") : "cash"
  await prisma.schoolPayment.create({
    data: { organizationId: actor.organizationId, enrollmentId, concept, amount, method, reference: text(input.reference, 80), receivedByUserId: actor.userId },
  })
  const left = Math.max(0, balance - amount)
  fireAndForget(
    notifyMembers(actor.organizationId, [e.memberId], {
      kind: "school_payment",
      title: left <= 0 ? "Tu inscripción quedó liquidada" : `Recibimos tu pago de ${amount.toFixed(2)}`,
      body: left <= 0 ? "No tienes saldo pendiente en la escuela." : `Saldo pendiente: ${left.toFixed(2)}`,
      link: "/mi/escuela",
      severity: "success",
      excludeUserId: actor.userId,
    })
  )
  return { ok: true }
}

export async function searchPeople(actor: Actor, groupId: string, q: string) {
  const a = await groupAccess(actor, groupId)
  if (!a.canManage) throw new CrudError("No tienes permiso", 403)
  const term = q.trim()
  if (term.length < 2) return []
  return prisma.member.findMany({
    where: {
      organizationId: actor.organizationId,
      isActive: true,
      OR: [{ fullName: { contains: term } }, { phone: { contains: term } }],
    },
    select: { id: true, fullName: true, phone: true },
    orderBy: { fullName: "asc" },
    take: 15,
  })
}

/** Personas para elegir director, maestros, etc. (administración o director). */
export async function searchStaff(actor: Actor, q: string) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const isDirector = memberId
    ? (await prisma.school.count({ where: { organizationId: actor.organizationId, OR: [{ directorMemberId: memberId }, { subdirectorMemberId: memberId }] } })) > 0
    : false
  if (!actor.canManageSchool && !isDirector) throw new CrudError("No tienes permiso", 403)
  const term = q.trim()
  if (term.length < 2) return []
  return prisma.member.findMany({
    where: { organizationId: actor.organizationId, isActive: true, OR: [{ fullName: { contains: term } }, { phone: { contains: term } }] },
    select: { id: true, fullName: true, hierarchy: true },
    orderBy: { fullName: "asc" },
    take: 15,
  })
}

// ── Notas ────────────────────────────────────────────────────────────────────

/** Recalcula promedios y calificación general de una inscripción. */
async function recalcEnrollment(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { group: { include: { course: { include: { school: true } } } }, grades: { include: { assessment: { select: { kind: true, number: true } } } } },
  })
  if (!e) return null
  const course = e.group.course
  const pick = (kind: "task" | "exercise", total: number) => {
    const values: (number | null)[] = []
    for (let n = 1; n <= total; n++) {
      const g = e.grades.find((x) => x.assessment.kind === kind && x.assessment.number === n)
      values.push(g ? Number(g.value) : null)
    }
    return averageOver(values, total)
  }
  const tasksAvg = pick("task", course.tasksCount)
  const exercisesAvg = pick("exercise", course.exercisesCount)
  // Si el libro no tiene tareas o ejercicios, la general es el promedio de lo que sí tiene.
  const final = finalGrade(tasksAvg ?? exercisesAvg, exercisesAvg ?? tasksAvg)
  const passed = isPassing(final, Number(course.school.passScore))
  await prisma.enrollment.update({ where: { id: e.id }, data: { tasksAvg, exercisesAvg, finalGrade: final, passed } })
  return { tasksAvg, exercisesAvg, final, passed }
}

/** Mejor intento calificado → nota 0–10 (no pisa una nota capturada por el maestro). */
async function syncGradeFromSubmissions(enrollmentId: string, assessmentId: string, organizationId: string) {
  const existing = await prisma.grade.findUnique({ where: { enrollmentId_assessmentId: { enrollmentId, assessmentId } } })
  if (existing?.manual) return
  const graded = await prisma.submission.findMany({ where: { enrollmentId, assessmentId, status: "graded" }, select: { percent: true } })
  if (graded.length === 0) return
  const best = Math.max(...graded.map((g) => Number(g.percent ?? 0)))
  const value = percentToGrade(best)
  await prisma.grade.upsert({
    where: { enrollmentId_assessmentId: { enrollmentId, assessmentId } },
    update: { value },
    create: { organizationId, enrollmentId, assessmentId, value, manual: false },
  })
  await recalcEnrollment(enrollmentId)
}

export async function setManualGrade(actor: Actor, enrollmentId: string, input: { assessmentId?: unknown; value?: unknown }) {
  const e = await prisma.enrollment.findFirst({ where: { id: enrollmentId, organizationId: actor.organizationId } })
  if (!e) throw new CrudError("Inscripción no encontrada", 404)
  const a = await groupAccess(actor, e.groupId)
  if (!a.canTeach) throw new CrudError("No tienes permiso para calificar este grupo", 403)
  const assessmentId = text(input.assessmentId, 40)
  const assessment = assessmentId
    ? await prisma.assessment.findFirst({ where: { id: assessmentId, courseId: a.group.courseId, organizationId: actor.organizationId }, select: { id: true } })
    : null
  if (!assessment) throw new CrudError("Actividad no válida", 400, "assessmentId")
  if (input.value === null || input.value === "") {
    // Quita la nota manual y vuelve a la calculada por los envíos.
    await prisma.grade.deleteMany({ where: { enrollmentId, assessmentId: assessment.id } })
    await syncGradeFromSubmissions(enrollmentId, assessment.id, actor.organizationId)
    await recalcEnrollment(enrollmentId)
    return { ok: true }
  }
  const value = Number(input.value)
  if (!Number.isFinite(value) || value < 0 || value > 10) throw new CrudError("La calificación va de 0 a 10", 400, "value")
  await prisma.grade.upsert({
    where: { enrollmentId_assessmentId: { enrollmentId, assessmentId: assessment.id } },
    update: { value: Math.round(value * 100) / 100, manual: true },
    create: { organizationId: actor.organizationId, enrollmentId, assessmentId: assessment.id, value: Math.round(value * 100) / 100, manual: true },
  })
  await recalcEnrollment(enrollmentId)
  return { ok: true }
}

// ── Planilla del grupo (como la hoja de la escuela) ──────────────────────────

export interface GradebookDto {
  group: {
    id: string
    name: string
    status: "planned" | "open" | "closed"
    courseId: string
    courseName: string
    schoolKind: "ministry" | "university"
    weeks: number
    tasksCount: number
    exercisesCount: number
    passScore: number
    teacherName: string | null
    assistantName: string | null
    startDate: string | null
    endDate: string | null
    capacity: number | null
  }
  sessions: { week: number; date: string; topic: string | null }[]
  assessments: { id: string; kind: "task" | "exercise"; number: number; title: string; isPublished: boolean }[]
  rows: {
    enrollmentId: string
    memberId: string
    name: string
    status: string
    attendance: Record<number, "present" | "absent" | "excused">
    tasks: Record<number, { value: number; manual: boolean }>
    exercises: Record<number, { value: number; manual: boolean }>
    tasksAvg: number | null
    exercisesAvg: number | null
    finalGrade: number | null
    passed: boolean | null
    balance: number
  }[]
  requests: { enrollmentId: string; name: string; requestedAt: string; wantsBook: boolean }[]
  pendingReviews: number
  access: { canManage: boolean; canTeach: boolean }
}

export async function getGradebook(actor: Actor, groupId: string): Promise<GradebookDto> {
  const a = await groupAccess(actor, groupId)
  if (!a.canView) throw new CrudError("Grupo no encontrado", 404)
  const g = a.group
  const [enrollments, sessions, assessments, pending] = await Promise.all([
    prisma.enrollment.findMany({
      where: { groupId, status: { in: ["requested", "enrolled", "completed", "failed"] } },
      include: {
        member: { select: { fullName: true } },
        payments: true,
        grades: { include: { assessment: { select: { kind: true, number: true } } } },
        attendance: { include: { session: { select: { week: true } } } },
      },
      orderBy: { member: { fullName: "asc" } },
    }),
    prisma.classSession.findMany({ where: { groupId }, orderBy: { week: "asc" } }),
    prisma.assessment.findMany({ where: { courseId: g.courseId }, orderBy: [{ kind: "asc" }, { number: "asc" }], select: { id: true, kind: true, number: true, title: true, isPublished: true } }),
    prisma.submission.count({ where: { needsReview: true, status: "submitted", enrollment: { groupId } } }),
  ])
  const rows = enrollments
    .filter((e) => e.status !== "requested")
    .map((e) => {
      const att: Record<number, "present" | "absent" | "excused"> = {}
      for (const x of e.attendance) att[x.session.week] = x.status
      const tasks: Record<number, { value: number; manual: boolean }> = {}
      const exercises: Record<number, { value: number; manual: boolean }> = {}
      for (const gr of e.grades) {
        const target = gr.assessment.kind === "task" ? tasks : exercises
        target[gr.assessment.number] = { value: Number(gr.value), manual: gr.manual }
      }
      return {
        enrollmentId: e.id,
        memberId: e.memberId,
        name: e.member.fullName,
        status: e.status,
        attendance: att,
        tasks,
        exercises,
        tasksAvg: num(e.tasksAvg),
        exercisesAvg: num(e.exercisesAvg),
        finalGrade: num(e.finalGrade),
        passed: e.passed,
        balance: a.canManage ? enrollmentBalance(Number(e.fee), Number(e.bookPrice), e.wantsBook, e.payments.map((p) => Number(p.amount))) : 0,
      }
    })
  return {
    group: {
      id: g.id,
      name: g.name,
      status: g.status,
      courseId: g.courseId,
      courseName: g.course.name,
      schoolKind: g.course.school.kind,
      weeks: g.course.weeks,
      tasksCount: g.course.tasksCount,
      exercisesCount: g.course.exercisesCount,
      passScore: Number(g.course.school.passScore),
      teacherName: g.teacher?.fullName ?? null,
      assistantName: g.assistant?.fullName ?? null,
      startDate: ymd(g.startDate),
      endDate: ymd(g.endDate),
      capacity: g.capacity,
    },
    sessions: sessions.map((s) => ({ week: s.week, date: ymd(s.date)!, topic: s.topic })),
    assessments,
    rows,
    requests: a.canManage
      ? enrollments.filter((e) => e.status === "requested").map((e) => ({ enrollmentId: e.id, name: e.member.fullName, requestedAt: e.requestedAt.toISOString(), wantsBook: e.wantsBook }))
      : [],
    pendingReviews: pending,
    access: { canManage: a.canManage, canTeach: a.canTeach },
  }
}

export async function saveSession(
  actor: Actor,
  groupId: string,
  input: { week?: unknown; date?: unknown; topic?: unknown; notes?: unknown; attendance?: unknown }
) {
  const a = await groupAccess(actor, groupId)
  if (!a.canTeach) throw new CrudError("No tienes permiso para pasar lista en este grupo", 403)
  if (a.group.status === "closed") throw new CrudError("El grupo ya cerró", 409)
  const week = Number(input.week)
  if (!Number.isInteger(week) || week < 1 || week > a.group.course.weeks) throw new CrudError(`La semana va de 1 a ${a.group.course.weeks}`, 400, "week")
  const date = toDate(input.date)
  if (!date) throw new CrudError("Elige la fecha de la clase", 400, "date")
  const enrolled = await prisma.enrollment.findMany({ where: { groupId, status: "enrolled" }, select: { id: true } })
  const valid = new Set(enrolled.map((e) => e.id))
  const att = (input.attendance && typeof input.attendance === "object" ? input.attendance : {}) as Record<string, unknown>
  await prisma.$transaction(async (tx) => {
    const session = await tx.classSession.upsert({
      where: { groupId_week: { groupId, week } },
      update: { date, topic: text(input.topic, 200), notes: text(input.notes, 2000) },
      create: { organizationId: actor.organizationId, groupId, week, date, topic: text(input.topic, 200), notes: text(input.notes, 2000) },
    })
    for (const enrollmentId of valid) {
      const raw = att[enrollmentId]
      const status = raw === "absent" || raw === "excused" ? raw : raw === "present" ? "present" : "absent"
      await tx.classAttendance.upsert({
        where: { sessionId_enrollmentId: { sessionId: session.id, enrollmentId } },
        update: { status },
        create: { organizationId: actor.organizationId, sessionId: session.id, enrollmentId, status },
      })
    }
  })
  return { ok: true }
}

export async function closeGroup(actor: Actor, groupId: string) {
  const a = await groupAccess(actor, groupId)
  if (!a.canManage) throw new CrudError("Solo la dirección de la escuela puede cerrar el grupo", 403)
  if (a.group.status === "closed") throw new CrudError("El grupo ya está cerrado", 409)
  const enrolled = await prisma.enrollment.findMany({ where: { groupId, status: "enrolled" }, select: { id: true } })
  const results: { id: string; passed: boolean }[] = []
  for (const e of enrolled) {
    const r = await recalcEnrollment(e.id)
    const passed = Boolean(r?.passed)
    results.push({ id: e.id, passed })
    await prisma.enrollment.update({ where: { id: e.id }, data: { status: passed ? "completed" : "failed", completedAt: new Date() } })
    if (passed) {
      const row = await prisma.enrollment.findUnique({ where: { id: e.id }, select: { memberId: true } })
      if (row) await onCoursePassed(actor.organizationId, row.memberId, a.group.course.name, a.group.course.school.kind, actor.userId)
    }
  }
  await prisma.courseGroup.update({ where: { id: groupId }, data: { status: "closed" } })
  // Las solicitudes sin resolver al cerrar se rechazan.
  await prisma.enrollment.updateMany({ where: { groupId, status: "requested" }, data: { status: "rejected", decidedByUserId: actor.userId } })
  return { ok: true, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }
}

// ── Portal del alumno ────────────────────────────────────────────────────────

export interface StudentAssessmentDto {
  id: string
  kind: "task" | "exercise"
  number: number
  week: number | null
  title: string
  attemptsUsed: number
  maxAttempts: number
  grade: number | null
  manual: boolean
  pendingReview: boolean
  timeLimitMin: number | null
}
export interface StudentPortalDto {
  enrollment: {
    id: string
    status: string
    wantsBook: boolean
    finalGrade: number | null
    tasksAvg: number | null
    exercisesAvg: number | null
    passed: boolean | null
    balance: number
  }
  course: { id: string; name: string; description: string | null; weeks: number; digitalBookUrl: string | null; passScore: number; tasksCount: number; exercisesCount: number }
  group: { id: string; name: string; teacherName: string | null; assistantName: string | null; startDate: string | null; endDate: string | null; status: string }
  contents: { id: string; week: number; title: string; type: string; url: string | null; body: string | null }[]
  assessments: StudentAssessmentDto[]
  attendance: { week: number; date: string | null; status: "present" | "absent" | "excused" | null }[]
  /** Libro digital: documentos con las páginas habilitadas hasta la última clase. */
  documents: { id: string; title: string; kind: "pdf" | "image" | "docx"; visible: number; total: number }[]
}

async function enrollmentFor(actor: Actor, enrollmentId: string) {
  const e = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, organizationId: actor.organizationId },
    include: { group: { include: { course: { include: { school: true } }, teacher: { select: { fullName: true } }, assistant: { select: { fullName: true } } } }, payments: true },
  })
  if (!e) throw new CrudError("Inscripción no encontrada", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const a = await groupAccess(actor, e.groupId)
  const isOwner = memberId !== null && e.memberId === memberId
  // Solo el alumno, su maestro/apoyo o la administración.
  if (!isOwner && !a.canTeach && !actor.canViewSchool) throw new CrudError("Inscripción no encontrada", 404)
  return { e, isOwner, a }
}

export async function getStudentPortal(actor: Actor, enrollmentId: string): Promise<StudentPortalDto> {
  const { e } = await enrollmentFor(actor, enrollmentId)
  const course = e.group.course
  const enrolledLike = e.status === "enrolled" || e.status === "completed" || e.status === "failed"
  const [contents, assessments, grades, subs, sessions, attendance] = await Promise.all([
    enrolledLike ? prisma.courseContent.findMany({ where: { courseId: course.id, isPublished: true }, orderBy: [{ week: "asc" }, { sortOrder: "asc" }] }) : Promise.resolve([]),
    enrolledLike ? prisma.assessment.findMany({ where: { courseId: course.id, isPublished: true }, orderBy: [{ kind: "asc" }, { number: "asc" }] }) : Promise.resolve([]),
    prisma.grade.findMany({ where: { enrollmentId } }),
    prisma.submission.findMany({ where: { enrollmentId }, select: { assessmentId: true, status: true, needsReview: true } }),
    prisma.classSession.findMany({ where: { groupId: e.groupId }, orderBy: { week: "asc" } }),
    prisma.classAttendance.findMany({ where: { enrollmentId }, include: { session: { select: { week: true } } } }),
  ])
  const documents = enrolledLike ? await documentsForEnrollment(actor.organizationId, course.id, e.groupId, e.status) : []
  const attByWeek = new Map(attendance.map((x) => [x.session.week, x.status]))
  const sessionByWeek = new Map(sessions.map((s) => [s.week, s]))
  return {
    enrollment: {
      id: e.id,
      status: e.status,
      wantsBook: e.wantsBook,
      finalGrade: num(e.finalGrade),
      tasksAvg: num(e.tasksAvg),
      exercisesAvg: num(e.exercisesAvg),
      passed: e.passed,
      balance: enrollmentBalance(Number(e.fee), Number(e.bookPrice), e.wantsBook, e.payments.map((p) => Number(p.amount))),
    },
    course: {
      id: course.id,
      name: course.name,
      description: course.description,
      weeks: course.weeks,
      digitalBookUrl: enrolledLike ? course.digitalBookUrl : null,
      passScore: Number(course.school.passScore),
      tasksCount: course.tasksCount,
      exercisesCount: course.exercisesCount,
    },
    group: {
      id: e.group.id,
      name: e.group.name,
      teacherName: e.group.teacher?.fullName ?? null,
      assistantName: e.group.assistant?.fullName ?? null,
      startDate: ymd(e.group.startDate),
      endDate: ymd(e.group.endDate),
      status: e.group.status,
    },
    contents: contents.map((c) => ({ id: c.id, week: c.week, title: c.title, type: c.type, url: c.url, body: c.body })),
    assessments: assessments.map((a) => {
      const mine = subs.filter((s) => s.assessmentId === a.id)
      const grade = grades.find((g) => g.assessmentId === a.id)
      return {
        id: a.id,
        kind: a.kind,
        number: a.number,
        week: a.week,
        title: a.title,
        attemptsUsed: mine.filter((s) => s.status !== "draft").length,
        maxAttempts: a.maxAttempts,
        grade: grade ? Number(grade.value) : null,
        manual: grade?.manual ?? false,
        pendingReview: mine.some((s) => s.status === "submitted" && s.needsReview),
        timeLimitMin: a.timeLimitMin,
      }
    }),
    documents,
    attendance: Array.from({ length: course.weeks }, (_, i) => ({
      week: i + 1,
      date: ymd(sessionByWeek.get(i + 1)?.date ?? null),
      status: (attByWeek.get(i + 1) ?? null) as "present" | "absent" | "excused" | null,
    })),
  }
}

export interface TakeAssessmentDto {
  assessment: { id: string; title: string; kind: "task" | "exercise"; number: number; instructions: string | null; maxAttempts: number; timeLimitMin: number | null }
  attemptsUsed: number
  canAttempt: boolean
  reason: string | null
  draft: { id: string; startedAt: string; answers: Record<string, unknown>; deadline: string | null } | null
  questions: { id: string; type: QuestionTypeKey; prompt: string; imageUrl: string | null; videoUrl: string | null; points: number; view: Record<string, unknown> }[]
  last: { attempt: number; status: string; percent: number | null; score: number | null; maxScore: number | null; needsReview: boolean; feedback: string | null; perQuestion: Record<string, { points: number | null; comment?: string; correct?: boolean }> } | null
}

export async function getAssessmentForStudent(actor: Actor, enrollmentId: string, assessmentId: string): Promise<TakeAssessmentDto> {
  const { e, isOwner } = await enrollmentFor(actor, enrollmentId)
  if (!isOwner) throw new CrudError("Solo la persona inscrita puede responder", 403)
  if (e.status !== "enrolled" && e.status !== "completed" && e.status !== "failed") throw new CrudError("Tu inscripción aún no está activa", 409)
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, courseId: e.group.courseId, isPublished: true },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  })
  if (!a) throw new CrudError("Actividad no encontrada", 404)
  const subs = await prisma.submission.findMany({ where: { assessmentId, enrollmentId }, orderBy: { attempt: "asc" } })
  const submitted = subs.filter((s) => s.status !== "draft")
  const draft = subs.find((s) => s.status === "draft") ?? null
  const closed = e.group.status === "closed" || e.status !== "enrolled"
  const canAttempt = !closed && (Boolean(draft) || submitted.length < a.maxAttempts)
  const last = submitted[submitted.length - 1] ?? null
  return {
    assessment: { id: a.id, title: a.title, kind: a.kind, number: a.number, instructions: a.instructions, maxAttempts: a.maxAttempts, timeLimitMin: a.timeLimitMin },
    attemptsUsed: submitted.length,
    canAttempt,
    reason: canAttempt ? null : closed ? "El grupo ya cerró" : "Ya usaste todos tus intentos",
    draft: draft
      ? {
          id: draft.id,
          startedAt: draft.startedAt.toISOString(),
          answers: (draft.answers ?? {}) as Record<string, unknown>,
          deadline: a.timeLimitMin ? new Date(draft.startedAt.getTime() + a.timeLimitMin * 60_000).toISOString() : null,
        }
      : null,
    // Las preguntas solo se muestran con un intento abierto o tras terminar (nunca las respuestas correctas).
    questions: a.questions.map((q) => {
      let view: Record<string, unknown> = {}
      try {
        view = studentView(sanitizeQuestionConfig(q.type, q.config, q.prompt), `${enrollmentId}:${q.id}`)
      } catch {
        view = {}
      }
      return { id: q.id, type: q.type, prompt: q.prompt, imageUrl: q.imageUrl, videoUrl: q.videoUrl, points: Number(q.points), view }
    }),
    last: last
      ? {
          attempt: last.attempt,
          status: last.status,
          percent: num(last.percent),
          score: num(last.score),
          maxScore: num(last.maxScore),
          needsReview: last.needsReview,
          feedback: last.feedback,
          perQuestion: (last.perQuestion ?? {}) as Record<string, { points: number | null; comment?: string; correct?: boolean }>,
        }
      : null,
  }
}

export async function startAssessment(actor: Actor, enrollmentId: string, assessmentId: string) {
  const { e, isOwner } = await enrollmentFor(actor, enrollmentId)
  if (!isOwner) throw new CrudError("Solo la persona inscrita puede responder", 403)
  if (e.status !== "enrolled" || e.group.status === "closed") throw new CrudError("La inscripción no está activa", 409)
  const a = await prisma.assessment.findFirst({ where: { id: assessmentId, courseId: e.group.courseId, isPublished: true } })
  if (!a) throw new CrudError("Actividad no encontrada", 404)
  const subs = await prisma.submission.findMany({ where: { assessmentId, enrollmentId } })
  const open = subs.find((s) => s.status === "draft")
  if (open) return { id: open.id }
  const used = subs.filter((s) => s.status !== "draft").length
  if (used >= a.maxAttempts) throw new CrudError("Ya usaste todos tus intentos", 409)
  const row = await prisma.submission.create({ data: { organizationId: actor.organizationId, assessmentId, enrollmentId, attempt: used + 1 } })
  return { id: row.id }
}

export async function submitAssessment(actor: Actor, enrollmentId: string, assessmentId: string, input: { answers?: unknown }) {
  const { e, isOwner } = await enrollmentFor(actor, enrollmentId)
  if (!isOwner) throw new CrudError("Solo la persona inscrita puede responder", 403)
  if (e.status !== "enrolled" || e.group.status === "closed") throw new CrudError("La inscripción no está activa", 409)
  const a = await prisma.assessment.findFirst({
    where: { id: assessmentId, courseId: e.group.courseId, isPublished: true },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  })
  if (!a) throw new CrudError("Actividad no encontrada", 404)
  const draft = await prisma.submission.findFirst({ where: { assessmentId, enrollmentId, status: "draft" } })
  const used = await prisma.submission.count({ where: { assessmentId, enrollmentId, status: { not: "draft" } } })
  if (!draft && used >= a.maxAttempts) throw new CrudError("Ya usaste todos tus intentos", 409)
  // El tiempo límite lo valida el servidor (con un margen de gracia de 15 s).
  if (draft && a.timeLimitMin && Date.now() > draft.startedAt.getTime() + a.timeLimitMin * 60_000 + 15_000) {
    await prisma.submission.update({ where: { id: draft.id }, data: { status: "submitted", submittedAt: new Date(), answers: {}, score: 0, maxScore: a.questions.reduce((s, q) => s + Number(q.points), 0), percent: 0, gradedAt: new Date() } })
    await prisma.submission.update({ where: { id: draft.id }, data: { status: "graded" } })
    await syncGradeFromSubmissions(enrollmentId, assessmentId, actor.organizationId)
    throw new CrudError("Se agotó el tiempo; el intento se calificó sin respuestas", 409)
  }
  const answers = (input.answers && typeof input.answers === "object" && !Array.isArray(input.answers) ? input.answers : {}) as Record<string, unknown>

  let score = 0
  let maxScore = 0
  let needsReview = false
  const perQuestion: Record<string, { points: number | null; correct?: boolean }> = {}
  for (const q of a.questions) {
    const points = Number(q.points)
    maxScore += points
    let result: { points: number | null; correct?: boolean }
    try {
      result = gradeQuestion(sanitizeQuestionConfig(q.type, q.config, q.prompt), answers[q.id], points)
    } catch {
      result = { points: 0 }
    }
    perQuestion[q.id] = result
    if (result.points === null) needsReview = true
    else score += result.points
  }
  const percent = submissionPercent(score, maxScore)
  const data = {
    answers: answers as object,
    status: needsReview ? ("submitted" as const) : ("graded" as const),
    score,
    maxScore,
    percent: needsReview ? null : percent,
    needsReview,
    perQuestion: perQuestion as object,
    submittedAt: new Date(),
    gradedAt: needsReview ? null : new Date(),
  }
  const saved = draft
    ? await prisma.submission.update({ where: { id: draft.id }, data })
    : await prisma.submission.create({ data: { ...data, organizationId: actor.organizationId, assessmentId, enrollmentId, attempt: used + 1 } })
  if (!needsReview) await syncGradeFromSubmissions(enrollmentId, assessmentId, actor.organizationId)
  return { id: saved.id, status: data.status, percent: needsReview ? null : percent, needsReview }
}

// ── Revisión del maestro ─────────────────────────────────────────────────────

export async function listReviews(actor: Actor, groupId: string) {
  const a = await groupAccess(actor, groupId)
  if (!a.canTeach) throw new CrudError("No tienes permiso para revisar este grupo", 403)
  const rows = await prisma.submission.findMany({
    where: { needsReview: true, status: "submitted", enrollment: { groupId } },
    include: { enrollment: { include: { member: { select: { fullName: true } } } }, assessment: { select: { title: true, kind: true, number: true } } },
    orderBy: { submittedAt: "asc" },
  })
  return rows.map((s) => ({
    id: s.id,
    studentName: s.enrollment.member.fullName,
    assessmentTitle: s.assessment.title,
    kind: s.assessment.kind,
    number: s.assessment.number,
    attempt: s.attempt,
    submittedAt: s.submittedAt?.toISOString() ?? null,
  }))
}

export async function getSubmissionForReview(actor: Actor, submissionId: string) {
  const s = await prisma.submission.findFirst({
    where: { id: submissionId, organizationId: actor.organizationId },
    include: {
      enrollment: { include: { member: { select: { fullName: true } }, group: { select: { name: true, course: { select: { name: true } } } } } },
      assessment: { include: { questions: { orderBy: { sortOrder: "asc" } } } },
    },
  })
  if (!s) throw new CrudError("Envío no encontrado", 404)
  const a = await groupAccess(actor, s.enrollment.groupId)
  if (!a.canTeach) throw new CrudError("Envío no encontrado", 404)
  const answers = (s.answers ?? {}) as Record<string, unknown>
  const per = (s.perQuestion ?? {}) as Record<string, { points: number | null; comment?: string }>
  return {
    id: s.id,
    studentName: s.enrollment.member.fullName,
    courseName: s.enrollment.group.course.name,
    groupName: s.enrollment.group.name,
    status: s.status,
    attempt: s.attempt,
    submittedAt: s.submittedAt?.toISOString() ?? null,
    maxScore: s.assessment.questions.reduce((sum, q) => sum + Number(q.points), 0),
    feedback: s.feedback,
    assessment: { title: s.assessment.title, kind: s.assessment.kind, number: s.assessment.number },
    questions: s.assessment.questions.map((q) => {
      let correct: Record<string, unknown> = {}
      try {
        correct = configForEditor(sanitizeQuestionConfig(q.type, q.config, q.prompt))
      } catch {
        correct = {}
      }
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: Number(q.points),
        answer: answers[q.id] ?? null,
        expected: q.type === "open" ? null : correct,
        awarded: per[q.id]?.points ?? null,
        comment: per[q.id]?.comment ?? "",
      }
    }),
  }
}

export async function gradeSubmission(actor: Actor, submissionId: string, input: { perQuestion?: unknown; feedback?: unknown }) {
  const s = await prisma.submission.findFirst({
    where: { id: submissionId, organizationId: actor.organizationId },
    include: { enrollment: true, assessment: { include: { questions: true } } },
  })
  if (!s) throw new CrudError("Envío no encontrado", 404)
  const a = await groupAccess(actor, s.enrollment.groupId)
  if (!a.canTeach) throw new CrudError("No tienes permiso para calificar este grupo", 403)
  const given = (input.perQuestion && typeof input.perQuestion === "object" ? input.perQuestion : {}) as Record<string, { points?: unknown; comment?: unknown }>
  const previous = (s.perQuestion ?? {}) as Record<string, { points: number | null; correct?: boolean }>
  let score = 0
  let maxScore = 0
  const merged: Record<string, { points: number | null; correct?: boolean; comment?: string }> = {}
  for (const q of s.assessment.questions) {
    const max = Number(q.points)
    maxScore += max
    const g = given[q.id]
    let points = previous[q.id]?.points ?? null
    if (g && g.points !== undefined && g.points !== null && g.points !== "") {
      const n = Number(g.points)
      if (!Number.isFinite(n) || n < 0 || n > max) throw new CrudError(`Los puntos de cada pregunta van de 0 a ${max}`, 400, "perQuestion")
      points = Math.round(n * 100) / 100
    }
    if (points === null) throw new CrudError("Califica todas las preguntas abiertas antes de guardar", 400, "perQuestion")
    score += points
    merged[q.id] = { points, correct: previous[q.id]?.correct, comment: g?.comment ? String(g.comment).slice(0, 500) : undefined }
  }
  const percent = submissionPercent(score, maxScore)
  await prisma.submission.update({
    where: { id: s.id },
    data: {
      status: "graded",
      needsReview: false,
      score,
      maxScore,
      percent,
      perQuestion: merged as object,
      feedback: text(input.feedback, 2000),
      gradedAt: new Date(),
      gradedByUserId: actor.userId,
    },
  })
  await syncGradeFromSubmissions(s.enrollmentId, s.assessmentId, actor.organizationId)
  fireAndForget(
    notifyMembers(actor.organizationId, [s.enrollment.memberId], {
      kind: "school_graded",
      title: `Calificaron tu ${s.assessment.kind === "task" ? "tarea" : "ejercicio"} ${s.assessment.number}`,
      body: `Sacaste ${(percent / 10).toFixed(1)} de 10 en «${s.assessment.title}».`,
      link: "/mi/escuela",
      severity: percent >= 70 ? "success" : "info",
      excludeUserId: actor.userId,
    })
  )
  return { ok: true, percent }
}

// ── Reporte de aprobados por periodo ─────────────────────────────────────────

export interface ApprovalsReportDto {
  from: string
  to: string
  groups: { groupId: string; courseName: string; groupName: string; schoolKind: "ministry" | "university"; closedAt: string; total: number; passed: number; failed: number; average: number | null }[]
  totals: { groups: number; total: number; passed: number; failed: number; rate: number }
  byCourse: { courseName: string; total: number; passed: number; failed: number; rate: number }[]
}

export async function getApprovalsReport(actor: Actor, fromRaw: string, toRaw: string): Promise<ApprovalsReportDto> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const isDirector = memberId
    ? (await prisma.school.count({ where: { organizationId: actor.organizationId, OR: [{ directorMemberId: memberId }, { subdirectorMemberId: memberId }] } })) > 0
    : false
  if (!actor.canManageSchool && !actor.canViewSchool && !isDirector) throw new CrudError("No tienes permiso para ver el reporte", 403)
  const today = new Date()
  const from = toDate(fromRaw) ?? new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
  const toBase = toDate(toRaw) ?? new Date(Date.UTC(today.getUTCFullYear(), 11, 31))
  const to = new Date(toBase.getTime() + 86_400_000) // incluye el día final
  const rows = await prisma.enrollment.findMany({
    where: { organizationId: actor.organizationId, status: { in: ["completed", "failed"] }, completedAt: { gte: from, lt: to } },
    select: {
      status: true,
      finalGrade: true,
      completedAt: true,
      group: { select: { id: true, name: true, course: { select: { name: true, school: { select: { kind: true } } } } } },
    },
  })
  const groups = new Map<string, ApprovalsReportDto["groups"][number] & { sum: number; graded: number }>()
  for (const r of rows) {
    const g = groups.get(r.group.id) ?? {
      groupId: r.group.id,
      courseName: r.group.course.name,
      groupName: r.group.name,
      schoolKind: r.group.course.school.kind,
      closedAt: r.completedAt?.toISOString() ?? "",
      total: 0,
      passed: 0,
      failed: 0,
      average: null,
      sum: 0,
      graded: 0,
    }
    g.total += 1
    if (r.status === "completed") g.passed += 1
    else g.failed += 1
    if (r.finalGrade !== null) {
      g.sum += Number(r.finalGrade)
      g.graded += 1
    }
    groups.set(r.group.id, g)
  }
  const list = [...groups.values()]
    .map(({ sum, graded, ...g }) => ({ ...g, average: graded > 0 ? Math.round((sum / graded) * 100) / 100 : null }))
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt))
  const byCourse = new Map<string, { courseName: string; total: number; passed: number; failed: number; rate: number }>()
  for (const g of list) {
    const c = byCourse.get(g.courseName) ?? { courseName: g.courseName, total: 0, passed: 0, failed: 0, rate: 0 }
    c.total += g.total
    c.passed += g.passed
    c.failed += g.failed
    byCourse.set(g.courseName, c)
  }
  const total = list.reduce((a, g) => a + g.total, 0)
  const passed = list.reduce((a, g) => a + g.passed, 0)
  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10)
  return {
    from: from.toISOString().slice(0, 10),
    to: toBase.toISOString().slice(0, 10),
    groups: list,
    totals: { groups: list.length, total, passed, failed: total - passed, rate: pct(passed, total) },
    byCourse: [...byCourse.values()].map((c) => ({ ...c, rate: pct(c.passed, c.total) })),
  }
}

export async function updateCourse(actor: Actor, courseId: string, input: Record<string, unknown>) {
  const course = await courseManage(actor, courseId)
  return saveCourse(actor, course.schoolId, courseId, input)
}

export { QUESTION_TYPES }
