import test from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import {
  mercadoPagoPaymentId,
  parseStripePaid,
  signMercadoPago,
  signStripePayload,
  toCents,
  validOnlineAmount,
  verifyMercadoPagoSignature,
  verifyStripeSignature,
} from "../../src/lib/payments/rules.ts"
import { decryptSecret, encryptSecret } from "../../src/lib/payments/secrets.ts"

test("montos: centavos exactos y límites del cobro en línea", () => {
  assert.equal(toCents(19.99), 1999)
  assert.equal(toCents(0.29), 29)
  assert.equal(toCents(1000), 100000)
  assert.equal(validOnlineAmount("250.50"), 250.5)
  assert.equal(validOnlineAmount(9.99), null) // menos del mínimo
  assert.equal(validOnlineAmount(100001), null)
  assert.equal(validOnlineAmount("12.345"), null) // más de 2 decimales
  assert.equal(validOnlineAmount("abc"), null)
})

test("Stripe: firma válida, alterada, vieja y sin cabecera", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" })
  const now = 1_800_000_000
  const header = signStripePayload(body, "whsec_abc", now)
  assert.equal(verifyStripeSignature(body, header, "whsec_abc", now + 10), true)
  assert.equal(verifyStripeSignature(body + " ", header, "whsec_abc", now + 10), false) // cuerpo alterado
  assert.equal(verifyStripeSignature(body, header, "whsec_otro", now + 10), false) // otro secreto
  assert.equal(verifyStripeSignature(body, header, "whsec_abc", now + 3600), false) // firma vieja (reenvío)
  assert.equal(verifyStripeSignature(body, null, "whsec_abc", now), false)
  assert.equal(verifyStripeSignature(body, "t=abc,v1=00", "whsec_abc", now), false)
  // Stripe puede mandar varias firmas v1 (rotación de secreto).
  const multi = header + ",v1=" + createHmac("sha256", "x").update("y").digest("hex")
  assert.equal(verifyStripeSignature(body, multi, "whsec_abc", now), true)
})

test("Mercado Pago: firma del manifiesto con id, request-id y ts", () => {
  const sig = signMercadoPago("12345", "req-1", "secreto", "1700000000000")
  assert.equal(verifyMercadoPagoSignature({ signature: sig, requestId: "req-1", dataId: "12345", secret: "secreto" }), true)
  assert.equal(verifyMercadoPagoSignature({ signature: sig, requestId: "req-2", dataId: "12345", secret: "secreto" }), false)
  assert.equal(verifyMercadoPagoSignature({ signature: sig, requestId: "req-1", dataId: "99999", secret: "secreto" }), false)
  assert.equal(verifyMercadoPagoSignature({ signature: sig, requestId: "req-1", dataId: "12345", secret: "otro" }), false)
  assert.equal(verifyMercadoPagoSignature({ signature: null, requestId: null, dataId: "1", secret: "s" }), false)
})

test("Stripe: solo se lee como pago el evento de sesión pagada", () => {
  const paid = {
    type: "checkout.session.completed",
    data: { object: { id: "cs_1", payment_status: "paid", amount_total: 25050, currency: "mxn", client_reference_id: "don_1", payment_intent: "pi_1", customer_details: { email: "a@b.mx", name: "Ana" } } },
  }
  const p = parseStripePaid(paid)
  assert.equal(p?.amount, 250.5)
  assert.equal(p?.donationId, "don_1")
  assert.equal(p?.currency, "MXN")
  assert.equal(parseStripePaid({ ...paid, data: { object: { ...paid.data.object, payment_status: "unpaid" } } }), null)
  assert.equal(parseStripePaid({ type: "charge.refunded", data: { object: {} } }), null)
  assert.equal(parseStripePaid(null), null)
})

test("Mercado Pago: id del pago desde la consulta o el cuerpo", () => {
  assert.equal(mercadoPagoPaymentId(new URLSearchParams("data.id=123&type=payment"), null), "123")
  assert.equal(mercadoPagoPaymentId(new URLSearchParams(""), { type: "payment", data: { id: 456 } }), "456")
  assert.equal(mercadoPagoPaymentId(new URLSearchParams("type=merchant_order&id=9"), { type: "merchant_order" }), null)
  assert.equal(mercadoPagoPaymentId(new URLSearchParams("data.id=../../etc"), null), null)
})

test("secretos: cifrado de ida y vuelta, distinto cada vez y a prueba de alteración", () => {
  process.env.PAYMENTS_SECRET_KEY = "prueba-unitaria"
  const a = encryptSecret("sk_test_abc123")
  const b = encryptSecret("sk_test_abc123")
  assert.notEqual(a, b)
  assert.equal(decryptSecret(a), "sk_test_abc123")
  assert.ok(!a.includes("sk_test"))
  const [iv, tag, data] = a.split(".")
  assert.throws(() => decryptSecret([iv, tag, Buffer.from("otro-dato-cualquiera").toString("base64")].join(".")))
  assert.throws(() => decryptSecret("basura"))
  void data
})
