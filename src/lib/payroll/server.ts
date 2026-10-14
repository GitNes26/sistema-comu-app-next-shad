import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import type { Actor } from "@/lib/ministries/server"
import { sendChurchMail } from "@/lib/auth/mail"
import {
  computePay,
  DEFAULT_WORK_DAYS,
  periodDays,
  scheduledDays,
  type ConceptLine,
  type PayCapture,
  type PayConditions,
} from "@/lib/payroll/calc"
import { receiptBodyHtml } from "@/lib/payroll/receipt-html"

// Nómina ligera: configuración de pago por empleado, conceptos configurables,
// periodos con captura manual y recibos. Solo `payroll.manage`. Al marcar la
// nómina como pagada nace (una sola vez) su gasto en Finanzas.

const num = (v: unknown) => (v == null ? 0 : Number(v))
const dateOnly = (s: string) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null
  if (!d || Number.isNaN(d.getTime())) throw new CrudError("Fecha inválida", 400)
  return d
}
const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const r2 = (n: number) => Math.round(n * 100) / 100
const METHODS = ["cash", "transfer", "check"]
const SALARY_TYPES = ["monthly", "weekly", "daily", "hourly", ""]

function assertPayroll(actor: Actor) {
  if (!actor.canManagePayroll) throw new CrudError("No tienes permiso para la nómina", 403)
}

const lines = (v: unknown): Omit<ConceptLine, "amount">[] =>
  Array.isArray(v)
    ? v
        .map((x) => x as Record<string, unknown>)
        .map((x) => ({ name: String(x.name ?? "").slice(0, 80), calc: x.calc === "percent" ? ("percent" as const) : ("fixed" as const), value: Math.max(0, num(x.value)) }))
        .filter((x) => x.name.trim())
    : []

const employeeSelect = {
  id: true,
  employeeCode: true,
  isActive: true,
  salaryType: true,
  salaryAmount: true,
  paymentFrequency: true,
  workDays: true,
  shiftStart: true,
  shiftEnd: true,
  dailyHours: true,
  overtimeRate: true,
  holidayRate: true,
  restDayRate: true,
  payMethod: true,
  member: { select: { fullName: true, email: true, imageUrl: true } },
  position: { select: { name: true } },
  location: { select: { name: true } },
} satisfies Prisma.EmployeeSelect

type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>

function workDaysOf(e: { workDays: unknown }): number[] {
  return Array.isArray(e.workDays) ? (e.workDays as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6) : DEFAULT_WORK_DAYS
}

function serializeEmployee(e: EmployeeRow) {
  return {
    id: e.id,
    fullName: e.member.fullName,
    employeeCode: e.employeeCode,
    imageUrl: e.member.imageUrl,
    isActive: e.isActive,
    email: e.member.email ?? null,
    position: e.position?.name ?? null,
    location: e.location?.name ?? null,
    salaryType: e.salaryType,
    salaryAmount: num(e.salaryAmount),
    paymentFrequency: e.paymentFrequency,
    workDays: workDaysOf(e),
    shiftStart: e.shiftStart,
    shiftEnd: e.shiftEnd,
    dailyHours: num(e.dailyHours),
    overtimeRate: num(e.overtimeRate),
    holidayRate: num(e.holidayRate),
    restDayRate: num(e.restDayRate),
    payMethod: e.payMethod,
  }
}

const conditions = (e: EmployeeRow): PayConditions => ({
  salaryType: e.salaryType,
  salaryAmount: num(e.salaryAmount),
  dailyHours: num(e.dailyHours),
  overtimeRate: num(e.overtimeRate),
  holidayRate: num(e.holidayRate),
  restDayRate: num(e.restDayRate),
})

