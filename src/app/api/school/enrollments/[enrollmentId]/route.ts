import { NextResponse } from "next/server"
import { decideEnrollment, getStudentPortal } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → portal del alumno. PATCH { action: approve|reject|drop|cancel }.
export async function GET(_req: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { enrollmentId } = await params
    return NextResponse.json({ ok: true, portal: await getStudentPortal(ctx.actor, enrollmentId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { enrollmentId } = await params
    return NextResponse.json(await decideEnrollment(ctx.actor, enrollmentId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
