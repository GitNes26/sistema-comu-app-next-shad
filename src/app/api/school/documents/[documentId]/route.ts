import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { deleteDocument, getDocumentView, saveDocument } from "@/lib/school/documents"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ documentId: string }> }

// GET → documento para leer (páginas habilitadas y mis apuntes). PUT { title, sections } → edita. DELETE → quita.
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { documentId } = await params
    return NextResponse.json({ ok: true, document: await getDocumentView(ctx.actor, documentId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { documentId } = await params
    return NextResponse.json(await saveDocument(ctx.actor, documentId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { documentId } = await params
    return NextResponse.json(await deleteDocument(ctx.actor, documentId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
