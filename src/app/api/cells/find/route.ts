import { NextResponse } from "next/server"
import { searchCells } from "@/lib/cells/finder"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

const num = (v: string | null) => {
  if (v === null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Buscador de hogares de amor para quien tiene sesión (misma consulta que la pública).
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const q = new URL(req.url).searchParams
    return NextResponse.json({ ok: true, ...(await searchCells(ctx.actor.organizationId, { lat: num(q.get("lat")), lng: num(q.get("lng")), typeId: q.get("type"), q: (q.get("q") ?? "").slice(0, 60) })) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
