import { NextResponse } from "next/server"
import { setManualGrade } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { assessmentId, value|null } → nota capturada por el maestro.
export async function POST(req: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { enrollmentId } = await params
    return NextResponse.json(await setManualGrade(ctx.actor, enrollmentId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