export async function payrollWorkspace(actor: Actor) {
  assertPayroll(actor)
  const organizationId = actor.organizationId
  const [employees, concepts, periods] = await Promise.all([
    prisma.employee.findMany({ where: { organizationId, isActive: true }, select: employeeSelect, orderBy: { member: { fullName: "asc" } } }),
    prisma.payrollConcept.findMany({ where: { organizationId, isActive: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.payrollRun.findMany({
      where: { organizationId },
      orderBy: { periodStart: "desc" },
      take: 60,
      include: { entries: { select: { net: true, grossPay: true, paidAt: true } } },
    }),
  ])
  return {
    employees: employees.map(serializeEmployee),
    concepts: concepts.map((c) => ({ id: c.id, name: c.name, kind: c.kind, calc: c.calc, amount: num(c.amount) })),
    periods: periods.map((p) => ({
      id: p.id,
      folio: p.folio ?? p.label,
      label: p.label,
      frequency: p.frequency,
      startDate: isoDate(p.periodStart),
      endDate: isoDate(p.periodEnd),
      status: p.status,
      employees: p.entries.length,
      gross: r2(p.entries.reduce((s, e) => s + num(e.grossPay), 0)),
      net: r2(p.entries.reduce((s, e) => s + num(e.net), 0)),
      paid: p.entries.filter((e) => e.paidAt).length,
      createdAt: p.createdAt.toISOString(),
    })),
  }
}

export async function updateEmployeePay(actor: Actor, employeeId: string, input: Record<string, unknown>) {
  assertPayroll(actor)
  const e = await prisma.employee.findFirst({ where: { id: employeeId, organizationId: actor.organizationId }, select: { id: true } })
  if (!e) throw new CrudError("Empleado no encontrado", 404)
  const time = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null)
  const rate = (v: unknown, max = 10) => Math.min(max, Math.max(0, num(v)))
  const data: Prisma.EmployeeUpdateInput = {
    ...(input.salaryType !== undefined ? { salaryType: SALARY_TYPES.includes(String(input.salaryType)) ? String(input.salaryType) : "" } : {}),
    ...(input.salaryAmount !== undefined ? { salaryAmount: Math.max(0, num(input.salaryAmount)) } : {}),
    ...(input.paymentFrequency !== undefined ? { paymentFrequency: ["weekly", "biweekly", "monthly"].includes(String(input.paymentFrequency)) ? String(input.paymentFrequency) : "biweekly" } : {}),
    ...(input.workDays !== undefined ? { workDays: Array.isArray(input.workDays) ? [...new Set((input.workDays as unknown[]).map(Number).filter((d) => d >= 0 && d <= 6))].sort() : DEFAULT_WORK_DAYS } : {}),
    ...(input.shiftStart !== undefined ? { shiftStart: time(input.shiftStart) } : {}),
    ...(input.shiftEnd !== undefined ? { shiftEnd: time(input.shiftEnd) } : {}),
    ...(input.dailyHours !== undefined ? { dailyHours: Math.min(24, Math.max(1, num(input.dailyHours) || 8)) } : {}),
    ...(input.overtimeRate !== undefined ? { overtimeRate: rate(input.overtimeRate) } : {}),
    ...(input.holidayRate !== undefined ? { holidayRate: rate(input.holidayRate) } : {}),
    ...(input.restDayRate !== undefined ? { restDayRate: rate(input.restDayRate) } : {}),
    ...(input.payMethod !== undefined ? { payMethod: METHODS.includes(String(input.payMethod)) ? String(input.payMethod) : "cash" } : {}),
  }
  const updated = await prisma.employee.update({ where: { id: employeeId }, data, select: employeeSelect })
  return serializeEmployee(updated)
}

export async function saveConcept(actor: Actor, input: Record<string, unknown>) {
  assertPayroll(actor)
  const name = String(input.name ?? "").trim()
  if (!name) throw new CrudError("Escribe el nombre del concepto", 400, "name")
  const data = {
    name: name.slice(0, 80),
    kind: input.kind === "deduction" ? "deduction" : "perception",
    calc: input.calc === "percent" ? "percent" : "fixed",
    amount: Math.max(0, num(input.amount)),
  }
  if (data.calc === "percent" && data.amount > 100) throw new CrudError("El porcentaje no puede ser mayor a 100", 400, "amount")
  if (input.id) {
    const found = await prisma.payrollConcept.findFirst({ where: { id: String(input.id), organizationId: actor.organizationId } })
    if (!found) throw new CrudError("Concepto no encontrado", 404)
    const c = await prisma.payrollConcept.update({ where: { id: found.id }, data })
    return { id: c.id }
  }
  const c = await prisma.payrollConcept.create({ data: { organizationId: actor.organizationId, ...data } })
  return { id: c.id }
}

export async function deleteConcept(actor: Actor, id: string) {
  assertPayroll(actor)
  await prisma.payrollConcept.updateMany({ where: { id, organizationId: actor.organizationId }, data: { isActive: false } })
  return { ok: true }
}

function entryData(e: EmployeeRow, cap: PayCapture, days: number) {
  const pay = computePay(conditions(e), cap, days)
  return {
    salaryType: e.salaryType,
    salaryAmount: num(e.salaryAmount),
    dailyRate: pay.dailyRate,
    hourlyRate: pay.hourlyRate,
    daysWorked: cap.daysWorked,
    hoursWorked: cap.hoursWorked,
    absences: cap.absences,
    overtimeHours: cap.overtimeHours,
    holidayDays: cap.holidayDays,
    restDaysWorked: cap.restDaysWorked,
    base: pay.basePay,
    overtimePay: pay.overtimePay,
    holidayPay: pay.holidayPay,
    restDayPay: pay.restDayPay,
    bonus: r2(pay.grossPay - pay.basePay),
    grossPay: pay.grossPay,
    deductions: pay.totalDeductions,
    net: pay.netPay,
    perceptionLines: pay.perceptions as unknown as Prisma.InputJsonValue,
    deductionLines: pay.deductions as unknown as Prisma.InputJsonValue,
  }
}

export async function createPeriod(
  actor: Actor,
  input: { frequency?: string; startDate: string; endDate: string; holidays?: string[]; employeeIds?: string[]; notes?: string }
) {
  assertPayroll(actor)
  const organizationId = actor.organizationId
  const start = dateOnly(String(input.startDate ?? ""))
  const end = dateOnly(String(input.endDate ?? ""))
  if (end < start) throw new CrudError("La fecha final debe ser posterior a la inicial", 400, "endDate")
  const days = periodDays(input.startDate, input.endDate)
  if (days > 62) throw new CrudError("El periodo no puede pasar de 62 días", 400, "endDate")
  const holidays = (Array.isArray(input.holidays) ? input.holidays : []).filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h) && h >= input.startDate && h <= input.endDate)

  const employees = await prisma.employee.findMany({
    where: { organizationId, isActive: true, ...(input.employeeIds?.length ? { id: { in: input.employeeIds } } : {}) },
    select: employeeSelect,
  })
  if (!employees.length) throw new CrudError("No hay empleados activos para esta nómina", 400)
  const [concepts, count] = await Promise.all([
    prisma.payrollConcept.findMany({ where: { organizationId, isActive: true } }),
    prisma.payrollRun.count({ where: { organizationId } }),
  ])
  const perceptions = concepts.filter((c) => c.kind === "perception").map((c) => ({ name: c.name, calc: c.calc as "fixed" | "percent", value: num(c.amount) }))
  const deductions = concepts.filter((c) => c.kind === "deduction").map((c) => ({ name: c.name, calc: c.calc as "fixed" | "percent", value: num(c.amount) }))
  const folio = `N-${String(count + 1).padStart(4, "0")}`

  const run = await prisma.payrollRun.create({
    data: {
      organizationId,
      label: `Nómina ${folio}`,
      folio,
      frequency: ["weekly", "biweekly", "monthly"].includes(String(input.frequency)) ? String(input.frequency) : "custom",
      periodStart: start,
      periodEnd: end,
      holidays,
      notes: input.notes?.trim() || null,
      createdByUserId: actor.userId,
      entries: {
        create: employees.map((e) => {
          const wd = workDaysOf(e)
          const scheduled = scheduledDays(input.startDate, input.endDate, wd)
          // Festivos que caen en día laborable: se asume que se trabajaron (se pueden quitar).
          const holidayOnWorkday = holidays.filter((h) => wd.includes(new Date(`${h}T12:00:00`).getDay())).length
          const cap: PayCapture = {
            daysWorked: scheduled,
            hoursWorked: r2(scheduled * num(e.dailyHours)),
            absences: 0,
            overtimeHours: 0,
            holidayDays: holidayOnWorkday,
            restDaysWorked: 0,
            perceptions,
            deductions,
          }
          return { organizationId, employeeId: e.id, payMethod: e.payMethod, ...entryData(e, cap, days) }
        }),
      },
    },
    select: { id: true },
  })
  return { id: run.id, folio }
}

