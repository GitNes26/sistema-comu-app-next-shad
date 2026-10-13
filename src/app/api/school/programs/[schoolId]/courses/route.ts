import { NextResponse } from "next/server"
import { saveCourse } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST → crea un libro o curso.
export async function POST(req: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { schoolId } = await params
    const result = await saveCourse(ctx.actor, schoolId, null, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
