import { NextResponse } from "next/server"
import { listReviews } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → envíos con preguntas abiertas por revisar.
export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { groupId } = await params
    return NextResponse.json({ ok: true, reviews: await listReviews(ctx.actor, groupId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
