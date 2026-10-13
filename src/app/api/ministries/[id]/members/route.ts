import { NextResponse } from "next/server"
import { addMinistryMember, searchCandidates } from "@/lib/ministries/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?q= → candidatos para agregar (solo quien gestiona). POST → agrega al ministerio.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    const q = new URL(req.url).searchParams.get("q") ?? ""
    return NextResponse.json({ ok: true, candidates: await searchCandidates(ctx.actor, id, q) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    const result = await addMinistryMember(ctx.actor, id, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
