import { NextResponse } from "next/server"
import { saveSession } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { week, date, topic?, notes?, attendance: { [enrollmentId]: present|absent|excused } }.
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { groupId } = await params
    return NextResponse.json(await saveSession(ctx.actor, groupId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
