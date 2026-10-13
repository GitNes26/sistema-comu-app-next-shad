import { NextResponse } from "next/server"
import { getSubmissionForReview, gradeSubmission } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → envío para revisar. POST { perQuestion, feedback } → lo califica.
export async function GET(_req: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { submissionId } = await params
    return NextResponse.json({ ok: true, submission: await getSubmissionForReview(ctx.actor, submissionId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { submissionId } = await params
    return NextResponse.json(await gradeSubmission(ctx.actor, submissionId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
