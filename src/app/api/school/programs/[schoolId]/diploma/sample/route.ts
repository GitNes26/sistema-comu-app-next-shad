import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"
import { renderSampleDiploma } from "@/lib/school/growth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET → PDF de ejemplo con la plantilla y la posición guardadas.
export async function GET(_req: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { schoolId } = await params
    const pdf = await renderSampleDiploma(ctx.actor, schoolId)
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "Content-Disposition": 'inline; filename="diploma-ejemplo.pdf"' },
    })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
