import { NextResponse } from "next/server"
import { saveGroup } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { id?, name, teacherMemberId, assistantMemberId, startDate, endDate, capacity, status }.
export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { courseId } = await params
    const body = await readJson(req)
    const id = typeof body.id === "string" && body.id ? body.id : null
    return NextResponse.json({ ok: true, ...(await saveGroup(ctx.actor, courseId, id, body)) }, { status: id ? 200 : 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
