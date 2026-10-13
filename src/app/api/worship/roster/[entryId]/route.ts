import { NextResponse } from "next/server"
import { removeRosterEntry, respondRoster } from "@/lib/worship/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

type Ctx = { params: Promise<{ entryId: string }> }

// PATCH { status: "confirmed" | "declined" } → la propia persona responde.
export async function PATCH(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { entryId } = await params
    const body = await readJson(req)
    await respondRoster(ctx.actor, entryId, body.status)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

// DELETE → quita la asignación (líder, apoyo o administración).
export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { entryId } = await params
    await removeRosterEntry(ctx.actor, entryId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
