import { NextResponse } from "next/server"
import { addContact } from "@/lib/consolidation/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

// POST { channel, summary, interest?, nextContactAt? } → registra un contacto de seguimiento.
export async function POST(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { caseId } = await params
    await addContact(ctx.actor, caseId, await readJson(req))
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