export async function getPeriod(actor: Actor, id: string) {
  assertPayroll(actor)
  const p = await prisma.payrollRun.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: { entries: { include: { employee: { select: employeeSelect } } } },
  })
  if (!p) throw new CrudError("Nómina no encontrada", 404)
  const entries = p.entries
    .map((e) => {
      const emp = serializeEmployee(e.employee)
      const perceptionLines = (Array.isArray(e.perceptionLines) ? e.perceptionLines : []) as unknown as ConceptLine[]
      const deductionLines = (Array.isArray(e.deductionLines) ? e.deductionLines : []) as unknown as ConceptLine[]
      return {
        id: e.id,
        employee: emp,
        salaryType: e.salaryType,
        salaryAmount: num(e.salaryAmount),
        dailyRate: num(e.dailyRate),
        hourlyRate: num(e.hourlyRate),
        daysWorked: num(e.daysWorked),
        hoursWorked: num(e.hoursWorked),
        absences: num(e.absences),
        overtimeHours: num(e.overtimeHours),
        holidayDays: num(e.holidayDays),
        restDaysWorked: num(e.restDaysWorked),
        basePay: num(e.base),
        overtimePay: num(e.overtimePay),
        holidayPay: num(e.holidayPay),
        restDayPay: num(e.restDayPay),
        perceptions: perceptionLines,
        deductions: deductionLines,
        grossPay: num(e.grossPay),
        totalDeductions: num(e.deductions),
        netPay: num(e.net),
        payMethod: e.payMethod,
        notes: e.notes,
        paidAt: e.paidAt?.toISOString() ?? null,
        emailedAt: e.emailedAt?.toISOString() ?? null,
      }
    })
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName, "es"))
  return {
    id: p.id,
    folio: p.folio ?? p.label,
    frequency: p.frequency,
    startDate: isoDate(p.periodStart),
    endDate: isoDate(p.periodEnd),
    days: periodDays(isoDate(p.periodStart), isoDate(p.periodEnd)),
    holidays: (Array.isArray(p.holidays) ? p.holidays : []) as string[],
    status: p.status,
    notes: p.notes,
    closedAt: p.closedAt?.toISOString() ?? null,
    paidAt: p.paidAt?.toISOString() ?? null,
    total: r2(entries.reduce((s, e) => s + e.netPay, 0)),
    entries,
  }
}

