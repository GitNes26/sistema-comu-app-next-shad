import { NextResponse } from "next/server"
import { searchFamilyCandidates } from "@/lib/families/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, people: await searchFamilyCandidates(ctx.actor, new URL(req.url).searchParams.get("q") ?? "") })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
