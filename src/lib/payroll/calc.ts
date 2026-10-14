// Cálculo de nómina ligera (no es CFDI ni calcula ISR/IMSS).
// Se usa igual en el servidor (al guardar) y en la pantalla (vista previa).
//
//   • Mensual / semanal: el sueldo cubre todos los días del periodo
//     (incluye descansos); se descuentan las faltas.
//   • Por día: días trabajados × salario diario.
//   • Por hora: horas trabajadas × valor de la hora.
//   • Horas extra: horas × valor hora × multiplicador (0 = no se pagan).
//   • Festivo / descanso trabajado: días × salario diario × multiplicador (pago adicional).
//   • Percepciones/deducciones configurables: importe fijo o % (percepción
//     sobre el sueldo base, deducción sobre el total de percepciones).

export type SalaryType = "monthly" | "weekly" | "daily" | "hourly" | ""
export type ConceptCalc = "fixed" | "percent"

export interface ConceptLine {
  name: string
  calc: ConceptCalc
  value: number
  amount: number
}

export interface PayConditions {
  salaryType: string
  salaryAmount: number
  dailyHours: number
  overtimeRate: number
  holidayRate: number
  restDayRate: number
}

export interface PayCapture {
  daysWorked: number
  hoursWorked: number
  absences: number
  overtimeHours: number
  holidayDays: number
  restDaysWorked: number
  perceptions: Omit<ConceptLine, "amount">[]
  deductions: Omit<ConceptLine, "amount">[]
}

export interface PayResult {
  dailyRate: number
  hourlyRate: number
  basePay: number
  overtimePay: number
  holidayPay: number
  restDayPay: number
  perceptions: ConceptLine[]
  deductions: ConceptLine[]
  grossPay: number
  totalDeductions: number
  netPay: number
}

export const SALARY_TYPE_LABELS: Record<string, string> = {
  monthly: "Sueldo mensual",
  weekly: "Sueldo semanal",
  daily: "Por día",
  hourly: "Por hora",
  "": "Sin sueldo definido",
}

export const PAY_METHOD_LABELS: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", check: "Cheque" }
export const FREQUENCY_LABELS: Record<string, string> = { weekly: "Semanal", biweekly: "Quincenal", monthly: "Mensual", custom: "Personalizado" }
export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6]

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export function rates(c: PayConditions) {
  const hours = c.dailyHours > 0 ? c.dailyHours : 8
  const amount = pos(c.salaryAmount)
  switch (c.salaryType) {
    case "monthly":
      return { daily: amount / 30, hourly: amount / 30 / hours }
    case "weekly":
      return { daily: amount / 7, hourly: amount / 7 / hours }
    case "daily":
      return { daily: amount, hourly: amount / hours }
    case "hourly":
      return { daily: amount * hours, hourly: amount }
    default:
      return { daily: 0, hourly: 0 }
  }
}

/** Días naturales del periodo (inclusive). */
export function periodDays(start: Date | string, end: Date | string) {
  const a = new Date(typeof start === "string" ? `${start.slice(0, 10)}T12:00:00` : start)
  const b = new Date(typeof end === "string" ? `${end.slice(0, 10)}T12:00:00` : end)
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1)
}

/** Días laborables del periodo según el horario del empleado. */
export function scheduledDays(start: Date | string, end: Date | string, workDays: number[]) {
  const a = new Date(typeof start === "string" ? `${start.slice(0, 10)}T12:00:00` : start)
  const days = periodDays(start, end)
  let count = 0
  for (let i = 0; i < days; i++) {
    const d = new Date(a.getTime() + i * 86400000)
    if (workDays.includes(d.getDay())) count++
  }
  return count
}

export function computePay(c: PayConditions, cap: PayCapture, days: number): PayResult {
  const { daily, hourly } = rates(c)
  let basePay = 0
  if (c.salaryType === "monthly" || c.salaryType === "weekly") basePay = daily * Math.max(0, days - pos(cap.absences))
  else if (c.salaryType === "daily") basePay = daily * pos(cap.daysWorked)
  else if (c.salaryType === "hourly") basePay = hourly * pos(cap.hoursWorked)
  basePay = r2(basePay)

  const overtimePay = r2(pos(cap.overtimeHours) * hourly * pos(c.overtimeRate))
  const holidayPay = r2(pos(cap.holidayDays) * daily * pos(c.holidayRate))
  const restDayPay = r2(pos(cap.restDaysWorked) * daily * pos(c.restDayRate))

  const perceptions = cap.perceptions
    .filter((p) => p.name.trim())
    .map((p) => ({ ...p, amount: r2(p.calc === "percent" ? (basePay * pos(p.value)) / 100 : pos(p.value)) }))
  const grossPay = r2(basePay + overtimePay + holidayPay + restDayPay + perceptions.reduce((s, p) => s + p.amount, 0))

  const deductions = cap.deductions
    .filter((d) => d.name.trim())
    .map((d) => ({ ...d, amount: r2(d.calc === "percent" ? (grossPay * pos(d.value)) / 100 : pos(d.value)) }))
  const totalDeductions = r2(deductions.reduce((s, d) => s + d.amount, 0))

  return {
    dailyRate: r2(daily),
    hourlyRate: r2(hourly),
    basePay,
    overtimePay,
    holidayPay,
    restDayPay,
    perceptions,
    deductions,
    grossPay,
    totalDeductions,
    netPay: r2(Math.max(0, grossPay - totalDeductions)),
  }
}

/** Fechas sugeridas del siguiente periodo según la frecuencia. */
export function suggestPeriod(frequency: string, today = new Date()): { start: string; end: string } {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const y = today.getFullYear()
  const m = today.getMonth()
  if (frequency === "monthly") return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) }
  if (frequency === "biweekly") {
    return today.getDate() <= 15
      ? { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m, 15)) }
      : { start: iso(new Date(y, m, 16)), end: iso(new Date(y, m + 1, 0)) }
  }
  // Semanal: lunes a domingo de la semana actual.
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: iso(monday), end: iso(sunday) }
}
