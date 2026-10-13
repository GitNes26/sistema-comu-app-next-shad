import { NextResponse } from "next/server"
import { searchStaff } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?q= → personas para director, maestro o apoyo.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, people: await searchStaff(ctx.actor, new URL(req.url).searchParams.get("q") ?? "") })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
