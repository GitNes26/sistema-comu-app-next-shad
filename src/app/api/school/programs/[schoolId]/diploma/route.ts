import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { getDiplomaConfig, saveDiplomaConfig, uploadDiplomaTemplate } from "@/lib/school/growth"
import { CrudError } from "@/lib/crud/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Ctx = { params: Promise<{ schoolId: string }> }

// GET → configuración del diploma. PUT → modo y posición del nombre.
// POST (multipart: file) → sube la imagen o el PDF del diploma.
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { schoolId } = await params
    return NextResponse.json({ ok: true, config: await getDiplomaConfig(ctx.actor, schoolId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { schoolId } = await params
    return NextResponse.json(await saveDiplomaConfig(ctx.actor, schoolId, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { schoolId } = await params
    const form = await req.formData().catch(() => null)
    const file = form?.get("file")
    if (!(file instanceof File)) throw new CrudError("Envía el archivo en el campo «file»", 400)
    return NextResponse.json(await uploadDiplomaTemplate(ctx.actor, schoolId, file), { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
