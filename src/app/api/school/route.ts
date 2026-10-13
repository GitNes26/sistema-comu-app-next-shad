import { NextResponse } from "next/server"
import { getOverview } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → catálogo, mis inscripciones y los grupos que enseño.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, overview: await getOverview(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