export type PayrollPeriodDetail = Awaited<ReturnType<typeof getPeriod>>

export async function updateEntry(actor: Actor, entryId: string, input: Record<string, unknown>) {
  assertPayroll(actor)
  const entry = await prisma.payrollEntry.findFirst({
    where: { id: entryId, organizationId: actor.organizationId },
    include: { run: true, employee: { select: employeeSelect } },
  })
  if (!entry) throw new CrudError("Registro no encontrado", 404)
  if (entry.run.status !== "draft") throw new CrudError("La nómina ya está cerrada; reábrela para editar", 409)
  const pick = (k: keyof PayCapture, fallback: unknown) => Math.max(0, num(input[k] !== undefined ? input[k] : fallback))
  const cap: PayCapture = {
    daysWorked: pick("daysWorked", entry.daysWorked),
    hoursWorked: pick("hoursWorked", entry.hoursWorked),
    absences: pick("absences", entry.absences),
    overtimeHours: pick("overtimeHours", entry.overtimeHours),
    holidayDays: pick("holidayDays", entry.holidayDays),
    restDaysWorked: pick("restDaysWorked", entry.restDaysWorked),
    perceptions: input.perceptions !== undefined ? lines(input.perceptions) : lines(entry.perceptionLines),
    deductions: input.deductions !== undefined ? lines(input.deductions) : lines(entry.deductionLines),
  }
  const days = periodDays(isoDate(entry.run.periodStart), isoDate(entry.run.periodEnd))
  await prisma.payrollEntry.update({
    where: { id: entry.id },
    data: {
      ...entryData(entry.employee, cap, days),
      ...(input.payMethod !== undefined ? { payMethod: METHODS.includes(String(input.payMethod)) ? String(input.payMethod) : "cash" } : {}),
      ...(input.notes !== undefined ? { notes: String(input.notes ?? "").trim().slice(0, 200) || null } : {}),
    },
  })
  return { ok: true }
}

/** Recalcula todas las filas con las condiciones actuales de cada empleado. */
export async function recalcPeriod(actor: Actor, runId: string) {
  assertPayroll(actor)
  const p = await prisma.payrollRun.findFirst({ where: { id: runId, organizationId: actor.organizationId }, include: { entries: { select: { id: true } } } })
  if (!p) throw new CrudError("Nómina no encontrada", 404)
  if (p.status !== "draft") throw new CrudError("La nómina ya está cerrada", 409)
  for (const e of p.entries) await updateEntry(actor, e.id, {})
  return { ok: true }
}

