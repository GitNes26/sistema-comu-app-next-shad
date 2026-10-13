import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { PDFDocument } from "pdf-lib"
import mammoth from "mammoth"
import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { uploadsRoot } from "@/lib/uploads/storage"
import { courseManage } from "@/lib/school/server"
import { isAnnotationKind, paginateHtml, sanitizeDocxHtml, sanitizeRects, visiblePagesFor, type PageRange } from "@/lib/school/document-rules"

// Libro digital: PDF, Word o imágenes subidos a la plataforma.
//
//  - Los archivos son PRIVADOS: no pasan por /api/media; se sirven solo a la
//    administración, a quien enseña el libro y a quien lo cursa.
//  - El contenido visible depende de la clase: cada sección habilita unas páginas en
//    una semana, y el SERVIDOR entrega únicamente esas páginas (en PDF se arma un
//    archivo solo con ellas; en Word, solo su HTML).
//  - Los apuntes (subrayados, texto, notas) son de cada alumno y solo él los ve.

const LIMITS = { pdf: 30 * 1024 * 1024, docx: 15 * 1024 * 1024, image: 10 * 1024 * 1024 }
const MIME: Record<string, "pdf" | "docx" | "image"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
}
const EXT: Record<string, string> = { pdf: "pdf", docx: "docx", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}

function docsDir(organizationId: string) {
  return path.join(uploadsRoot(), organizationId, "_docs")
}
function docPath(organizationId: string, fileName: string) {
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(fileName)) throw new CrudError("Archivo inválido", 400)
  return path.join(docsDir(organizationId), fileName)
}

// ── Word → páginas HTML ──────────────────────────────────────────────────────

// ── Administración ───────────────────────────────────────────────────────────

export interface DocumentDto {
  id: string
  title: string
  kind: "pdf" | "image" | "docx"
  pageCount: number
  size: number
  sections: { id: string; week: number; title: string; fromPage: number; toPage: number }[]
}

export async function listDocuments(actor: Actor, courseId: string): Promise<DocumentDto[]> {
  await courseManage(actor, courseId)
  const rows = await prisma.courseDocument.findMany({
    where: { courseId, organizationId: actor.organizationId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { sections: { orderBy: [{ week: "asc" }, { fromPage: "asc" }] } },
  })
  return rows.map((d) => ({
    id: d.id,
    title: d.title,
    kind: d.kind,
    pageCount: d.pageCount,
    size: d.size,
    sections: d.sections.map((s) => ({ id: s.id, week: s.week, title: s.title, fromPage: s.fromPage, toPage: s.toPage })),
  }))
}

export async function uploadDocument(actor: Actor, courseId: string, file: File, title: string | null) {
  await courseManage(actor, courseId)
  const kind = MIME[file.type]
  if (!kind) throw new CrudError("Formatos permitidos: PDF, Word (.docx) e imágenes PNG, JPG o WEBP", 415)
  if (file.size > LIMITS[kind]) throw new CrudError(`El archivo excede ${Math.round(LIMITS[kind] / 1024 / 1024)} MB`, 413)
  const buffer = Buffer.from(await file.arrayBuffer())

  let pageCount = 1
  let pagesHtml: string | null = null
  if (kind === "pdf") {
    try {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: false })
      pageCount = pdf.getPageCount()
    } catch {
      throw new CrudError("No se pudo leer el PDF (¿está protegido con contraseña o dañado?)", 400)
    }
    if (pageCount < 1 || pageCount > 1500) throw new CrudError("El PDF debe tener entre 1 y 1500 páginas", 400)
  } else if (kind === "docx") {
    try {
      const result = await mammoth.convertToHtml({ buffer })
      const pages = paginateHtml(sanitizeDocxHtml(result.value))
      pageCount = pages.length
      pagesHtml = JSON.stringify(pages)
    } catch {
      throw new CrudError("No se pudo leer el documento de Word; guárdalo como .docx", 400)
    }
  }

  const ext = kind === "image" ? EXT[file.type] : EXT[kind]
  const fileName = `${randomUUID()}.${ext}`
  await mkdir(docsDir(actor.organizationId), { recursive: true })
  await writeFile(docPath(actor.organizationId, fileName), buffer)
  const row = await prisma.courseDocument.create({
    data: {
      organizationId: actor.organizationId,
      courseId,
      title: title?.slice(0, 150) || file.name.replace(/\.[^.]+$/, "").slice(0, 150) || "Libro digital",
      kind,
      fileName,
      mime: file.type,
      size: file.size,
      pageCount,
      pagesHtml,
      createdByUserId: actor.userId,
    },
    select: { id: true },
  })
  return { id: row.id, pageCount }
}

