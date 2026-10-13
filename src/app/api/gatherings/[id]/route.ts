import { NextResponse } from "next/server"
import { deleteGathering, getGathering, saveGathering } from "@/lib/gatherings/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → detalle. PUT → edita. DELETE → elimina el registro.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, gathering: await getGathering(ctx.actor, id) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await saveGathering(ctx.actor, id, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json(await deleteGathering(ctx.actor, id))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
