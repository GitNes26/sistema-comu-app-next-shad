import { NextResponse } from "next/server"
import { getSuggestions } from "@/lib/gatherings/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?date= → asistencia de Kids, nuevos de Consolidación y ministerios para esa fecha.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const date = new URL(req.url).searchParams.get("date") ?? ""
    return NextResponse.json({ ok: true, suggestions: await getSuggestions(ctx.actor, date) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
