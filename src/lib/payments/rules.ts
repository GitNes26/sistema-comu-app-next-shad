import { createHmac, timingSafeEqual } from "node:crypto"

// Reglas puras de los pagos en línea: validación de firmas de webhook, montos y
// lectura de eventos. Sin base de datos ni red, para poder probarlas a fondo.

export const PAYMENT_PROVIDERS = {
  stripe: { label: "Tarjeta (Stripe)", description: "Cobra con tarjeta de crédito o débito." },
  mercadopago: { label: "Mercado Pago", description: "Tarjeta, efectivo en tiendas y saldo de Mercado Pago." },
} as const
export type PaymentProvider = keyof typeof PAYMENT_PROVIDERS
export const isPaymentProvider = (v: unknown): v is PaymentProvider => typeof v === "string" && v in PAYMENT_PROVIDERS

export const MIN_ONLINE_AMOUNT = 10
export const MAX_ONLINE_AMOUNT = 100_000

/** Pesos → centavos sin errores de punto flotante. */
export function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100)
}

/** Monto válido para cobrar en línea (2 decimales como máximo). */
export function validOnlineAmount(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n) || n < MIN_ONLINE_AMOUNT || n > MAX_ONLINE_AMOUNT) return null
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? Math.round(n * 100) / 100 : null
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Stripe: cabecera `Stripe-Signature: t=…,v1=…`; v1 = HMAC-SHA256 de `${t}.${cuerpo}`.
 * Se rechazan firmas viejas (tolerancia 5 minutos) para evitar reenvíos.
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header || !secret) return false
  const parts = header.split(",").map((p) => p.trim().split("="))
  const t = parts.find(([k]) => k === "t")?.[1]
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v)
  if (!t || sigs.length === 0 || !/^\d+$/.test(t)) return false
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")
  return sigs.some((s) => safeEqual(s, expected))
}

/** Utilidad para pruebas y para firmar localmente. */
export function signStripePayload(rawBody: string, secret: string, tSec = Math.floor(Date.now() / 1000)): string {
  return `t=${tSec},v1=${createHmac("sha256", secret).update(`${tSec}.${rawBody}`).digest("hex")}`
}

/**
 * Mercado Pago: `x-signature: ts=…,v1=…`; v1 = HMAC-SHA256 (hex) del manifiesto
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
 */
export function verifyMercadoPagoSignature(input: { signature: string | null; requestId: string | null; dataId: string | null; secret: string }): boolean {
  const { signature, requestId, dataId, secret } = input
  if (!signature || !secret || !dataId) return false
  const parts = Object.fromEntries(signature.split(",").map((p) => p.trim().split("=") as [string, string]))
  if (!parts.ts || !parts.v1) return false
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  const manifest = `id:${id};${requestId ? `request-id:${requestId};` : ""}ts:${parts.ts};`
  const expected = createHmac("sha256", secret).update(manifest).digest("hex")
  return safeEqual(parts.v1, expected)
}

export function signMercadoPago(dataId: string, requestId: string, secret: string, ts = String(Date.now())): string {
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
  return `ts=${ts},v1=${createHmac("sha256", secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest("hex")}`
}

export interface StripePaid {
  sessionId: string
  paymentIntent: string | null
  amount: number
  currency: string
  donationId: string | null
  email: string | null
  name: string | null
  memberId: string | null
}

/** Evento de Stripe que confirma un pago; null si no es uno (se ignora). */
export function parseStripePaid(event: unknown): StripePaid | null {
  const e = event as { type?: string; data?: { object?: Record<string, unknown> } } | null
  if (!e || !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(String(e.type))) return null
  const o = e.data?.object
  if (!o || o.payment_status !== "paid" || typeof o.id !== "string") return null
  const cents = typeof o.amount_total === "number" ? o.amount_total : null
  if (cents === null) return null
  const meta = (o.metadata ?? {}) as Record<string, unknown>
  const details = (o.customer_details ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === "string" && v ? v : null)
  return {
    sessionId: o.id,
    paymentIntent: str(o.payment_intent),
    amount: cents / 100,
    currency: String(o.currency ?? "mxn").toUpperCase(),
    donationId: str(o.client_reference_id) ?? str(meta.donationId),
    email: str(details.email) ?? str(o.customer_email),
    name: str(details.name),
    memberId: str(meta.memberId),
  }
}

/** Id del pago en una notificación de Mercado Pago (consulta o cuerpo). */
export function mercadoPagoPaymentId(query: URLSearchParams, body: unknown): string | null {
  const b = body as { type?: string; action?: string; data?: { id?: unknown } } | null
  const type = query.get("type") ?? query.get("topic") ?? b?.type ?? ""
  if (type && type !== "payment" && !String(b?.action ?? "").startsWith("payment")) return null
  const id = query.get("data.id") ?? query.get("id") ?? (b?.data?.id !== undefined ? String(b.data.id) : null)
  return id && /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : null
}
