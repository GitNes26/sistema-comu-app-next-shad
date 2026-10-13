// Reglas puras de la Escuela ministerial y su plataforma educativa (sin base de datos).

export const QUESTION_TYPES = ["open", "multiple_choice", "multiple_select", "fill_blank", "matching", "ordering", "true_false"] as const
export type QuestionTypeKey = (typeof QUESTION_TYPES)[number]
export const QUESTION_TYPE_LABEL: Record<QuestionTypeKey, string> = {
  open: "Respuesta abierta",
  multiple_choice: "Opción múltiple (una respuesta)",
  multiple_select: "Opción múltiple (varias respuestas)",
  fill_blank: "Completar espacios en blanco",
  matching: "Relacionar frases y palabras",
  ordering: "Ordenar frases o elementos",
  true_false: "Verdadero o falso",
}
export const isQuestionType = (v: unknown): v is QuestionTypeKey => QUESTION_TYPES.includes(v as QuestionTypeKey)

export const GRADE_MAX = 10

/** Minúsculas, sin acentos ni espacios repetidos: para comparar respuestas escritas. */
export function normalizeText(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

// ── Configuración de preguntas ───────────────────────────────────────────────

export interface Option {
  text: string
  imageUrl?: string
}
export type QuestionConfig =
  | { kind: "open" }
  | { kind: "multiple_choice"; options: Option[]; correct: number }
  | { kind: "multiple_select"; options: Option[]; correct: number[] }
  | { kind: "true_false"; correct: boolean }
  | { kind: "fill_blank"; answers: string[][] }
  | { kind: "matching"; pairs: { left: string; right: string }[] }
  | { kind: "ordering"; items: string[] }

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const url = (v: unknown) => {
  const s = str(v, 500)
  return /^(https?:\/\/|\/)/.test(s) ? s : undefined
}

/** Cuenta los espacios «___» de un enunciado. */
export function countBlanks(prompt: string): number {
  return (prompt.match(/_{3,}/g) ?? []).length
}

/** Valida y normaliza la configuración de una pregunta; lanza Error con mensaje claro. */
export function sanitizeQuestionConfig(type: QuestionTypeKey, raw: unknown, prompt = ""): QuestionConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const options = (): Option[] => {
    const list = (Array.isArray(r.options) ? r.options : [])
      .slice(0, 8)
      .map((o) => {
        const x = (o ?? {}) as Record<string, unknown>
        return { text: str(typeof o === "string" ? o : x.text, 200), imageUrl: url(x.imageUrl) }
      })
      .filter((o) => o.text || o.imageUrl)
    if (list.length < 2) throw new Error("Agrega al menos 2 opciones")
    return list
  }
  switch (type) {
    case "open":
      return { kind: "open" }
    case "true_false":
      return { kind: "true_false", correct: r.correct === true }
    case "multiple_choice": {
      const opts = options()
      const correct = Number(r.correct)
      if (!Number.isInteger(correct) || correct < 0 || correct >= opts.length) throw new Error("Marca la opción correcta")
      return { kind: "multiple_choice", options: opts, correct }
    }
    case "multiple_select": {
      const opts = options()
      const correct = [...new Set((Array.isArray(r.correct) ? r.correct : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < opts.length))].sort((a, b) => a - b)
      if (correct.length === 0) throw new Error("Marca al menos una opción correcta")
      return { kind: "multiple_select", options: opts, correct }
    }
    case "fill_blank": {
      const answers = (Array.isArray(r.answers) ? r.answers : [])
        .slice(0, 10)
        .map((a) => (Array.isArray(a) ? a : [a]).map((x) => str(x, 100)).filter(Boolean))
        .filter((a) => a.length > 0)
      const blanks = countBlanks(prompt)
      if (answers.length === 0) throw new Error("Escribe la respuesta de cada espacio")
      if (blanks > 0 && answers.length !== blanks) throw new Error(`El enunciado tiene ${blanks} espacio(s) y hay ${answers.length} respuesta(s)`)
      return { kind: "fill_blank", answers }
    }
    case "matching": {
      const pairs = (Array.isArray(r.pairs) ? r.pairs : [])
        .slice(0, 10)
        .map((p) => {
          const x = (p ?? {}) as Record<string, unknown>
          return { left: str(x.left, 150), right: str(x.right, 150) }
        })
        .filter((p) => p.left && p.right)
      if (pairs.length < 2) throw new Error("Agrega al menos 2 parejas")
      return { kind: "matching", pairs }
    }
    case "ordering": {
      const items = (Array.isArray(r.items) ? r.items : []).slice(0, 10).map((i) => str(i, 200)).filter(Boolean)
      if (items.length < 2) throw new Error("Agrega al menos 2 elementos para ordenar")
      return { kind: "ordering", items }
    }
  }
}

// ── Calificación automática ──────────────────────────────────────────────────

export type Answer = unknown

