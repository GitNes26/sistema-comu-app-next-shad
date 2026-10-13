import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import type { Actor } from "@/lib/ministries/server"
import { EXPENSE_CATEGORIES } from "@/lib/finance/rules"
import { autoMatches, candidatesFor, dedupeKeys, parseBankCsv, type Candidate, type Movement, type ParseResult } from "./bank-rules"

// Conciliación bancaria: el estado de cuenta (CSV) se coteja con los ingresos y gastos
// registrados. Ver es de finanzas (`finance.view`); conciliar, de `finance.manage`.

const num = (d: { toString(): string } | null | undefined) => (d === null || d === undefined ? 0 : Number(d.toString()))
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const dateOf = (s: string) => new Date(`${s}T00:00:00.000Z`)

function assertView(actor: Actor) {
  if (!actor.canViewFinance && !actor.canManageFinance) throw new CrudError("No tienes permiso para ver las finanzas", 403)
}
function assertManage(actor: Actor) {
  if (!actor.canManageFinance) throw new CrudError("No tienes permiso para conciliar movimientos", 403)
}

const MAX_CSV = 1_500_000
const MAX_LINES = 5000

export interface BankPreviewDto {
  lines: number
  errors: ParseResult["errors"]
  columns: ParseResult["columns"]
  delimiter: string
  periodFrom: string | null
  periodTo: string | null
  deposits: number
  withdrawals: number
  sample: { date: string; description: string; amount: number }[]
}

function readCsv(csv: unknown): ParseResult {
  if (typeof csv !== "string" || csv.trim() === "") throw new CrudError("El archivo está vacío", 400, "csv")
  if (csv.length > MAX_CSV) throw new CrudError("El archivo es demasiado grande (máximo ~1.5 MB)", 413, "csv")
  const parsed = parseBankCsv(csv)
  if (parsed.lines.length === 0) throw new CrudError(parsed.errors[0]?.reason ?? "No se encontraron movimientos en el archivo", 400, "csv")
  if (parsed.lines.length > MAX_LINES) throw new CrudError(`El archivo trae más de ${MAX_LINES} movimientos; divídelo por periodos`, 400, "csv")
  return parsed
}

export function previewStatement(actor: Actor, csv: unknown): BankPreviewDto {
  assertManage(actor)
  const p = readCsv(csv)
  const dates = p.lines.map((l) => l.date).sort()
  return {
    lines: p.lines.length,
    errors: p.errors.slice(0, 20),
    columns: p.columns,
    delimiter: p.delimiter,
    periodFrom: dates[0] ?? null,
    periodTo: dates.at(-1) ?? null,
    deposits: Math.round(p.lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0) * 100) / 100,
    withdrawals: Math.round(Math.abs(p.lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0)) * 100) / 100,
    sample: p.lines.slice(0, 5).map((l) => ({ date: l.date, description: l.description, amount: l.amount })),
  }
}

export async function importStatement(actor: Actor, input: { label?: unknown; fileName?: unknown; csv?: unknown }) {
  assertManage(actor)
  const p = readCsv(input.csv)
  const label = typeof input.label === "string" && input.label.trim() ? input.label.trim().slice(0, 120) : "Estado de cuenta"
  const keys = dedupeKeys(p.lines)
  const existing = await prisma.bankLine.findMany({
    where: { organizationId: actor.organizationId, dedupeKey: { in: keys } },
    select: { dedupeKey: true },
  })
  const known = new Set(existing.map((e) => e.dedupeKey))
  const fresh = p.lines.map((l, i) => ({ l, key: keys[i] })).filter((x) => !known.has(x.key))
  if (fresh.length === 0) throw new CrudError("Todos los movimientos de este archivo ya estaban importados", 409)
  const dates = fresh.map((x) => x.l.date).sort()
  const statement = await prisma.bankStatement.create({
    data: {
      organizationId: actor.organizationId,
      label,
      fileName: typeof input.fileName === "string" ? input.fileName.slice(0, 200) : null,
      periodFrom: dateOf(dates[0]),
      periodTo: dateOf(dates.at(-1)!),
      uploadedByUserId: actor.userId,
      lines: {
        create: fresh.map(({ l, key }) => ({
          organizationId: actor.organizationId,
          date: dateOf(l.date),
          description: l.description,
          reference: l.reference,
          amount: l.amount,
          balance: l.balance,
          dedupeKey: key,
        })),
      },
    },
    select: { id: true },
  })
  return { id: statement.id, imported: fresh.length, duplicates: p.lines.length - fresh.length, skipped: p.errors.length }
}

