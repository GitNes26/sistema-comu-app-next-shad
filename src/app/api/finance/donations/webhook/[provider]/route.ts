import { NextResponse } from "next/server"
import { handleWebhook } from "@/lib/payments/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// Notificaciones de la pasarela (Stripe, Mercado Pago). Es público a propósito: la
// autenticidad se comprueba con la firma que calcula cada pasarela con el secreto de la
// iglesia (`?org=` dice de cuál). Sin firma válida no se confirma nada.
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  const url = new URL(req.url)
  const raw = await req.text()
  if (raw.length > 200_000) return NextResponse.json({ ok: false, error: "Cuerpo demasiado grande" }, { status: 413 })
  try {
    const r = await handleWebhook({ provider, organizationId: url.searchParams.get("org"), rawBody: raw, headers: req.headers, query: url.searchParams })
    return NextResponse.json(r.body, { status: r.status })
  } catch (err) {
    console.error("[payments] webhook", err)
    // 500 para que la pasarela reintente.
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 })
  }
}
