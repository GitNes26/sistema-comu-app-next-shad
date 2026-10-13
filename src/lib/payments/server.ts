import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { memberIdOfUser, type Actor } from "@/lib/ministries/server"
import { notifyMembers, notifyPermission } from "@/lib/notifications/church"
import { recordOnlineDonation } from "@/lib/finance/server"
import { decryptSecret, encryptSecret } from "./secrets"
import {
  isPaymentProvider,
  mercadoPagoPaymentId,
  parseStripePaid,
  toCents,
  validOnlineAmount,
  verifyMercadoPagoSignature,
  verifyStripeSignature,
  type PaymentProvider,
} from "./rules"

// Pagos en línea (donativos, diezmos y ofrendas). Cada iglesia conecta SU cuenta de
// Stripe o Mercado Pago: las llaves se guardan cifradas y nunca se devuelven al cliente.
// El cobro solo se da por bueno cuando la pasarela lo confirma por webhook firmado.

const MONEY_KINDS = ["tithe", "offering", "donation"] as const
type MoneyKind = (typeof MONEY_KINDS)[number]
const KIND_LABEL: Record<MoneyKind, string> = { tithe: "Diezmo", offering: "Ofrenda", donation: "Donativo" }

const baseUrl = () => (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")
const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : ""
  return s ? s.slice(0, max) : null
}

// ── Configuración por iglesia ────────────────────────────────────────────────

export interface GatewayDto {
  provider: PaymentProvider
  isActive: boolean
  mode: "test" | "live"
  hasSecret: boolean
  hasWebhookSecret: boolean
  publicKey: string | null
  webhookUrl: string
}

function assertFinanceManager(actor: Actor) {
  if (!actor.canManageFinance) throw new CrudError("No tienes permiso para configurar los pagos en línea", 403)
}

export const webhookUrlFor = (provider: PaymentProvider, organizationId: string) =>
  `${baseUrl()}/api/finance/donations/webhook/${provider}?org=${organizationId}`

export async function listGateways(actor: Actor): Promise<GatewayDto[]> {
  assertFinanceManager(actor)
  const rows = await prisma.paymentGateway.findMany({ where: { organizationId: actor.organizationId } })
  const byProvider = new Map(rows.map((r) => [r.provider, r]))
  return (["stripe", "mercadopago"] as const).map((provider) => {
    const r = byProvider.get(provider)
    return {
      provider,
      isActive: Boolean(r?.isActive),
      mode: r?.mode === "live" ? "live" : "test",
      hasSecret: Boolean(r?.secretKeyEnc),
      hasWebhookSecret: Boolean(r?.webhookSecretEnc),
      publicKey: r?.publicKey ?? null,
      webhookUrl: webhookUrlFor(provider, actor.organizationId),
    }
  })
}

export async function saveGateway(actor: Actor, input: Record<string, unknown>) {
  assertFinanceManager(actor)
  if (!isPaymentProvider(input.provider)) throw new CrudError("Pasarela no válida", 400, "provider")
  const provider = input.provider
  const current = await prisma.paymentGateway.findUnique({ where: { organizationId_provider: { organizationId: actor.organizationId, provider } } })
  const secret = text(input.secretKey, 300)
  const webhookSecret = text(input.webhookSecret, 300)
  if (!current && !secret) throw new CrudError("Pega la llave secreta de la pasarela", 400, "secretKey")
  if (secret) {
    const ok = provider === "stripe" ? /^(sk|rk)_(test|live)_/.test(secret) : /^(APP_USR|TEST)-/.test(secret)
    if (!ok) throw new CrudError(provider === "stripe" ? "La llave secreta de Stripe empieza con sk_test_ o sk_live_" : "El Access Token de Mercado Pago empieza con APP_USR- o TEST-", 400, "secretKey")
  }
  const wantsActive = input.isActive === true
  const hasWebhook = Boolean(webhookSecret || current?.webhookSecretEnc)
  if (wantsActive && !hasWebhook) throw new CrudError("Para activar los pagos pega también el secreto del webhook: sin él no se pueden confirmar los cobros", 409, "webhookSecret")
  const mode = input.mode === "live" ? "live" : "test"
  const data = {
    isActive: wantsActive,
    mode,
    publicKey: input.publicKey === undefined ? (current?.publicKey ?? null) : text(input.publicKey, 255),
    ...(secret ? { secretKeyEnc: encryptSecret(secret) } : {}),
    ...(webhookSecret ? { webhookSecretEnc: encryptSecret(webhookSecret) } : {}),
  }
  await prisma.paymentGateway.upsert({
    where: { organizationId_provider: { organizationId: actor.organizationId, provider } },
    update: data,
    create: { organizationId: actor.organizationId, provider, ...data, secretKeyEnc: data.secretKeyEnc ?? "" },
  })
  return { ok: true }
}