// ── Consulta ─────────────────────────────────────────────────────────────────

export interface StatementDto {
  id: string
  label: string
  fileName: string | null
  periodFrom: string | null
  periodTo: string | null
  createdAt: string
  counts: { pending: number; matched: number; ignored: number; total: number }
  deposits: number
  withdrawals: number
}

export async function listStatements(actor: Actor): Promise<StatementDto[]> {
  assertView(actor)
  const rows = await prisma.bankStatement.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { lines: { select: { status: true, amount: true } } },
  })
  return rows.map((s) => {
    const counts = { pending: 0, matched: 0, ignored: 0, total: s.lines.length }
    let deposits = 0
    let withdrawals = 0
    for (const l of s.lines) {
      if (l.status === "matched") counts.matched++
      else if (l.status === "ignored") counts.ignored++
      else counts.pending++
      const a = num(l.amount)
      if (a > 0) deposits += a
      else withdrawals += Math.abs(a)
    }
    return {
      id: s.id,
      label: s.label,
      fileName: s.fileName,
      periodFrom: s.periodFrom ? ymd(s.periodFrom) : null,
      periodTo: s.periodTo ? ymd(s.periodTo) : null,
      createdAt: s.createdAt.toISOString(),
      counts,
      deposits: Math.round(deposits * 100) / 100,
      withdrawals: Math.round(withdrawals * 100) / 100,
    }
  })
}

export interface BankLineDto {
  id: string
  date: string
  description: string
  reference: string | null
  amount: number
  balance: number | null
  status: "pending" | "matched" | "ignored"
  match: { kind: "income" | "expense"; id: string; label: string } | null
  candidates: Candidate[]
}

async function movementPool(organizationId: string, from: string, to: string, exceptMatched: boolean): Promise<Movement[]> {
  const start = new Date(dateOf(from).getTime() - 8 * 86_400_000)
  const end = new Date(dateOf(to).getTime() + 9 * 86_400_000)
  const [incomes, expenses, matched] = await Promise.all([
    prisma.income.findMany({
      where: { organizationId, receivedAt: { gte: start, lt: end } },
      select: { id: true, amount: true, receivedAt: true, concept: true, reference: true, member: { select: { fullName: true } } },
    }),
    prisma.expense.findMany({
      where: { organizationId, spentAt: { gte: start, lt: end } },
      select: { id: true, amount: true, spentAt: true, concept: true, vendor: true, notes: true },
    }),
    exceptMatched
      ? prisma.bankLine.findMany({ where: { organizationId, status: "matched" }, select: { matchKind: true, matchId: true } })
      : Promise.resolve([]),
  ])
  const taken = new Set(matched.map((m) => `${m.matchKind}:${m.matchId}`))
  return [
    ...incomes
      .filter((i) => !taken.has(`income:${i.id}`))
      .map((i): Movement => ({ id: i.id, kind: "income", amount: num(i.amount), date: ymd(i.receivedAt), text: [i.concept, i.member?.fullName].filter(Boolean).join(" · ") || "Ingreso", reference: i.reference })),
    ...expenses
      .filter((e) => !taken.has(`expense:${e.id}`))
      .map((e): Movement => ({ id: e.id, kind: "expense", amount: num(e.amount), date: ymd(e.spentAt), text: [e.concept, e.vendor].filter(Boolean).join(" · "), reference: null })),
  ]
}

