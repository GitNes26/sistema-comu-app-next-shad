import { NextResponse } from "next/server"
import { requestCellAsMember } from "@/lib/cells/finder"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { cellId, message? } → la persona pide unirse a un hogar de amor.
export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const body = await readJson(req)
    return NextResponse.json(await requestCellAsMember(ctx.actor, body.cellId, body.message), { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
