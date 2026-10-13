import { NextResponse } from "next/server"
import { searchGuardians } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?q= → creyentes para vincular como tutores.
export async function GET(req: Request, { params }: { params: Promise<{ ministryId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    const q = new URL(req.url).searchParams.get("q") ?? ""
    return NextResponse.json({ ok: true, members: await searchGuardians(ctx.actor, ministryId, q) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