/** Pasarelas activas (para ofrecerlas al creyente). */
export async function activeProviders(organizationId: string): Promise<PaymentProvider[]> {
  const rows = await prisma.paymentGateway.findMany({ where: { organizationId, isActive: true }, select: { provider: true } })
  return rows.map((r) => r.provider).filter(isPaymentProvider)
}

// ── Iniciar un cobro ─────────────────────────────────────────────────────────

async function gatewayFor(organizationId: string, provider: PaymentProvider) {
  const g = await prisma.paymentGateway.findUnique({ where: { organizationId_provider: { organizationId, provider } } })
  if (!g?.isActive || !g.secretKeyEnc) throw new CrudError("Este medio de pago no está disponible", 409, "provider")
  return { ...g, secretKey: decryptSecret(g.secretKeyEnc) }
}

async function providerCall(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    console.error("[payments] la pasarela rechazó la solicitud", res.status, JSON.stringify(body).slice(0, 300))
    throw new CrudError("La pasarela rechazó la solicitud. Revisa las llaves configuradas.", 502)
  }
  return body
}

export async function startCheckout(actor: Actor, input: { provider?: unknown; amount?: unknown; kind?: unknown }) {
  if (!isPaymentProvider(input.provider)) throw new CrudError("Elige cómo quieres pagar", 400, "provider")
  const provider = input.provider
  const amount = validOnlineAmount(input.amount)
  if (amount === null) throw new CrudError("Anota un monto entre $10 y $100,000 (máximo 2 decimales)", 400, "amount")
  const kind: MoneyKind = MONEY_KINDS.includes(input.kind as MoneyKind) ? (input.kind as MoneyKind) : "donation"
  const memberId = await memberIdOfUser(actor.organizationId, actor.userId)
  if (!memberId) throw new CrudError("Tu usuario aún no tiene ficha de creyente", 409)
  const gateway = await gatewayFor(actor.organizationId, provider)
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, select: { fullName: true, email: true } })

  const donation = await prisma.donation.create({
    data: { organizationId: actor.organizationId, memberId, amount, kind, provider, notes: "Pago en línea" },
    select: { id: true },
  })
  const success = `${baseUrl()}/mi/donativos?pago=ok`
  const cancel = `${baseUrl()}/mi/donativos?pago=cancelado`
  const title = `${KIND_LABEL[kind]} a la iglesia`
  try {
    if (provider === "stripe") {
      const form = new URLSearchParams()
      form.set("mode", "payment")
      form.set("success_url", success)
      form.set("cancel_url", cancel)
      form.set("client_reference_id", donation.id)
      form.set("metadata[donationId]", donation.id)
      form.set("metadata[organizationId]", actor.organizationId)
      form.set("metadata[memberId]", memberId)
      if (member.email) form.set("customer_email", member.email)
      form.set("line_items[0][quantity]", "1")
      form.set("line_items[0][price_data][currency]", "mxn")
      form.set("line_items[0][price_data][unit_amount]", String(toCents(amount)))
      form.set("line_items[0][price_data][product_data][name]", title)
      const s = await providerCall("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${gateway.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      })
      const id = String(s.id ?? "")
      const url = String(s.url ?? "")
      if (!id || !url) throw new CrudError("La pasarela no devolvió el enlace de pago", 502)
      await prisma.donation.update({ where: { id: donation.id }, data: { externalId: id } })
      return { url, donationId: donation.id }
    }
    const pref = await providerCall("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${gateway.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title, quantity: 1, currency_id: "MXN", unit_price: amount }],
        external_reference: donation.id,
        payer: member.email ? { email: member.email } : undefined,
        back_urls: { success, failure: cancel, pending: success },
        auto_return: "approved",
        notification_url: webhookUrlFor("mercadopago", actor.organizationId),
        metadata: { donationId: donation.id, organizationId: actor.organizationId },
      }),
    })
    const id = String(pref.id ?? "")
    const url = String((gateway.mode === "live" ? pref.init_point : (pref.sandbox_init_point ?? pref.init_point)) ?? "")
    if (!id || !url) throw new CrudError("La pasarela no devolvió el enlace de pago", 502)
    await prisma.donation.update({ where: { id: donation.id }, data: { externalId: id } })
    return { url, donationId: donation.id }
  } catch (err) {
    await prisma.donation.update({ where: { id: donation.id }, data: { status: "failed" } }).catch(() => {})
    if (err instanceof CrudError) throw err
    console.error("[payments] error al crear el cobro", err)
    throw new CrudError("No se pudo conectar con la pasarela. Intenta de nuevo en un momento.", 502)
  }
}

