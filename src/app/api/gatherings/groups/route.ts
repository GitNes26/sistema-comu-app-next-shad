import { NextResponse } from "next/server"
import { listGroups } from "@/lib/gatherings/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → grupos con reuniones propias (Jóvenes, Varones, Mujeres…).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, groups: await listGroups(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
