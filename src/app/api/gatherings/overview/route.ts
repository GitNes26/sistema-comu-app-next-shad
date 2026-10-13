import { NextResponse } from "next/server"
import { getPublicOverview } from "@/lib/gatherings/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → horario y temas recientes (para todos los integrantes, sin cifras).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, overview: await getPublicOverview(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
