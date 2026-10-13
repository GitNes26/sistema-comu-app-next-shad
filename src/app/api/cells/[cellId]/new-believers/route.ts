import { NextResponse } from "next/server"
import { registerNewBeliever } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { fullName, phone|email, gender?, birthDate?, useExisting? } → nuevo creyente llegado por la célula.
export async function POST(req: Request, { params }: { params: Promise<{ cellId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId } = await params
    const result = await registerNewBeliever(ctx.actor, cellId, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
