import { NextResponse } from "next/server"
import { removeCellMember, updateCellMemberRole } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PATCH { role } → cambia el papel. DELETE → quita al integrante.
export async function PATCH(req: Request, { params }: { params: Promise<{ cellId: string; memberId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId, memberId } = await params
    return NextResponse.json(await updateCellMemberRole(ctx.actor, cellId, memberId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ cellId: string; memberId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId, memberId } = await params
    return NextResponse.json(await removeCellMember(ctx.actor, cellId, memberId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
