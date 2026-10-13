import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { createPost, listPosts } from "@/lib/portal/server"

export const dynamic = "force-dynamic"

// GET → publicaciones visibles para la persona (?manage=1: todas, solo con permiso). POST → crea una.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const manage = new URL(req.url).searchParams.get("manage") === "1"
    return NextResponse.json({ ok: true, posts: await listPosts(ctx.actor, { manage }) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, ...(await createPost(ctx.actor, await readJson(req))) }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