export async function saveDocument(actor: Actor, documentId: string, input: { title?: unknown; sections?: unknown }) {
  const doc = await prisma.courseDocument.findFirst({ where: { id: documentId, organizationId: actor.organizationId }, include: { course: { select: { weeks: true } } } })
  if (!doc) throw new CrudError("Documento no encontrado", 404)
  await courseManage(actor, doc.courseId)
  const title = text(input.title, 150)
  if (!title) throw new CrudError("Escribe el título", 400, "title")
  const raw = Array.isArray(input.sections) ? input.sections.slice(0, 60) : null
  const sections = raw?.map((s, i) => {
    const o = (s ?? {}) as Record<string, unknown>
    const week = Number(o.week)
    const from = Number(o.fromPage)
    const to = Number(o.toPage)
    const label = text(o.title, 120) ?? `Sección ${i + 1}`
    if (!Number.isInteger(week) || week < 1 || week > doc.course.weeks) throw new CrudError(`Sección ${i + 1}: la semana va de 1 a ${doc.course.weeks}`, 400, "sections")
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > doc.pageCount) {
      throw new CrudError(`Sección ${i + 1}: las páginas van de 1 a ${doc.pageCount}`, 400, "sections")
    }
    return { week, title: label, fromPage: from, toPage: to }
  })
  await prisma.$transaction(async (tx) => {
    await tx.courseDocument.update({ where: { id: documentId }, data: { title } })
    if (sections) {
      await tx.documentSection.deleteMany({ where: { documentId } })
      if (sections.length > 0) await tx.documentSection.createMany({ data: sections.map((s) => ({ ...s, organizationId: actor.organizationId, documentId })) })
    }
  })
  return { ok: true }
}

export async function deleteDocument(actor: Actor, documentId: string) {
  const doc = await prisma.courseDocument.findFirst({ where: { id: documentId, organizationId: actor.organizationId } })
  if (!doc) throw new CrudError("Documento no encontrado", 404)
  await courseManage(actor, doc.courseId)
  await prisma.courseDocument.delete({ where: { id: documentId } })
  await unlink(docPath(actor.organizationId, doc.fileName)).catch(() => {})
  return { ok: true }
}

// ── Acceso de lectura ────────────────────────────────────────────────────────

interface ReadAccess {
  doc: NonNullable<Awaited<ReturnType<typeof loadDoc>>>
  memberId: string | null
  /** null = todas las páginas. */
  visible: number[] | null
  mode: "manager" | "teacher" | "student"
}
function loadDoc(organizationId: string, id: string) {
  return prisma.courseDocument.findFirst({
    where: { id, organizationId },
    include: { sections: true, course: { include: { school: true } } },
  })
}