export interface GradeResult {
  /** Puntos obtenidos (0..points). null = requiere revisión del maestro. */
  points: number | null
  correct?: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Califica una respuesta. Respuestas esperadas del alumno:
 *  - multiple_choice: índice; multiple_select: arreglo de índices; true_false: boolean
 *  - fill_blank: arreglo de textos (uno por espacio)
 *  - matching: arreglo (uno por pareja, en el orden de las parejas) con el texto elegido de la derecha
 *  - ordering: arreglo con los elementos en el orden elegido
 *  - open: texto (revisión manual)
 */
export function gradeQuestion(config: QuestionConfig, answer: Answer, points: number): GradeResult {
  switch (config.kind) {
    case "open":
      return { points: null }
    case "true_false": {
      const ok = typeof answer === "boolean" && answer === config.correct
      return { points: ok ? points : 0, correct: ok }
    }
    case "multiple_choice": {
      const ok = Number(answer) === config.correct && answer !== null && answer !== ""
      return { points: ok ? points : 0, correct: ok }
    }
    case "multiple_select": {
      const given = [...new Set((Array.isArray(answer) ? answer : []).map(Number))].sort((a, b) => a - b)
      const ok = given.length === config.correct.length && given.every((g, i) => g === config.correct[i])
      return { points: ok ? points : 0, correct: ok }
    }
    case "fill_blank": {
      const given = Array.isArray(answer) ? answer : []
      const hits = config.answers.filter((accepted, i) => accepted.some((a) => normalizeText(a) === normalizeText(given[i]))).length
      // Cada espacio vale lo mismo; el crédito parcial se redondea a dos decimales.
      return { points: round2((points * hits) / config.answers.length), correct: hits === config.answers.length }
    }
    case "matching": {
      const given = Array.isArray(answer) ? answer : []
      const hits = config.pairs.filter((p, i) => normalizeText(given[i]) === normalizeText(p.right)).length
      return { points: round2((points * hits) / config.pairs.length), correct: hits === config.pairs.length }
    }
    case "ordering": {
      const given = Array.isArray(answer) ? answer : []
      const hits = config.items.filter((it, i) => normalizeText(given[i]) === normalizeText(it)).length
      return { points: round2((points * hits) / config.items.length), correct: hits === config.items.length }
    }
  }
}

/** Vista para el alumno: sin respuestas correctas y con elementos revueltos (semilla estable). */
export function studentView(config: QuestionConfig, seed: string): Record<string, unknown> {
  const shuffled = <T,>(list: T[]) => {
    let h = 2166136261
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    const out = [...list]
    for (let i = out.length - 1; i > 0; i--) {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
      const j = h % (i + 1)
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  switch (config.kind) {
    case "open":
    case "true_false":
      return {}
    case "multiple_choice":
    case "multiple_select":
      return { options: config.options }
    case "fill_blank":
      return { blanks: config.answers.length }
    case "matching":
      return { lefts: config.pairs.map((p) => p.left), rights: shuffled(config.pairs.map((p) => p.right)) }
    case "ordering":
      return { items: shuffled(config.items) }
  }
}

// ── Notas ────────────────────────────────────────────────────────────────────

/** Porcentaje (0–100) → calificación 0–10 con dos decimales. */
export const percentToGrade = (percent: number) => round2(Math.max(0, Math.min(100, percent)) / 10)

/** Promedio sobre el total de actividades del libro: lo no entregado cuenta como 0 (como la planilla). */
export function averageOver(values: (number | null | undefined)[], total: number): number | null {
  if (total <= 0) return null
  const sum = values.reduce<number>((a, v) => a + (typeof v === "number" ? v : 0), 0)
  return round2(sum / total)
}

/** GRAL = (promedio de tareas + promedio de ejercicios) / 2. */
export function finalGrade(tasksAvg: number | null, exercisesAvg: number | null): number | null {
  if (tasksAvg === null || exercisesAvg === null) return null
  return round2((tasksAvg + exercisesAvg) / 2)
}

export const isPassing = (grade: number | null, passScore: number) => grade !== null && grade >= passScore

/** Puntos de un envío → porcentaje; maxScore 0 devuelve 0. */
export const submissionPercent = (score: number, maxScore: number) => (maxScore > 0 ? round2((score / maxScore) * 100) : 0)

// ── Inscripción ──────────────────────────────────────────────────────────────

/** Saldo de una inscripción: cuota + libro (si lo pidió) − pagos. */
export function enrollmentBalance(fee: number, bookPrice: number, wantsBook: boolean, payments: number[]): number {
  const total = fee + (wantsBook ? bookPrice : 0)
  return Math.max(0, round2(total - payments.reduce((a, b) => a + b, 0)))
}

export interface CourseHistory {
  courseId: string
  sortOrder: number
  passed: boolean
  active: boolean
}

/**
 * ¿Puede inscribirse a este libro? Reglas: uno a la vez dentro del programa y,
 * en la Escuela de ministerio, los libros van en orden (hay que aprobar el anterior).
 * Un libro se puede cursar las veces que se quiera.
 */
export function canEnroll(
  kind: "ministry" | "university",
  target: { courseId: string; sortOrder: number },
  courses: { courseId: string; sortOrder: number }[],
  history: CourseHistory[]
): { ok: true } | { ok: false; reason: string } {
  if (history.some((h) => h.active)) return { ok: false, reason: "Ya estás cursando o solicitaste un libro; solo se puede uno a la vez" }
  if (kind === "ministry") {
    const previous = courses.filter((c) => c.sortOrder < target.sortOrder).sort((a, b) => b.sortOrder - a.sortOrder)[0]
    if (previous && !history.some((h) => h.courseId === previous.courseId && h.passed)) {
      return { ok: false, reason: "Los libros van en orden: primero hay que aprobar el libro anterior" }
    }
  }
  return { ok: true }
}

/** Semanas con clase registrada vs. semanas del libro. */
export const progressPercent = (done: number, total: number) => (total <= 0 ? 0 : Math.min(100, Math.round((done / total) * 100)))
