import { NextResponse } from "next/server"
import { deleteFamily, saveFamily } from "@/lib/families/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await saveFamily(ctx.actor, id, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json(await deleteFamily(ctx.actor, id))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