async function readAccess(actor: Actor, documentId: string): Promise<ReadAccess> {
  const doc = await loadDoc(actor.organizationId, documentId)
  if (!doc) throw new CrudError("Documento no encontrado", 404)
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  const school = doc.course.school
  const isDirector = memberId !== null && (school.directorMemberId === memberId || school.subdirectorMemberId === memberId)
  if (actor.canManageSchool || isDirector) return { doc, memberId, visible: null, mode: "manager" }
  if (memberId) {
    const teaches = await prisma.courseGroup.count({
      where: { courseId: doc.courseId, organizationId: actor.organizationId, OR: [{ teacherMemberId: memberId }, { assistantMemberId: memberId }] },
    })
    if (teaches > 0) return { doc, memberId, visible: null, mode: "teacher" }
    const enrollment = await prisma.enrollment.findFirst({
      where: { memberId, organizationId: actor.organizationId, status: { in: ["enrolled", "completed", "failed"] }, group: { courseId: doc.courseId } },
      orderBy: { requestedAt: "desc" },
      select: { groupId: true, status: true },
    })
    if (enrollment) {
      const last = await prisma.classSession.findFirst({ where: { groupId: enrollment.groupId }, orderBy: { week: "desc" }, select: { week: true } })
      // Un grupo cerrado conserva todo el libro; en curso, hasta la última clase dada (mínimo la semana 1).
      const released = enrollment.status === "enrolled" ? Math.max(1, last?.week ?? 1) : doc.course.weeks
      const ranges: PageRange[] = doc.sections.map((s) => ({ week: s.week, fromPage: s.fromPage, toPage: s.toPage }))
      return { doc, memberId, visible: visiblePagesFor(ranges, released, doc.pageCount), mode: "student" }
    }
  }
  throw new CrudError("Documento no encontrado", 404)
}

export interface DocumentViewDto {
  id: string
  title: string
  kind: "pdf" | "image" | "docx"
  /** Páginas originales visibles, en orden (el archivo entregado trae solo estas). */
  pages: number[]
  totalPages: number
  /** Word: HTML de cada página visible, en el mismo orden de `pages`. */
  html: string[] | null
  sections: { week: number; title: string; fromPage: number; toPage: number }[]
  annotations: AnnotationDto[]
  mode: "manager" | "teacher" | "student"
}
export interface AnnotationDto {
  id: string
  page: number
  kind: "highlight" | "text" | "note"
  color: string
  rects: { x: number; y: number; w: number; h: number }[]
  text: string | null
  quote: string | null
}

export async function getDocumentView(actor: Actor, documentId: string): Promise<DocumentViewDto> {
  const a = await readAccess(actor, documentId)
  const all = Array.from({ length: a.doc.pageCount }, (_, i) => i + 1)
  const pages = a.visible ?? all
  let html: string[] | null = null
  if (a.doc.kind === "docx" && a.doc.pagesHtml) {
    try {
      const parsed = JSON.parse(a.doc.pagesHtml) as string[]
      html = pages.map((p) => parsed[p - 1] ?? "")
    } catch {
      html = pages.map(() => "")
    }
  }
  const mine = a.memberId
    ? await prisma.documentAnnotation.findMany({
        where: { documentId, memberId: a.memberId, page: { in: pages } },
        orderBy: [{ page: "asc" }, { createdAt: "asc" }],
      })
    : []
  return {
    id: a.doc.id,
    title: a.doc.title,
    kind: a.doc.kind,
    pages,
    totalPages: a.doc.pageCount,
    html,
    sections: a.doc.sections
      .filter((s) => (a.visible === null ? true : s.fromPage <= (a.visible.at(-1) ?? 0)))
      .sort((x, y) => x.week - y.week || x.fromPage - y.fromPage)
      .map((s) => ({ week: s.week, title: s.title, fromPage: s.fromPage, toPage: s.toPage })),
    annotations: mine.map((n) => ({
      id: n.id,
      page: n.page,
      kind: n.kind,
      color: n.color,
      rects: sanitizeRects(n.rects),
      text: n.text,
      quote: n.quote,
    })),
    mode: a.mode,
  }
}

