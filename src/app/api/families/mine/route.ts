import { NextResponse } from "next/server"
import { getMyFamily } from "@/lib/families/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// Mi familia (la de quien consulta; sin teléfonos).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, family: await getMyFamily(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
