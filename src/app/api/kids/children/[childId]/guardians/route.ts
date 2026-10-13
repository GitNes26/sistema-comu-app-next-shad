import { NextResponse } from "next/server"
import { addGuardian, removeGuardian } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { memberId, relation? } → vincula un tutor. DELETE ?memberId= → lo quita.
export async function POST(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { childId } = await params
    return NextResponse.json(await addGuardian(ctx.actor, childId, await readJson(req)), { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { childId } = await params
    const memberId = new URL(req.url).searchParams.get("memberId") ?? ""
    return NextResponse.json(await removeGuardian(ctx.actor, childId, memberId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