/** draft → closed → paid. Al pagarse nace el gasto de Finanzas (una sola vez). */
export async function setPeriodStatus(actor: Actor, runId: string, status: string) {
  assertPayroll(actor)
  const p = await prisma.payrollRun.findFirst({ where: { id: runId, organizationId: actor.organizationId }, include: { entries: { select: { net: true } } } })
  if (!p) throw new CrudError("Nómina no encontrada", 404)
  if (!["draft", "closed", "paid"].includes(status)) throw new CrudError("Estado inválido", 400)
  if (status === p.status) return { ok: true }
  if (p.status === "paid") throw new CrudError("Una nómina pagada no se reabre", 409)
  const total = r2(p.entries.reduce((s, e) => s + num(e.net), 0))
  const now = new Date()
  if (status === "paid") {
    if (total <= 0) throw new CrudError("La nómina no tiene importe", 409)
    await prisma.$transaction([
      prisma.payrollRun.update({ where: { id: p.id }, data: { status: "paid", closedAt: p.closedAt ?? now, paidAt: now } }),
      prisma.payrollEntry.updateMany({ where: { runId: p.id, paidAt: null }, data: { paidAt: now } }),
      prisma.expense.create({
        data: {
          organizationId: actor.organizationId,
          payrollRunId: p.id,
          category: "nomina",
          concept: `Nómina · ${p.folio ?? p.label}`,
          amount: total,
          spentAt: new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`),
          createdByUserId: actor.userId,
        },
      }),
    ])
    return { ok: true, total }
  }
  await prisma.$transaction([
    prisma.payrollRun.update({
      where: { id: p.id },
      data: { status: status as "draft" | "closed", closedAt: status === "draft" ? null : (p.closedAt ?? now), paidAt: null },
    }),
    ...(status === "draft" ? [prisma.payrollEntry.updateMany({ where: { runId: p.id }, data: { paidAt: null } })] : []),
  ])
  return { ok: true }
}

export async function markEntryPaid(actor: Actor, entryId: string, paid: boolean) {
  assertPayroll(actor)
  const entry = await prisma.payrollEntry.findFirst({ where: { id: entryId, organizationId: actor.organizationId }, include: { run: { select: { status: true } } } })
  if (!entry) throw new CrudError("Registro no encontrado", 404)
  if (entry.run.status === "draft") throw new CrudError("Cierra la nómina antes de registrar pagos", 409)
  if (entry.run.status === "paid") throw new CrudError("La nómina ya está pagada", 409)
  await prisma.payrollEntry.update({ where: { id: entry.id }, data: { paidAt: paid ? new Date() : null } })
  return { ok: true }
}

export async function deletePeriod(actor: Actor, runId: string) {
  assertPayroll(actor)
  const p = await prisma.payrollRun.findFirst({ where: { id: runId, organizationId: actor.organizationId }, select: { id: true, status: true } })
  if (!p) throw new CrudError("Nómina no encontrada", 404)
  if (p.status !== "draft") throw new CrudError("Solo se pueden eliminar nóminas en borrador", 409)
  await prisma.payrollRun.delete({ where: { id: p.id } })
  return { ok: true }
}

/** Datos de la iglesia para el encabezado del recibo. */
export async function receiptCompany(organizationId: string) {
  const [org, company] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.companyProfile.findUnique({ where: { organizationId }, select: { tradeName: true, legalName: true, taxId: true, logoUrl: true } }),
  ])
  return {
    name: company?.tradeName ?? company?.legalName ?? org?.name ?? "Iglesia",
    legalName: company?.legalName ?? null,
    taxId: company?.taxId ?? null,
    logoUrl: company?.logoUrl ?? null,
  }
}

/** Recibo por correo. Es un comprobante interno: aclara que no es un CFDI. */
export async function emailReceipt(actor: Actor, entryId: string) {
  assertPayroll(actor)
  const entry = await prisma.payrollEntry.findFirst({ where: { id: entryId, organizationId: actor.organizationId }, select: { runId: true } })
  if (!entry) throw new CrudError("Registro no encontrado", 404)
  const [period, company] = await Promise.all([getPeriod(actor, entry.runId), receiptCompany(actor.organizationId)])
  const e = period.entries.find((x) => x.id === entryId)!
  const to = e.employee.email
  if (!to) throw new CrudError("La persona no tiene un correo registrado", 400)
  const html = receiptBodyHtml({ ...period, folio: period.folio }, e, company)
  await sendChurchMail(to, `Recibo de nómina ${period.folio} · ${company.name}`, "Recibo de nómina", html, company.name)
  await prisma.payrollEntry.update({ where: { id: entryId }, data: { emailedAt: new Date() } })
  return { ok: true, to }
}
