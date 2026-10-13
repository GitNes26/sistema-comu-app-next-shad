import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"
import { getDiploma } from "@/lib/school/growth"

export const dynamic = "force-dynamic"

// GET → datos del diploma (solo su dueño o la administración).
export async function GET(_req: Request, { params }: { params: Promise<{ diplomaId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { diplomaId } = await params
    return NextResponse.json({ ok: true, diploma: await getDiploma(ctx.actor, diplomaId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