// ── Confirmación (webhook) ───────────────────────────────────────────────────

interface Paid {
  provider: PaymentProvider
  /** Clave única del cobro en la pasarela (idempotencia). */
  externalId: string
  /** Referencia visible (id del pago). */
  reference: string | null
  donationId: string | null
  amount: number
  currency: string
  email: string | null
  name: string | null
  memberId: string | null
}

/** Marca el cobro como pagado y genera el ingreso, una sola vez. */
async function settle(organizationId: string, p: Paid): Promise<"paid" | "duplicate" | "mismatch"> {
  const pending = p.donationId
    ? await prisma.donation.findFirst({ where: { id: p.donationId, organizationId, provider: p.provider } })
    : await prisma.donation.findFirst({ where: { organizationId, provider: p.provider, externalId: p.externalId } })

  if (!pending) {
    // Cobro sin aviso previo (p. ej. un enlace de pago): se registra directo, idempotente.
    const before = await prisma.donation.findUnique({ where: { provider_externalId: { provider: p.provider, externalId: p.externalId } } })
    if (before) return "duplicate"
    await recordOnlineDonation(organizationId, {
      provider: p.provider,
      externalId: p.externalId,
      amount: p.amount,
      currency: p.currency,
      memberId: p.memberId,
      donorName: p.name,
      email: p.email,
    })
    return "paid"
  }
  if (pending.status === "paid") return "duplicate"
  if (toCents(Number(pending.amount)) !== toCents(p.amount)) {
    await prisma.donation.update({
      where: { id: pending.id },
      data: { notes: `El monto cobrado (${p.amount}) no coincide con el solicitado (${Number(pending.amount)}); revisar en la pasarela.`.slice(0, 250) },
    })
    return "mismatch"
  }
  const paidAt = new Date()
  const changed = await prisma.$transaction(async (tx) => {
    const r = await tx.donation.updateMany({
      where: { id: pending.id, status: { not: "paid" } },
      data: { status: "paid", paidAt, reference: p.reference?.slice(0, 80) ?? pending.reference, ...(pending.externalId ? {} : { externalId: p.externalId }) },
    })
    if (r.count === 0) return false
    await tx.income.create({
      data: {
        organizationId,
        kind: pending.kind,
        source: "online",
        amount: pending.amount,
        receivedAt: new Date(`${paidAt.toISOString().slice(0, 10)}T00:00:00.000Z`),
        memberId: pending.memberId,
        concept: "Donativo en línea",
        reference: p.reference?.slice(0, 80) ?? p.externalId,
        donationId: pending.id,
      },
    })
    return true
  })
  if (!changed) return "duplicate"
  const kind = (MONEY_KINDS.includes(pending.kind as MoneyKind) ? pending.kind : "donation") as MoneyKind
  void notifyMembers(organizationId, [pending.memberId], {
    kind: "donation_paid",
    severity: "success",
    title: "¡Gracias por tu aportación!",
    body: `Recibimos tu ${KIND_LABEL[kind].toLowerCase()} por ${Number(pending.amount).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.`,
    link: "/mi/donativos",
  })
  void notifyPermission(organizationId, "finance.manage", {
    kind: "donation_online",
    title: "Nuevo pago en línea",
    body: `${KIND_LABEL[kind]} por ${Number(pending.amount).toLocaleString("es-MX", { style: "currency", currency: "MXN" })} confirmado por la pasarela.`,
    link: "/admin/finance",
  })
  return "paid"
}