export async function getStatement(actor: Actor, id: string) {
  assertView(actor)
  const s = await prisma.bankStatement.findFirst({ where: { id, organizationId: actor.organizationId } })
  if (!s) throw new CrudError("Estado de cuenta no encontrado", 404)
  const lines = await prisma.bankLine.findMany({ where: { statementId: id }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] })
  const matchedIds = {
    income: lines.filter((l) => l.matchKind === "income").map((l) => l.matchId!),
    expense: lines.filter((l) => l.matchKind === "expense").map((l) => l.matchId!),
  }
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ where: { id: { in: matchedIds.income } }, select: { id: true, concept: true, amount: true } }),
    prisma.expense.findMany({ where: { id: { in: matchedIds.expense } }, select: { id: true, concept: true, amount: true } }),
  ])
  const label = new Map<string, string>([
    ...incomes.map((i) => [`income:${i.id}`, i.concept ?? "Ingreso"] as const),
    ...expenses.map((e) => [`expense:${e.id}`, e.concept] as const),
  ])
  const pending = lines.filter((l) => l.status === "pending")
  let pool: Movement[] = []
  if (pending.length > 0) {
    const dates = pending.map((l) => ymd(l.date)).sort()
    pool = await movementPool(actor.organizationId, dates[0], dates.at(-1)!, true)
  }
  const dtos: BankLineDto[] = lines.map((l) => {
    const status = l.status === "matched" ? "matched" : l.status === "ignored" ? "ignored" : "pending"
    return {
      id: l.id,
      date: ymd(l.date),
      description: l.description,
      reference: l.reference,
      amount: num(l.amount),
      balance: l.balance === null ? null : num(l.balance),
      status,
      match: l.matchKind && l.matchId ? { kind: l.matchKind as "income" | "expense", id: l.matchId, label: label.get(`${l.matchKind}:${l.matchId}`) ?? "Movimiento" } : null,
      candidates: status === "pending" ? candidatesFor({ date: ymd(l.date), amount: num(l.amount), description: l.description, reference: l.reference }, pool).slice(0, 4) : [],
    }
  })
  const total = (f: (l: BankLineDto) => boolean) => Math.round(dtos.filter(f).reduce((a, l) => a + l.amount, 0) * 100) / 100
  return {
    statement: { id: s.id, label: s.label, periodFrom: s.periodFrom ? ymd(s.periodFrom) : null, periodTo: s.periodTo ? ymd(s.periodTo) : null },
    lines: dtos,
    summary: {
      pending: dtos.filter((l) => l.status === "pending").length,
      matched: dtos.filter((l) => l.status === "matched").length,
      ignored: dtos.filter((l) => l.status === "ignored").length,
      pendingAmount: total((l) => l.status === "pending"),
      matchedAmount: total((l) => l.status === "matched"),
    },
    canManage: Boolean(actor.canManageFinance),
  }
}

// ── Conciliar ────────────────────────────────────────────────────────────────

async function ownLine(actor: Actor, lineId: string) {
  assertManage(actor)
  const l = await prisma.bankLine.findFirst({ where: { id: lineId, organizationId: actor.organizationId } })
  if (!l) throw new CrudError("Renglón no encontrado", 404)
  return l
}

function isUnique(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002"
}

export async function matchLine(actor: Actor, lineId: string, input: { kind?: unknown; id?: unknown }) {
  const l = await ownLine(actor, lineId)
  if (l.status === "matched") throw new CrudError("Este renglón ya está conciliado", 409)
  if (input.kind !== "income" && input.kind !== "expense") throw new CrudError("Tipo de movimiento no válido", 400, "kind")
  if (typeof input.id !== "string" || !input.id) throw new CrudError("Elige el movimiento", 400, "id")
  const amount = num(l.amount)
  if ((amount > 0) !== (input.kind === "income")) throw new CrudError("Un depósito se concilia con un ingreso y un retiro con un gasto", 409, "kind")
  const mov =
    input.kind === "income"
      ? await prisma.income.findFirst({ where: { id: input.id, organizationId: actor.organizationId }, select: { amount: true } })
      : await prisma.expense.findFirst({ where: { id: input.id, organizationId: actor.organizationId }, select: { amount: true } })
  if (!mov) throw new CrudError("Movimiento no encontrado", 404)
  if (Math.round(num(mov.amount) * 100) !== Math.round(Math.abs(amount) * 100)) throw new CrudError("El importe del movimiento no coincide con el del banco", 409)
  try {
    await prisma.bankLine.update({
      where: { id: lineId },
      data: { status: "matched", matchKind: input.kind, matchId: input.id, matchedByUserId: actor.userId, matchedAt: new Date() },
    })
  } catch (err) {
    if (isUnique(err)) throw new CrudError("Ese movimiento ya está conciliado con otro renglón", 409)
    throw err
  }
  return { ok: true }
}

