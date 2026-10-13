import { NextResponse } from "next/server"
import { searchPeople } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?q= → personas para inscribir.
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { groupId } = await params
    return NextResponse.json({ ok: true, people: await searchPeople(ctx.actor, groupId, new URL(req.url).searchParams.get("q") ?? "") })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
