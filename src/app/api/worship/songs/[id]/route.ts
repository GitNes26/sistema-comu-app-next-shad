import { NextResponse } from "next/server"
import { getSong, inactivateSong, saveSong } from "@/lib/worship/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await getSong(ctx.actor, id)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, song: await saveSong(ctx.actor, id, await readJson(req)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

// Se inactiva (no se borra): los programas anteriores la conservan.
export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    await inactivateSong(ctx.actor, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
