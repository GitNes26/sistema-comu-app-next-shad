import { NextResponse } from "next/server"
import { getGradebook } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → planilla del grupo (asistencias, tareas, ejercicios y promedios).
export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { groupId } = await params
    return NextResponse.json({ ok: true, book: await getGradebook(ctx.actor, groupId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
