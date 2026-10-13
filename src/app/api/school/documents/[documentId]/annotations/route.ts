import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { deleteAnnotation, saveAnnotation } from "@/lib/school/documents"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ documentId: string }> }

// POST { id?, page, kind, color, rects, text?, quote? } → crea o edita mi apunte. DELETE ?id=.
export async function POST(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { documentId } = await params
    const body = await readJson(req)
    const result = await saveAnnotation(ctx.actor, documentId, body)
    return NextResponse.json({ ok: true, ...result }, { status: body.id ? 200 : 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { documentId } = await params
    return NextResponse.json(await deleteAnnotation(ctx.actor, documentId, new URL(req.url).searchParams.get("id") ?? ""))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
