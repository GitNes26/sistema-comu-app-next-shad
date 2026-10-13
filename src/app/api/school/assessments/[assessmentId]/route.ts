import { NextResponse } from "next/server"
import { getAssessmentAdmin } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → actividad con sus preguntas y respuestas correctas (administración).
export async function GET(_req: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { assessmentId } = await params
    return NextResponse.json({ ok: true, assessment: await getAssessmentAdmin(ctx.actor, assessmentId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
