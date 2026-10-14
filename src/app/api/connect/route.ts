import { NextResponse } from "next/server"
import { listCards, listPrayers, updateCard, updatePrayer } from "@/lib/connect/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// Bandeja del equipo (members.manage): tarjetas de conexión y peticiones de oración.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const [cards, prayers] = await Promise.all([listCards(ctx.actor), listPrayers(ctx.actor)])
    return NextResponse.json({ ok: true, cards, prayers })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

// PATCH { type: "card" | "prayer", id, status, handledNote? }
export async function PATCH(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const body = await readJson(req)
    const id = String(body.id ?? "")
    if (body.type === "card") return NextResponse.json(await updateCard(ctx.actor, id, body))
    if (body.type === "prayer") return NextResponse.json(await updatePrayer(ctx.actor, id, body))
    return NextResponse.json({ ok: false, error: "Tipo inválido" }, { status: 400 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
