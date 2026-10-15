import { NextResponse } from "next/server"
import { addFamilyMember, removeFamilyMember } from "@/lib/families/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { memberId, relation } → agrega o actualiza el parentesco. DELETE { memberId } → lo quita.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json(await addFamilyMember(ctx.actor, id, await readJson(req)), { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    const body = await readJson(req)
    return NextResponse.json(await removeFamilyMember(ctx.actor, id, String(body.memberId ?? "")))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
