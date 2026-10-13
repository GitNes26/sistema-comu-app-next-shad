import { NextResponse } from "next/server"
import { removeMinistryMember, updateMinistryMember } from "@/lib/ministries/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

type Ctx = { params: Promise<{ id: string; membershipId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id, membershipId } = await params
    await updateMinistryMember(ctx.actor, id, membershipId, await readJson(req))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id, membershipId } = await params
    await removeMinistryMember(ctx.actor, id, membershipId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
