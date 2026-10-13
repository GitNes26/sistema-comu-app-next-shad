import { NextResponse } from "next/server"
import { getCourseAdmin, updateCourse } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → libro con su material y actividades. PUT → edita el libro.
export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { courseId } = await params
    return NextResponse.json({ ok: true, course: await getCourseAdmin(ctx.actor, courseId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { courseId } = await params
    return NextResponse.json({ ok: true, ...(await updateCourse(ctx.actor, courseId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
