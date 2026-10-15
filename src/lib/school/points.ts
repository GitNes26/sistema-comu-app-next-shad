// Acreditación por puntos de la escuela universitaria (Teología): asistencia, tareas y
// pagos suman puntos; el curso se aprueba con `toPass` o más. Puro y probado.

export interface PointsConfig {
  attendance: number
  assignments: number
  payments: number
  toPass: number
}
export const DEFAULT_POINTS: PointsConfig = { attendance: 30, assignments: 10, payments: 10, toPass: 30 }

export interface PointsInput {
  /** Clases en las que estuvo presente o justificado. */
  attended: number
  /** Clases impartidas hasta hoy (o las semanas del curso si aún no hay ninguna). */
  held: number
  /** Promedio general de tareas y ejercicios (0–10). null = sin calificar. */
  grade: number | null
  /** Lo pagado y lo que debe pagar en total (cuota + libro si lo pidió). */
  paid: number
  due: number
}
export interface PointsResult {
  attendance: number
  assignments: number
  payments: number
  total: number
  max: number
  passed: boolean
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0)

/** Puntos enteros por rubro (se redondea al entero más cercano). */
export function computePoints(input: PointsInput, cfg: PointsConfig = DEFAULT_POINTS): PointsResult {
  const attendance = Math.round(cfg.attendance * clamp01(input.held > 0 ? input.attended / input.held : 0))
  const assignments = Math.round(cfg.assignments * clamp01((input.grade ?? 0) / 10))
  // Sin nada que pagar (beca o gratuito) se otorgan los puntos completos.
  const payments = Math.round(cfg.payments * clamp01(input.due > 0 ? input.paid / input.due : 1))
  const total = attendance + assignments + payments
  return { attendance, assignments, payments, total, max: cfg.attendance + cfg.assignments + cfg.payments, passed: total >= cfg.toPass }
}

/** Nombre del año del trayecto de Teología (1–6) cuando el curso no trae credencial propia. */
export const THEOLOGY_CREDENTIALS = [
  "Certificado en Estudios Bíblicos",
  "Asociado Ministerial",
  "Diplomado en Teología",
  "Licenciatura en Teología",
  "Maestría en Teología",
  "Doctorado en Teología",
] as const
