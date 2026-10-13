import { NextResponse } from "next/server"
import { listCases, registerPerson } from "@/lib/consolidation/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ ministryId: string }> }

// GET ?q= → casos visibles para quien consulta (líder: todos; servidor: los suyos).
export async function GET(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    const q = new URL(req.url).searchParams.get("q") ?? ""
    return NextResponse.json({ ok: true, workspace: await listCases(ctx.actor, ministryId, { q }) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

// POST → registra a una persona nueva (o la vincula si ya está en el padrón) y abre su caso.
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { ministryId } = await params
    const result = await registerPerson(ctx.actor, ministryId, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