export type WebhookResult = { status: number; body: Record<string, unknown> }

/** Procesa una notificación de pasarela: valida la firma y confirma el cobro. */
export async function handleWebhook(input: {
  provider: string
  organizationId: string | null
  rawBody: string
  headers: Headers
  query: URLSearchParams
}): Promise<WebhookResult> {
  const { provider, organizationId, rawBody, headers, query } = input
  if (!isPaymentProvider(provider) || !organizationId) return { status: 404, body: { ok: false, error: "No encontrado" } }
  const g = await prisma.paymentGateway.findUnique({ where: { organizationId_provider: { organizationId, provider } } })
  if (!g?.isActive || !g.webhookSecretEnc || !g.secretKeyEnc) return { status: 404, body: { ok: false, error: "No encontrado" } }
  const webhookSecret = decryptSecret(g.webhookSecretEnc)

  let parsed: unknown = null
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null
  } catch {
    parsed = null
  }

  if (provider === "stripe") {
    if (!verifyStripeSignature(rawBody, headers.get("stripe-signature"), webhookSecret)) return { status: 400, body: { ok: false, error: "Firma inválida" } }
    const paid = parseStripePaid(parsed)
    if (!paid) return { status: 200, body: { ok: true, ignored: true } }
    const result = await settle(organizationId, {
      provider,
      externalId: paid.sessionId,
      reference: paid.paymentIntent ?? paid.sessionId,
      donationId: paid.donationId,
      amount: paid.amount,
      currency: paid.currency,
      email: paid.email,
      name: paid.name,
      memberId: paid.memberId,
    })
    return { status: 200, body: { ok: true, result } }
  }

  // Mercado Pago: la notificación solo trae el id; el pago se consulta con el token de la iglesia.
  const dataId = mercadoPagoPaymentId(query, parsed)
  if (!dataId) return { status: 200, body: { ok: true, ignored: true } }
  const valid = verifyMercadoPagoSignature({
    signature: headers.get("x-signature"),
    requestId: headers.get("x-request-id"),
    dataId: query.get("data.id") ?? dataId,
    secret: webhookSecret,
  })
  if (!valid) return { status: 400, body: { ok: false, error: "Firma inválida" } }
  const token = decryptSecret(g.secretKeyEnc)
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return { status: 502, body: { ok: false, error: "No se pudo consultar el pago" } }
  const pay = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (pay.status !== "approved") return { status: 200, body: { ok: true, ignored: true, status: pay.status ?? null } }
  const payer = (pay.payer ?? {}) as Record<string, unknown>
  const result = await settle(organizationId, {
    provider,
    externalId: String(pay.id ?? dataId),
    reference: String(pay.id ?? dataId),
    donationId: typeof pay.external_reference === "string" && pay.external_reference ? pay.external_reference : null,
    amount: Number(pay.transaction_amount ?? 0),
    currency: String(pay.currency_id ?? "MXN"),
    email: typeof payer.email === "string" ? payer.email : null,
    name: null,
    memberId: null,
  })
  return { status: 200, body: { ok: true, result } }
}
