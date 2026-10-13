import { NextResponse } from "next/server"
import { saveSchool } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PUT → configura el programa (director, calificación mínima, costos).
export async function PUT(req: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { schoolId } = await params
    return NextResponse.json({ ok: true, ...(await saveSchool(ctx.actor, schoolId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
