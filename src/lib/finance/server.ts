import { prisma } from "@/lib/db"
import { openCampaignOrThrow } from "@/lib/finance/campaigns"
import { ensureReceiptFolio } from "@/lib/finance/receipt"
import { fireAndForget, notifyMembers, notifyPermission } from "@/lib/notifications/church"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { EXPENSE_CATEGORIES, balanceOf, expiryStatus, groupSum, kmPerLiter, monthRange, serviceDue, type DocStatus } from "@/lib/finance/rules"

// Administración y finanzas: ingresos (diezmos, ofrendas, donativos), gastos
// (generales y ligados a eventos o vehículos), donativos con modelo listo para pago
// en línea, vehículos y nómina simple.
//
//  - Ver: `finance.view`; registrar y confirmar: `finance.manage` (tesorería).
//  - Nómina: solo `payroll.manage`. Vehículos: `vehicles.view` / `vehicles.manage`.
//  - Cualquier creyente puede reportar su transferencia; tesorería la confirma y
//    entonces nace el ingreso. Los datos personales de donantes nunca salen de aquí.

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}
const money = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? Math.round(n * 100) / 100 : null
}
const toDate = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null
  const d = new Date(`${v.slice(0, 10)}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const today = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
const num = (d: { toString(): string } | null | undefined) => (d === null || d === undefined ? 0 : Number(d.toString()))

function assertView(actor: Actor) {
  if (!actor.canViewFinance && !actor.canManageFinance) throw new CrudError("No tienes permiso para ver las finanzas", 403)
}
function assertManage(actor: Actor) {
  if (!actor.canManageFinance) throw new CrudError("No tienes permiso para registrar movimientos", 403)
}

// ── Resumen del mes ──────────────────────────────────────────────────────────

export interface FinanceSummaryDto {
  month: string
  income: { total: number; byKind: { key: string; total: number }[]; bySource: { key: string; total: number }[] }
  expenses: { total: number; byCategory: { key: string; total: number }[] }
  balance: number
  cuts: { gatheringId: string; label: string; date: string; total: number }[]
  alerts: { pendingDonations: number; draftPayroll: number; vehicleAlerts: number }
}

export async function getSummary(actor: Actor, month: string | undefined): Promise<FinanceSummaryDto> {
  assertView(actor)
  const r = monthRange(month)
  const [incomes, expenses, pendingDonations, draftPayroll, vehicleAlerts] = await Promise.all([
    prisma.income.findMany({
      where: { organizationId: actor.organizationId, receivedAt: { gte: r.start, lt: r.end } },
      include: { gathering: { select: { id: true, date: true, topic: true, series: { select: { name: true } } } } },
    }),
    prisma.expense.findMany({ where: { organizationId: actor.organizationId, spentAt: { gte: r.start, lt: r.end } }, select: { category: true, amount: true } }),
    prisma.donation.count({ where: { organizationId: actor.organizationId, status: "pending" } }),
    actor.canManagePayroll ? prisma.payrollRun.count({ where: { organizationId: actor.organizationId, status: "draft" } }) : Promise.resolve(0),
    countVehicleAlerts(actor.organizationId),
  ])
  const incomeTotal = incomes.reduce((s, i) => s + num(i.amount), 0)
  const expenseTotal = expenses.reduce((s, e) => s + num(e.amount), 0)
  const cutMap = new Map<string, { gatheringId: string; label: string; date: string; total: number }>()
  for (const i of incomes) {
    if (!i.gathering || i.source !== "cash_cut") continue
    const g = cutMap.get(i.gathering.id) ?? {
      gatheringId: i.gathering.id,
      label: [i.gathering.series?.name, i.gathering.topic].filter(Boolean).join(" · ") || "Reunión",
      date: ymd(i.gathering.date)!,
      total: 0,
    }
    g.total = Math.round((g.total + num(i.amount)) * 100) / 100
    cutMap.set(i.gathering.id, g)
  }
  return {
    month: r.label,
    income: {
      total: Math.round(incomeTotal * 100) / 100,
      byKind: groupSum(incomes, (i) => i.kind, (i) => num(i.amount)),
      bySource: groupSum(incomes, (i) => i.source, (i) => num(i.amount)),
    },
    expenses: { total: Math.round(expenseTotal * 100) / 100, byCategory: groupSum(expenses, (e) => e.category, (e) => num(e.amount)) },
    balance: balanceOf(incomeTotal, expenseTotal),
    cuts: [...cutMap.values()].sort((a, b) => b.date.localeCompare(a.date)),
    alerts: { pendingDonations, draftPayroll, vehicleAlerts },
  }
}

// ── Ingresos ─────────────────────────────────────────────────────────────────

export interface IncomeDto {
  id: string
  kind: string
  source: string
  amount: number
  receivedAt: string
  concept: string | null
  reference: string | null
  gatheringLabel: string | null
  memberName: string | null
  notes: string | null
}

export async function listIncomes(actor: Actor, month: string | undefined): Promise<IncomeDto[]> {
  assertView(actor)
  const r = monthRange(month)
  const rows = await prisma.income.findMany({
    where: { organizationId: actor.organizationId, receivedAt: { gte: r.start, lt: r.end } },
    include: { gathering: { select: { topic: true, series: { select: { name: true } } } }, member: { select: { fullName: true } } },
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  })
  return rows.map((i) => ({
    id: i.id,
    kind: i.kind,
    source: i.source,
    amount: num(i.amount),
    receivedAt: ymd(i.receivedAt)!,
    concept: i.concept,
    reference: i.reference,
    gatheringLabel: i.gathering ? [i.gathering.series?.name, i.gathering.topic].filter(Boolean).join(" · ") || "Reunión" : null,
    memberName: i.member?.fullName ?? null,
    notes: i.notes,
  }))
}

const KINDS = ["tithe", "offering", "donation", "event", "school", "other"] as const
const SOURCES = ["cash_cut", "transfer", "online", "other"] as const

export async function createIncome(actor: Actor, input: Record<string, unknown>) {
  assertManage(actor)
  const kind = (KINDS as readonly string[]).includes(String(input.kind)) ? (String(input.kind) as (typeof KINDS)[number]) : null
  if (!kind) throw new CrudError("Elige el tipo de ingreso", 400, "kind")
  const amount = money(input.amount)
  if (amount === null || amount <= 0) throw new CrudError("Anota un monto mayor a cero", 400, "amount")
  const receivedAt = toDate(input.receivedAt)
  if (!receivedAt) throw new CrudError("Elige la fecha", 400, "receivedAt")
  const source = (SOURCES as readonly string[]).includes(String(input.source)) ? (String(input.source) as (typeof SOURCES)[number]) : "other"
  const row = await prisma.income.create({
    data: {
      organizationId: actor.organizationId,
      kind,
      source,
      amount,
      receivedAt,
      concept: text(input.concept, 150),
      reference: text(input.reference, 80),
      notes: text(input.notes, 500),
      memberId: await validMember(actor.organizationId, input.memberId),
      gatheringId: await validGathering(actor.organizationId, input.gatheringId),
      campaignId: (await openCampaignOrThrow(actor.organizationId, input.campaignId))?.id ?? null,
      createdByUserId: actor.userId,
    },
    select: { id: true },
  })
  return { id: row.id }
}

async function validMember(organizationId: string, raw: unknown) {
  const id = text(raw, 40)
  if (!id) return null
  const m = await prisma.member.findFirst({ where: { id, organizationId }, select: { id: true } })
  if (!m) throw new CrudError("Persona no válida", 400, "memberId")
  return m.id
}
async function validGathering(organizationId: string, raw: unknown) {
  const id = text(raw, 40)
  if (!id) return null
  const g = await prisma.gathering.findFirst({ where: { id, organizationId }, select: { id: true } })
  if (!g) throw new CrudError("Reunión no válida", 400, "gatheringId")
  return g.id
}

/** Corte de una reunión: diezmos, ofrendas y otros en un solo registro. */
export async function createCut(actor: Actor, input: { gatheringId?: unknown; date?: unknown; tithes?: unknown; offerings?: unknown; others?: unknown; source?: unknown; notes?: unknown }) {
  assertManage(actor)
  const gatheringId = await validGathering(actor.organizationId, input.gatheringId)
  const receivedAt = toDate(input.date)
  if (!receivedAt) throw new CrudError("Elige la fecha del corte", 400, "date")
  const parts: { kind: "tithe" | "offering" | "other"; amount: number }[] = []
  for (const [kind, raw] of [["tithe", input.tithes], ["offering", input.offerings], ["other", input.others]] as const) {
    if (raw === undefined || raw === null || raw === "") continue
    const n = money(raw)
    if (n === null) throw new CrudError("Monto inválido", 400, kind === "tithe" ? "tithes" : kind === "offering" ? "offerings" : "others")
    if (n > 0) parts.push({ kind, amount: n })
  }
  if (parts.length === 0) throw new CrudError("Anota al menos un monto", 400, "tithes")
  if (gatheringId) {
    const exists = await prisma.income.count({ where: { organizationId: actor.organizationId, gatheringId, source: "cash_cut" } })
    if (exists > 0) throw new CrudError("Esa reunión ya tiene su corte; elimínalo para registrarlo de nuevo", 409, "gatheringId")
  }
  const source = input.source === "transfer" ? "transfer" : "cash_cut"
  await prisma.income.createMany({
    data: parts.map((p) => ({
      organizationId: actor.organizationId,
      kind: p.kind,
      source,
      amount: p.amount,
      receivedAt,
      gatheringId,
      concept: p.kind === "other" ? "Otros ingresos del corte" : null,
      notes: text(input.notes, 500),
      createdByUserId: actor.userId,
    })),
  })
  return { count: parts.length, total: Math.round(parts.reduce((s, p) => s + p.amount, 0) * 100) / 100 }
}

export async function deleteIncome(actor: Actor, id: string) {
  assertManage(actor)
  const row = await prisma.income.findFirst({ where: { id, organizationId: actor.organizationId }, select: { donationId: true } })
  if (!row) throw new CrudError("Ingreso no encontrado", 404)
  if (row.donationId) throw new CrudError("Este ingreso viene de un donativo confirmado; no se elimina desde aquí", 409)
  await prisma.income.delete({ where: { id } })
  return { ok: true }
}

/** Reuniones recientes para ligarles un corte (sin exponer su asistencia). */
export async function listGatheringsForCut(actor: Actor) {
  assertView(actor)
  const rows = await prisma.gathering.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { date: "desc" },
    take: 40,
    select: { id: true, date: true, topic: true, series: { select: { name: true } }, ownerMinistry: { select: { name: true } }, _count: { select: { incomes: { where: { source: "cash_cut" } } } } },
  })
  return rows.map((g) => ({
    id: g.id,
    date: ymd(g.date)!,
    label: [g.ownerMinistry?.name, g.series?.name, g.topic].filter(Boolean).join(" · ") || "Reunión",
    hasCut: g._count.incomes > 0,
  }))
}

// ── Gastos ───────────────────────────────────────────────────────────────────

export interface ExpenseRowDto {
  id: string
  concept: string
  category: string
  amount: number
  spentAt: string
  vendor: string | null
  receiptUrl: string | null
  paymentMethod: string | null
  notes: string | null
  eventName: string | null
  vehicleName: string | null
  isPayroll: boolean
}

export async function listExpenses(actor: Actor, month: string | undefined): Promise<ExpenseRowDto[]> {
  assertView(actor)
  const r = monthRange(month)
  const rows = await prisma.expense.findMany({
    where: { organizationId: actor.organizationId, spentAt: { gte: r.start, lt: r.end } },
    include: { event: { select: { name: true } }, vehicle: { select: { name: true } } },
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  })
  return rows.map((e) => ({
    id: e.id,
    concept: e.concept,
    category: e.category,
    amount: num(e.amount),
    spentAt: ymd(e.spentAt)!,
    vendor: e.vendor,
    receiptUrl: e.receiptUrl,
    paymentMethod: e.paymentMethod,
    notes: e.notes,
    eventName: e.event?.name ?? null,
    vehicleName: e.vehicle?.name ?? null,
    isPayroll: e.payrollRunId !== null,
  }))
}

export async function saveExpense(actor: Actor, id: string | null, input: Record<string, unknown>) {
  assertManage(actor)
  const concept = text(input.concept, 150)
  if (!concept) throw new CrudError("Escribe el concepto", 400, "concept")
  const amount = money(input.amount)
  if (amount === null || amount <= 0) throw new CrudError("Anota un monto mayor a cero", 400, "amount")
  const spentAt = toDate(input.spentAt)
  if (!spentAt) throw new CrudError("Elige la fecha", 400, "spentAt")
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : "otro"
  const data = {
    concept,
    category,
    amount,
    spentAt,
    vendor: text(input.vendor, 150),
    receiptUrl: text(input.receiptUrl, 500),
    paymentMethod: ["cash", "transfer", "card", "other"].includes(String(input.paymentMethod)) ? (String(input.paymentMethod) as "cash" | "transfer" | "card" | "other") : null,
    notes: text(input.notes, 500),
  }
  if (id) {
    const found = await prisma.expense.findFirst({ where: { id, organizationId: actor.organizationId }, select: { payrollRunId: true } })
    if (!found) throw new CrudError("Gasto no encontrado", 404)
    if (found.payrollRunId) throw new CrudError("El gasto de nómina se genera desde la nómina", 409)
    await prisma.expense.update({ where: { id }, data })
    return { id }
  }
  const row = await prisma.expense.create({ data: { ...data, organizationId: actor.organizationId, createdByUserId: actor.userId } })
  return { id: row.id }
}

export async function deleteExpense(actor: Actor, id: string) {
  assertManage(actor)
  const found = await prisma.expense.findFirst({ where: { id, organizationId: actor.organizationId }, select: { payrollRunId: true } })
  if (!found) throw new CrudError("Gasto no encontrado", 404)
  if (found.payrollRunId) throw new CrudError("El gasto de nómina no se elimina desde aquí", 409)
  await prisma.expense.delete({ where: { id } })
  return { ok: true }
}

// ── Donativos ────────────────────────────────────────────────────────────────

export interface DonationDto {
  id: string
  donor: string
  amount: number
  kind: string
  provider: string | null
  reference: string | null
  status: "pending" | "paid" | "failed" | "refunded"
  createdAt: string
  paidAt: string | null
  notes: string | null
  campaignName: string | null
}

const donationDto = (d: { id: string; donorName: string | null; member: { fullName: string } | null; amount: unknown; kind: string; provider: string | null; reference: string | null; status: DonationDto["status"]; createdAt: Date; paidAt: Date | null; notes: string | null; campaign?: { name: string } | null }): DonationDto => ({
  id: d.id,
  donor: d.member?.fullName ?? d.donorName ?? "Anónimo",
  amount: num(d.amount as { toString(): string }),
  kind: d.kind,
  provider: d.provider,
  reference: d.reference,
  status: d.status,
  createdAt: d.createdAt.toISOString(),
  paidAt: d.paidAt?.toISOString() ?? null,
  notes: d.notes,
  campaignName: d.campaign?.name ?? null,
})

export async function listDonations(actor: Actor, status?: string): Promise<DonationDto[]> {
  assertView(actor)
  const rows = await prisma.donation.findMany({
    where: { organizationId: actor.organizationId, ...(["pending", "paid", "failed", "refunded"].includes(String(status)) ? { status: status as DonationDto["status"] } : {}) },
    include: { member: { select: { fullName: true } }, campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return rows.map(donationDto)
}

/** El creyente avisa que ya hizo su transferencia; tesorería la confirma. */
export async function reportMyDonation(actor: Actor, input: { amount?: unknown; kind?: unknown; reference?: unknown; notes?: unknown; campaignId?: unknown }) {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) throw new CrudError("Tu usuario aún no tiene ficha de creyente", 409)
  const amount = money(input.amount)
  if (amount === null || amount <= 0) throw new CrudError("Anota un monto mayor a cero", 400, "amount")
  const kind = ["tithe", "offering", "donation"].includes(String(input.kind)) ? (String(input.kind) as "tithe" | "offering" | "donation") : "donation"
  const pending = await prisma.donation.count({ where: { organizationId: actor.organizationId, memberId, status: "pending" } })
  if (pending >= 5) throw new CrudError("Tienes varios avisos pendientes; espera a que se confirmen", 409)
  const campaign = await openCampaignOrThrow(actor.organizationId, input.campaignId)
  const row = await prisma.donation.create({
    data: { organizationId: actor.organizationId, memberId, amount, kind, reference: text(input.reference, 80), notes: text(input.notes, 300), campaignId: campaign?.id ?? null },
    select: { id: true },
  })
  fireAndForget(
    notifyPermission(actor.organizationId, "finance.manage", {
      kind: "donation_report",
      title: "Aviso de transferencia por confirmar",
      body: `Una persona avisó una transferencia por ${amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.`,
      link: "/admin/finance",
      excludeUserId: actor.userId,
    })
  )
  return { id: row.id }
}

export async function listMyDonations(actor: Actor): Promise<DonationDto[]> {
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) return []
  const rows = await prisma.donation.findMany({
    where: { organizationId: actor.organizationId, memberId },
    include: { member: { select: { fullName: true } }, campaign: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return rows.map(donationDto)
}

export async function decideDonation(actor: Actor, id: string, input: { decision?: unknown; receivedAt?: unknown }) {
  assertManage(actor)
  const d = await prisma.donation.findFirst({ where: { id, organizationId: actor.organizationId } })
  if (!d) throw new CrudError("Donativo no encontrado", 404)
  if (d.status !== "pending") throw new CrudError("Ese donativo ya fue resuelto", 409)
  if (d.provider && input.decision === "confirm") {
    throw new CrudError("Los pagos en línea se confirman solos cuando la pasarela los cobra", 409)
  }
  if (input.decision === "reject") {
    await prisma.donation.update({ where: { id }, data: { status: "failed" } })
    if (!d.provider) {
      fireAndForget(
        notifyMembers(actor.organizationId, [d.memberId], {
          kind: "donation_rejected",
          title: "No pudimos confirmar tu transferencia",
          body: "Revisa los datos o comunícate con la tesorería.",
          link: "/mi/donativos",
        })
      )
    }
    return { ok: true }
  }
  if (input.decision !== "confirm") throw new CrudError("Decisión no válida", 400)
  const receivedAt = toDate(input.receivedAt) ?? today()
  await prisma.$transaction([
    prisma.donation.update({ where: { id }, data: { status: "paid", paidAt: new Date() } }),
    prisma.income.create({
      data: {
        organizationId: actor.organizationId,
        kind: d.kind,
        source: d.provider ? "online" : "transfer",
        amount: d.amount,
        receivedAt,
        memberId: d.memberId,
        reference: d.reference,
        concept: d.campaignId ? "Donativo a campaña" : "Donativo confirmado",
        donationId: d.id,
        campaignId: d.campaignId,
        createdByUserId: actor.userId,
      },
    }),
  ])
  // El recibo nace con la confirmación: folio consecutivo del año.
  await ensureReceiptFolio(actor.organizationId, d.id, new Date()).catch((err) => console.error("[receipt]", err))
  fireAndForget(
    notifyMembers(actor.organizationId, [d.memberId], {
      kind: "donation_paid",
      severity: "success",
      title: "¡Gracias por tu aportación!",
      body: "La tesorería confirmó tu transferencia. Ya puedes descargar tu recibo.",
      link: "/mi/donativos",
    })
  )
  return { ok: true }
}

/**
 * Pago en línea ya cobrado por una pasarela (para el webhook del proveedor).
 * Idempotente por (provider, externalId): reintentos no duplican el ingreso.
 */
export async function recordOnlineDonation(
  organizationId: string,
  input: { provider: string; externalId: string; amount: number; currency?: string; kind?: "tithe" | "offering" | "donation"; memberId?: string | null; donorName?: string | null; email?: string | null; paidAt?: Date }
) {
  const existing = await prisma.donation.findUnique({ where: { provider_externalId: { provider: input.provider, externalId: input.externalId } } })
  if (existing) return existing
  const paidAt = input.paidAt ?? new Date()
  const donation = await prisma.donation.create({
    data: {
      organizationId,
      memberId: input.memberId ?? null,
      donorName: input.donorName ?? null,
      email: input.email ?? null,
      amount: input.amount,
      currency: input.currency ?? "MXN",
      kind: input.kind ?? "donation",
      provider: input.provider,
      externalId: input.externalId,
      status: "paid",
      paidAt,
    },
  })
  await prisma.income.create({
    data: {
      organizationId,
      kind: donation.kind,
      source: "online",
      amount: donation.amount,
      receivedAt: new Date(`${paidAt.toISOString().slice(0, 10)}T00:00:00.000Z`),
      memberId: donation.memberId,
      concept: "Donativo en línea",
      reference: input.externalId,
      donationId: donation.id,
    },
  })
  return donation
}

/** Datos para donar que la iglesia publica en su perfil. */
export async function getDonationInfo(actor: Actor) {
  const p = await prisma.companyProfile.findUnique({ where: { organizationId: actor.organizationId } })
  const online = (await prisma.paymentGateway.findMany({ where: { organizationId: actor.organizationId, isActive: true }, select: { provider: true } })).map((g) => g.provider)
  if (!p?.donationsEnabled) return { enabled: false as const, online }
  return {
    enabled: true as const,
    online,
    bank: p.donationBank,
    holder: p.donationHolder,
    clabe: p.donationClabe,
    account: p.donationAccount,
    card: p.donationCard,
    link: p.donationLink,
    note: p.donationNote,
  }
}

// ── Vehículos ────────────────────────────────────────────────────────────────

function assertVehicleView(actor: Actor) {
  if (!actor.canViewVehicles && !actor.canManageVehicles) throw new CrudError("No tienes permiso para ver los vehículos", 403)
}
function assertVehicleManage(actor: Actor) {
  if (!actor.canManageVehicles) throw new CrudError("No tienes permiso para gestionar vehículos", 403)
}

async function countVehicleAlerts(organizationId: string): Promise<number> {
  const [docs, services, vehicles] = await Promise.all([
    prisma.vehicleDocument.findMany({ where: { organizationId, vehicle: { isActive: true }, expiresAt: { not: null } }, select: { expiresAt: true, vehicleId: true, kind: true, issuedAt: true } }),
    prisma.vehicleService.findMany({ where: { organizationId, vehicle: { isActive: true }, OR: [{ nextDueDate: { not: null } }, { nextDueOdometer: { not: null } }] }, orderBy: { date: "desc" } }),
    prisma.vehicle.findMany({ where: { organizationId, isActive: true }, select: { id: true, odometer: true } }),
  ])
  // Solo cuenta el documento vigente más reciente de cada tipo por vehículo.
  const latestDoc = new Map<string, Date>()
  for (const d of docs) {
    const k = `${d.vehicleId}:${d.kind}`
    const cur = latestDoc.get(k)
    if (!cur || (d.expiresAt && d.expiresAt > cur)) latestDoc.set(k, d.expiresAt!)
  }
  let n = [...latestDoc.values()].filter((d) => expiryStatus(d) !== "ok").length
  const odo = new Map(vehicles.map((v) => [v.id, v.odometer]))
  const seen = new Set<string>()
  for (const s of services) {
    if (seen.has(s.vehicleId)) continue
    seen.add(s.vehicleId)
    if (serviceDue({ date: s.nextDueDate, odometer: s.nextDueOdometer }, { odometer: odo.get(s.vehicleId) ?? 0 })) n += 1
  }
  return n
}

export interface VehicleRowDto {
  id: string
  name: string
  plate: string | null
  kind: string
  year: number | null
  odometer: number
  isActive: boolean
  alerts: { label: string; status: DocStatus | "due" }[]
}

export async function listVehicles(actor: Actor): Promise<VehicleRowDto[]> {
  assertVehicleView(actor)
  const rows = await prisma.vehicle.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      documents: { where: { expiresAt: { not: null } }, orderBy: { expiresAt: "desc" } },
      services: { where: { OR: [{ nextDueDate: { not: null } }, { nextDueOdometer: { not: null } }] }, orderBy: { date: "desc" }, take: 1 },
    },
  })
  return rows.map((v) => {
    const alerts: VehicleRowDto["alerts"] = []
    const seen = new Set<string>()
    for (const d of v.documents) {
      if (seen.has(d.kind)) continue
      seen.add(d.kind)
      const st = expiryStatus(d.expiresAt)
      if (st === "soon" || st === "expired") alerts.push({ label: DOC_LABEL[d.kind] ?? d.kind, status: st })
    }
    const s = v.services[0]
    if (s && serviceDue({ date: s.nextDueDate, odometer: s.nextDueOdometer }, { odometer: v.odometer })) alerts.push({ label: "Servicio", status: "due" })
    return { id: v.id, name: v.name, plate: v.plate, kind: v.kind, year: v.year, odometer: v.odometer, isActive: v.isActive, alerts }
  })
}

const DOC_LABEL: Record<string, string> = { insurance: "Seguro", verification: "Verificación", registration: "Tarjeta de circulación", permit: "Permiso", other: "Documento" }

export interface VehicleDetailDto {
  vehicle: { id: string; name: string; plate: string | null; make: string | null; model: string | null; year: number | null; kind: string; capacity: number | null; odometer: number; isActive: boolean; notes: string | null }
  logs: { id: string; date: string; driver: string | null; purpose: string; destination: string | null; odometerStart: number | null; odometerEnd: number | null; km: number | null; notes: string | null }[]
  services: { id: string; kind: string; date: string; description: string; vendor: string | null; cost: number; odometer: number | null; nextDueDate: string | null; nextDueOdometer: number | null }[]
  fuels: { id: string; date: string; liters: number; cost: number; odometer: number | null; station: string | null; kmPerLiter: number | null }[]
  documents: { id: string; kind: string; label: string; number: string | null; provider: string | null; issuedAt: string | null; expiresAt: string | null; cost: number; fileUrl: string | null; status: DocStatus }[]
  totals: { services: number; fuel: number; documents: number; all: number }
  serviceDue: boolean
}

export async function getVehicle(actor: Actor, id: string): Promise<VehicleDetailDto> {
  assertVehicleView(actor)
  const v = await prisma.vehicle.findFirst({
    where: { id, organizationId: actor.organizationId },
    include: {
      logs: { orderBy: { date: "desc" }, take: 100, include: { driver: { select: { fullName: true } } } },
      services: { orderBy: { date: "desc" }, take: 100 },
      fuels: { orderBy: [{ date: "desc" }, { odometer: "desc" }], take: 100 },
      documents: { orderBy: [{ expiresAt: "desc" }] },
    },
  })
  if (!v) throw new CrudError("Vehículo no encontrado", 404)
  const fuelAsc = [...v.fuels].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.odometer ?? 0) - (b.odometer ?? 0))
  const eff = new Map<string, number | null>()
  fuelAsc.forEach((f, i) => eff.set(f.id, i === 0 ? null : kmPerLiter(fuelAsc[i - 1].odometer, f.odometer, num(f.liters))))
  const latestService = v.services.find((s) => s.nextDueDate || s.nextDueOdometer)
  const sum = (xs: { toString(): string }[]) => Math.round(xs.reduce<number>((a, c) => a + num(c), 0) * 100) / 100
  const totals = { services: sum(v.services.map((s) => s.cost)), fuel: sum(v.fuels.map((f) => f.cost)), documents: sum(v.documents.map((d) => d.cost)), all: 0 }
  totals.all = Math.round((totals.services + totals.fuel + totals.documents) * 100) / 100
  return {
    vehicle: { id: v.id, name: v.name, plate: v.plate, make: v.make, model: v.model, year: v.year, kind: v.kind, capacity: v.capacity, odometer: v.odometer, isActive: v.isActive, notes: v.notes },
    logs: v.logs.map((l) => ({
      id: l.id,
      date: ymd(l.date)!,
      driver: l.driver?.fullName ?? l.driverName,
      purpose: l.purpose,
      destination: l.destination,
      odometerStart: l.odometerStart,
      odometerEnd: l.odometerEnd,
      km: l.odometerStart !== null && l.odometerEnd !== null && l.odometerEnd >= l.odometerStart ? l.odometerEnd - l.odometerStart : null,
      notes: l.notes,
    })),
    services: v.services.map((s) => ({ id: s.id, kind: s.kind, date: ymd(s.date)!, description: s.description, vendor: s.vendor, cost: num(s.cost), odometer: s.odometer, nextDueDate: ymd(s.nextDueDate), nextDueOdometer: s.nextDueOdometer })),
    fuels: v.fuels.map((f) => ({ id: f.id, date: ymd(f.date)!, liters: num(f.liters), cost: num(f.cost), odometer: f.odometer, station: f.station, kmPerLiter: eff.get(f.id) ?? null })),
    documents: v.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      label: DOC_LABEL[d.kind] ?? d.kind,
      number: d.number,
      provider: d.provider,
      issuedAt: ymd(d.issuedAt),
      expiresAt: ymd(d.expiresAt),
      cost: num(d.cost),
      fileUrl: d.fileUrl,
      status: expiryStatus(d.expiresAt),
    })),
    totals,
    serviceDue: latestService ? serviceDue({ date: latestService.nextDueDate, odometer: latestService.nextDueOdometer }, { odometer: v.odometer }) : false,
  }
}

export async function saveVehicle(actor: Actor, id: string | null, input: Record<string, unknown>) {
  assertVehicleManage(actor)
  const name = text(input.name, 100)
  if (!name) throw new CrudError("Escribe el nombre del vehículo", 400, "name")
  const year = input.year === "" || input.year === null || input.year === undefined ? null : Number(input.year)
  if (year !== null && (!Number.isInteger(year) || year < 1950 || year > 2100)) throw new CrudError("Año inválido", 400, "year")
  const capacity = input.capacity === "" || input.capacity === null || input.capacity === undefined ? null : Number(input.capacity)
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)) throw new CrudError("Capacidad inválida", 400, "capacity")
  const odometer = input.odometer === "" || input.odometer === undefined ? undefined : Number(input.odometer)
  if (odometer !== undefined && (!Number.isInteger(odometer) || odometer < 0)) throw new CrudError("Kilometraje inválido", 400, "odometer")
  const data = {
    name,
    plate: text(input.plate, 20)?.toUpperCase() ?? null,
    make: text(input.make, 60),
    model: text(input.model, 60),
    year,
    capacity,
    kind: text(input.kind, 30) ?? "auto",
    notes: text(input.notes, 1000),
    ...(odometer !== undefined ? { odometer } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive !== false } : {}),
  }
  try {
    if (id) {
      const r = await prisma.vehicle.updateMany({ where: { id, organizationId: actor.organizationId }, data })
      if (r.count === 0) throw new CrudError("Vehículo no encontrado", 404)
      return { id }
    }
    const row = await prisma.vehicle.create({ data: { ...data, organizationId: actor.organizationId } })
    return { id: row.id }
  } catch (err) {
    if (typeof err === "object" && err && (err as { code?: string }).code === "P2002") throw new CrudError("Ya existe un vehículo con ese nombre", 409, "name")
    throw err
  }
}

async function vehicleFor(actor: Actor, id: string) {
  const v = await prisma.vehicle.findFirst({ where: { id, organizationId: actor.organizationId }, select: { id: true, name: true, odometer: true } })
  if (!v) throw new CrudError("Vehículo no encontrado", 404)
  return v
}

/** El kilometraje del vehículo solo sube. */
async function bumpOdometer(vehicleId: string, odometer: number | null) {
  if (odometer === null) return
  await prisma.vehicle.updateMany({ where: { id: vehicleId, odometer: { lt: odometer } }, data: { odometer } })
}

const intOrNull = (v: unknown, label: string) => {
  if (v === "" || v === null || v === undefined) return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > 5_000_000) throw new CrudError(`${label} inválido`, 400)
  return n
}

export async function addVehicleLog(actor: Actor, vehicleId: string, input: Record<string, unknown>) {
  assertVehicleManage(actor)
  await vehicleFor(actor, vehicleId)
  const date = toDate(input.date)
  if (!date) throw new CrudError("Elige la fecha", 400, "date")
  const purpose = text(input.purpose, 200)
  if (!purpose) throw new CrudError("Anota el motivo del viaje", 400, "purpose")
  const start = intOrNull(input.odometerStart, "Kilometraje inicial")
  const end = intOrNull(input.odometerEnd, "Kilometraje final")
  if (start !== null && end !== null && end < start) throw new CrudError("El kilometraje final no puede ser menor al inicial", 400, "odometerEnd")
  await prisma.vehicleLog.create({
    data: {
      organizationId: actor.organizationId,
      vehicleId,
      date,
      purpose,
      destination: text(input.destination, 150),
      driverMemberId: await validMember(actor.organizationId, input.driverMemberId),
      driverName: text(input.driverName, 100),
      odometerStart: start,
      odometerEnd: end,
      notes: text(input.notes, 300),
    },
  })
  await bumpOdometer(vehicleId, end ?? start)
  return { ok: true }
}

async function expenseFor(actor: Actor, vehicle: { id: string; name: string }, data: { concept: string; amount: number; spentAt: Date; vendor: string | null }) {
  if (data.amount <= 0) return null
  const e = await prisma.expense.create({
    data: { organizationId: actor.organizationId, vehicleId: vehicle.id, category: "vehiculo", concept: `${data.concept} · ${vehicle.name}`, amount: data.amount, spentAt: data.spentAt, vendor: data.vendor, createdByUserId: actor.userId },
    select: { id: true },
  })
  return e.id
}

export async function addVehicleService(actor: Actor, vehicleId: string, input: Record<string, unknown>) {
  assertVehicleManage(actor)
  const v = await vehicleFor(actor, vehicleId)
  const date = toDate(input.date)
  if (!date) throw new CrudError("Elige la fecha", 400, "date")
  const description = text(input.description, 200)
  if (!description) throw new CrudError("Describe el servicio", 400, "description")
  const cost = input.cost === "" || input.cost === undefined ? 0 : money(input.cost)
  if (cost === null) throw new CrudError("Costo inválido", 400, "cost")
  const odometer = intOrNull(input.odometer, "Kilometraje")
  const kind = ["service", "repair", "tires", "other"].includes(String(input.kind)) ? String(input.kind) : "service"
  const vendor = text(input.vendor, 100)
  const expenseId = await expenseFor(actor, v, { concept: description, amount: cost, spentAt: date, vendor })
  await prisma.vehicleService.create({
    data: {
      organizationId: actor.organizationId,
      vehicleId,
      kind,
      date,
      description,
      vendor,
      cost,
      odometer,
      nextDueDate: input.nextDueDate ? toDate(input.nextDueDate) : null,
      nextDueOdometer: intOrNull(input.nextDueOdometer, "Próximo kilometraje"),
      expenseId,
    },
  })
  await bumpOdometer(vehicleId, odometer)
  return { ok: true }
}

export async function addVehicleFuel(actor: Actor, vehicleId: string, input: Record<string, unknown>) {
  assertVehicleManage(actor)
  const v = await vehicleFor(actor, vehicleId)
  const date = toDate(input.date)
  if (!date) throw new CrudError("Elige la fecha", 400, "date")
  const liters = money(input.liters)
  const cost = money(input.cost)
  if (liters === null || liters <= 0) throw new CrudError("Anota los litros", 400, "liters")
  if (cost === null || cost <= 0) throw new CrudError("Anota el importe", 400, "cost")
  const odometer = intOrNull(input.odometer, "Kilometraje")
  const station = text(input.station, 100)
  const expenseId = await expenseFor(actor, v, { concept: "Combustible", amount: cost, spentAt: date, vendor: station })
  await prisma.vehicleFuel.create({ data: { organizationId: actor.organizationId, vehicleId, date, liters, cost, odometer, station, expenseId } })
  await bumpOdometer(vehicleId, odometer)
  return { ok: true }
}

export async function addVehicleDocument(actor: Actor, vehicleId: string, input: Record<string, unknown>) {
  assertVehicleManage(actor)
  const v = await vehicleFor(actor, vehicleId)
  const kind = ["insurance", "verification", "registration", "permit", "other"].includes(String(input.kind)) ? (String(input.kind) as "insurance" | "verification" | "registration" | "permit" | "other") : "other"
  const expiresAt = input.expiresAt ? toDate(input.expiresAt) : null
  if (input.expiresAt && !expiresAt) throw new CrudError("Fecha de vencimiento inválida", 400, "expiresAt")
  const issuedAt = input.issuedAt ? toDate(input.issuedAt) : null
  const cost = input.cost === "" || input.cost === undefined ? 0 : money(input.cost)
  if (cost === null) throw new CrudError("Costo inválido", 400, "cost")
  const provider = text(input.provider, 100)
  const expenseId = await expenseFor(actor, v, { concept: DOC_LABEL[kind] ?? "Documento", amount: cost, spentAt: issuedAt ?? today(), vendor: provider })
  await prisma.vehicleDocument.create({
    data: {
      organizationId: actor.organizationId,
      vehicleId,
      kind,
      number: text(input.number, 60),
      provider,
      issuedAt,
      expiresAt,
      cost,
      fileUrl: text(input.fileUrl, 500),
      notes: text(input.notes, 300),
      expenseId,
    },
  })
  return { ok: true }
}

/** Quita un renglón (y el gasto que generó). */
export async function deleteVehicleEntry(actor: Actor, vehicleId: string, kind: string, id: string) {
  assertVehicleManage(actor)
  await vehicleFor(actor, vehicleId)
  const where = { id, vehicleId, organizationId: actor.organizationId }
  let expenseId: string | null = null
  if (kind === "log") {
    const r = await prisma.vehicleLog.deleteMany({ where })
    if (r.count === 0) throw new CrudError("Registro no encontrado", 404)
  } else if (kind === "service") {
    const row = await prisma.vehicleService.findFirst({ where, select: { expenseId: true } })
    if (!row) throw new CrudError("Registro no encontrado", 404)
    expenseId = row.expenseId
    await prisma.vehicleService.deleteMany({ where })
  } else if (kind === "fuel") {
    const row = await prisma.vehicleFuel.findFirst({ where, select: { expenseId: true } })
    if (!row) throw new CrudError("Registro no encontrado", 404)
    expenseId = row.expenseId
    await prisma.vehicleFuel.deleteMany({ where })
  } else if (kind === "document") {
    const row = await prisma.vehicleDocument.findFirst({ where, select: { expenseId: true } })
    if (!row) throw new CrudError("Registro no encontrado", 404)
    expenseId = row.expenseId
    await prisma.vehicleDocument.deleteMany({ where })
  } else {
    throw new CrudError("Tipo de registro no válido", 400)
  }
  if (expenseId) await prisma.expense.deleteMany({ where: { id: expenseId, organizationId: actor.organizationId } })
  return { ok: true }
}
