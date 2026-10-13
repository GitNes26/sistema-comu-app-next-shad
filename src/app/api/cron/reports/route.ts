import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { runDueSchedules } from "@/lib/reports/schedules"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// POST con `Authorization: Bearer <CRON_SECRET>`: procesa los envíos que ya tocan.
// Pensado para un cron del sistema o del hosting (cada 5–15 minutos). Si el servidor
// ya corre el planificador interno no hace falta, pero es seguro usar ambos.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 503 })
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  return NextResponse.json({ ok: true, ...(await runDueSchedules()) })
}
