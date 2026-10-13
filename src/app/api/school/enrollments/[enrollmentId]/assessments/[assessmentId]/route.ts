import { NextResponse } from "next/server"
import { getAssessmentForStudent, startAssessment, submitAssessment } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → actividad para responder. POST { action: start|submit, answers? }.
export async function GET(_req: Request, { params }: { params: Promise<{ enrollmentId: string; assessmentId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { enrollmentId, assessmentId } = await params
    return NextResponse.json({ ok: true, take: await getAssessmentForStudent(ctx.actor, enrollmentId, assessmentId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ enrollmentId: string; assessmentId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { enrollmentId, assessmentId } = await params
    const body = await readJson(req)
    const result = body.action === "start" ? await startAssessment(ctx.actor, enrollmentId, assessmentId) : await submitAssessment(ctx.actor, enrollmentId, assessmentId, body)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
