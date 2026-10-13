import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { deletePost, updatePost } from "@/lib/portal/server"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ postId: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { postId } = await params
    return NextResponse.json(await updatePost(ctx.actor, postId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { postId } = await params
    return NextResponse.json(await deletePost(ctx.actor, postId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
