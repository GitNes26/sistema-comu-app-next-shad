import { NextResponse } from "next/server"
import { saveType } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PUT → renombra o activa/inactiva un tipo.
export async function PUT(req: Request, { params }: { params: Promise<{ typeId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { typeId } = await params
    return NextResponse.json({ ok: true, ...(await saveType(ctx.actor, typeId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