export async function unmatchLine(actor: Actor, lineId: string) {
  await ownLine(actor, lineId)
  await prisma.bankLine.update({ where: { id: lineId }, data: { status: "pending", matchKind: null, matchId: null, matchedByUserId: null, matchedAt: null } })
  return { ok: true }
}

export async function setIgnored(actor: Actor, lineId: string, ignored: boolean) {
  const l = await ownLine(actor, lineId)
  if (l.status === "matched") throw new CrudError("Primero quita la conciliación", 409)
  await prisma.bankLine.update({ where: { id: lineId }, data: { status: ignored ? "ignored" : "pending" } })
  return { ok: true }
}

/** Registra en el sistema el movimiento que faltaba y lo concilia con el renglón. */
export async function createFromLine(actor: Actor, lineId: string, input: { kind?: unknown; category?: unknown; concept?: unknown }) {
  const l = await ownLine(actor, lineId)
  if (l.status === "matched") throw new CrudError("Este renglón ya está conciliado", 409)
  const amount = num(l.amount)
  const concept = (typeof input.concept === "string" && input.concept.trim() ? input.concept.trim() : l.description).slice(0, 200)
  const id = await prisma.$transaction(async (tx) => {
    let movementId: string
    let kind: "income" | "expense"
    if (amount > 0) {
      const incomeKind = ["tithe", "offering", "donation", "event", "school", "other"].includes(String(input.kind)) ? String(input.kind) : "other"
      const row = await tx.income.create({
        data: {
          organizationId: actor.organizationId,
          kind: incomeKind as "other",
          source: "transfer",
          amount,
          receivedAt: l.date,
          concept,
          reference: l.reference,
          createdByUserId: actor.userId,
        },
        select: { id: true },
      })
      movementId = row.id
      kind = "income"
    } else {
      const category = (EXPENSE_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : "otro"
      const row = await tx.expense.create({
        data: { organizationId: actor.organizationId, category, concept, amount: Math.abs(amount), spentAt: l.date, createdByUserId: actor.userId },
        select: { id: true },
      })
      movementId = row.id
      kind = "expense"
    }
    await tx.bankLine.update({ where: { id: lineId }, data: { status: "matched", matchKind: kind, matchId: movementId, matchedByUserId: actor.userId, matchedAt: new Date() } })
    return movementId
  })
  return { ok: true, id }
}

export async function autoReconcile(actor: Actor, statementId: string) {
  assertManage(actor)
  const s = await prisma.bankStatement.findFirst({ where: { id: statementId, organizationId: actor.organizationId }, select: { id: true } })
  if (!s) throw new CrudError("Estado de cuenta no encontrado", 404)
  const pending = await prisma.bankLine.findMany({ where: { statementId, status: "pending" } })
  if (pending.length === 0) return { matched: 0 }
  const dates = pending.map((l) => ymd(l.date)).sort()
  const pool = await movementPool(actor.organizationId, dates[0], dates.at(-1)!, true)
  const proposals = autoMatches(
    pending.map((l) => ({ id: l.id, date: ymd(l.date), amount: num(l.amount), description: l.description, reference: l.reference })),
    pool
  )
  let matched = 0
  for (const p of proposals) {
    try {
      await prisma.bankLine.update({
        where: { id: p.lineId },
        data: { status: "matched", matchKind: p.movement.kind, matchId: p.movement.id, matchedByUserId: actor.userId, matchedAt: new Date() },
      })
      matched++
    } catch (err) {
      if (!isUnique(err)) throw err
    }
  }
  return { matched }
}

export async function deleteStatement(actor: Actor, id: string) {
  assertManage(actor)
  const r = await prisma.bankStatement.deleteMany({ where: { id, organizationId: actor.organizationId } })
  if (r.count === 0) throw new CrudError("Estado de cuenta no encontrado", 404)
  return { ok: true }
}
