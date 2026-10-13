import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"
import { listDocuments, uploadDocument } from "@/lib/school/documents"
import { CrudError } from "@/lib/crud/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Ctx = { params: Promise<{ courseId: string }> }

// GET → documentos del libro con sus secciones. POST (multipart: file, title?) → sube un PDF, Word o imagen.
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { courseId } = await params
    return NextResponse.json({ ok: true, documents: await listDocuments(ctx.actor, courseId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { courseId } = await params
    const form = await req.formData().catch(() => null)
    const file = form?.get("file")
    if (!(file instanceof File)) throw new CrudError("Envía el archivo en el campo «file»", 400)
    const title = typeof form?.get("title") === "string" ? String(form?.get("title")) : null
    const result = await uploadDocument(ctx.actor, courseId, file, title)
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
