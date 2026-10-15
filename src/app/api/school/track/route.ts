import { NextResponse } from "next/server"
import { getMyTrack } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// Mi trayecto en el programa universitario (Teología): cursos por año, avance y credenciales.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, track: await getMyTrack(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
