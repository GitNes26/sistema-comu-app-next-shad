import { format, parse, isValid, isSameDay, isToday as dfIsToday } from "date-fns"
import { es } from "date-fns/locale"

export const DATE_FORMAT = "dd/MM/yyyy"
export const TIME_FORMAT = "HH:mm"
export const DATETIME_FORMAT = "dd/MM/yyyy HH:mm"

export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string = DATE_FORMAT
): string {
  if (!date) return ""
  const d = typeof date === "string" ? parseISO(date) : date
  if (!d) return ""
  return format(d, formatStr, { locale: es })
}

export function parseISO(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isValid(d) ? d : null
}

export function parseDate(value: string): Date | null {
  if (!value) return null
  const d = parse(value, DATE_FORMAT, new Date(), { locale: es })
  if (isValid(d)) return d
  const d2 = new Date(value)
  return isValid(d2) ? d2 : null
}

export function parseTimeToDate(value: string): Date | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null
  const [h, m] = value.split(":").map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return isValid(d) ? d : null
}

export function dateToTime(d: Date): string {
  return format(d, TIME_FORMAT)
}

export function dateToDateTime(d: Date): string {
  return format(d, DATETIME_FORMAT, { locale: es })
}

export function getToday(): Date {
  const n = new Date()
  n.setHours(0, 0, 0, 0)
  return n
}

export function isSameDayFn(a: Date, b: Date): boolean {
  return isSameDay(a, b)
}

export function isTodayFn(d: Date): boolean {
  return dfIsToday(d)
}

export function relativeTodayLabel(d: Date): string {
  const today = getToday()
  if (isSameDay(d, today)) return "Hoy"
  const t = new Date(today)
  t.setDate(today.getDate() + 1)
  if (isSameDay(d, t)) return "Mañana"
  t.setDate(today.getDate() - 2)
  if (isSameDay(d, t)) return "Ayer"
  return formatDate(d)
}