/** Bytes del archivo que puede ver quien consulta (PDF recortado a sus páginas). */
export async function readDocumentFile(actor: Actor, documentId: string): Promise<{ data: Buffer; mime: string; name: string }> {
  const a = await readAccess(actor, documentId)
  const original = await readFile(docPath(actor.organizationId, a.doc.fileName)).catch(() => null)
  if (!original) throw new CrudError("El archivo ya no está disponible", 404)
  if (a.doc.kind === "docx") throw new CrudError("Este documento se lee desde la plataforma", 400)
  if (a.doc.kind === "image") {
    if (a.visible && !a.visible.includes(1)) throw new CrudError("Aún no está disponible", 403)
    return { data: original, mime: a.doc.mime, name: a.doc.title }
  }
  if (a.visible === null) return { data: original, mime: "application/pdf", name: a.doc.title }
  if (a.visible.length === 0) throw new CrudError("Aún no está disponible", 403)
  const src = await PDFDocument.load(original)
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, a.visible.map((p) => p - 1))
  copied.forEach((p) => out.addPage(p))
  return { data: Buffer.from(await out.save()), mime: "application/pdf", name: a.doc.title }
}

// ── Apuntes ──────────────────────────────────────────────────────────────────

export async function saveAnnotation(
  actor: Actor,
  documentId: string,
  input: { id?: unknown; page?: unknown; kind?: unknown; color?: unknown; rects?: unknown; text?: unknown; quote?: unknown }
) {
  const a = await readAccess(actor, documentId)
  if (!a.memberId) throw new CrudError("Tu usuario aún no tiene ficha de creyente", 409)
  const page = Number(input.page)
  const allowed = a.visible ?? Array.from({ length: a.doc.pageCount }, (_, i) => i + 1)
  if (!Number.isInteger(page) || !allowed.includes(page)) throw new CrudError("Esa página no está disponible", 400, "page")
  if (!isAnnotationKind(input.kind)) throw new CrudError("Tipo de apunte inválido", 400, "kind")
  const color = typeof input.color === "string" && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : "#facc15"
  const rects = sanitizeRects(input.rects)
  if (rects.length === 0) throw new CrudError("El apunte necesita una posición en la página", 400, "rects")
  const body = text(input.text, 2000)
  if (input.kind !== "highlight" && !body) throw new CrudError("Escribe el texto del apunte", 400, "text")
  const data = { page, kind: input.kind, color, rects: rects as object[], text: input.kind === "highlight" ? null : body, quote: text(input.quote, 1000) }

  const id = typeof input.id === "string" ? input.id : null
  if (id) {
    const r = await prisma.documentAnnotation.updateMany({ where: { id, documentId, memberId: a.memberId, organizationId: actor.organizationId }, data })
    if (r.count === 0) throw new CrudError("Apunte no encontrado", 404)
    return { id }
  }
  const total = await prisma.documentAnnotation.count({ where: { documentId, memberId: a.memberId } })
  if (total >= 1000) throw new CrudError("Llegaste al máximo de apuntes de este documento", 409)
  const row = await prisma.documentAnnotation.create({ data: { ...data, organizationId: actor.organizationId, documentId, memberId: a.memberId } })
  return { id: row.id }
}

export async function deleteAnnotation(actor: Actor, documentId: string, id: string) {
  const a = await readAccess(actor, documentId)
  if (!a.memberId) throw new CrudError("Apunte no encontrado", 404)
  const r = await prisma.documentAnnotation.deleteMany({ where: { id, documentId, memberId: a.memberId, organizationId: actor.organizationId } })
  if (r.count === 0) throw new CrudError("Apunte no encontrado", 404)
  return { ok: true }
}

/** Documentos que ve un alumno en su portal (con cuántas páginas tiene habilitadas). */
export async function documentsForEnrollment(organizationId: string, courseId: string, groupId: string, status: string) {
  const [docs, last] = await Promise.all([
    prisma.courseDocument.findMany({ where: { courseId, organizationId }, include: { sections: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.classSession.findFirst({ where: { groupId }, orderBy: { week: "desc" }, select: { week: true } }),
  ])
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { weeks: true } })
  const released = status === "enrolled" ? Math.max(1, last?.week ?? 1) : (course?.weeks ?? 8)
  return docs
    .map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      visible: visiblePagesFor(d.sections.map((s) => ({ week: s.week, fromPage: s.fromPage, toPage: s.toPage })), released, d.pageCount).length,
      total: d.pageCount,
    }))
    .filter((d) => d.visible > 0)
}
