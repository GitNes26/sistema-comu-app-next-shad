import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { deleteStream, updateStream } from "@/lib/portal/server"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ streamId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { streamId } = await params
    return NextResponse.json(await updateStream(ctx.actor, streamId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { streamId } = await params
    return NextResponse.json(await deleteStream(ctx.actor, streamId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
