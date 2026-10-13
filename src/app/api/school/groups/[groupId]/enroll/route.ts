import { NextResponse } from "next/server"
import { directEnroll, requestEnrollment } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { wantsBook, memberId? } → solicitud propia, o inscripción directa de la administración.
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { groupId } = await params
    const body = await readJson(req)
    const result = body.memberId ? await directEnroll(ctx.actor, groupId, body) : await requestEnrollment(ctx.actor, groupId, body)
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
