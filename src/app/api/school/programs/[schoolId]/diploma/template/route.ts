import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"
import { readDiplomaTemplate } from "@/lib/school/growth"

export const dynamic = "force-dynamic"

// GET → la imagen o el PDF de la plantilla (solo quien configura el diploma).
export async function GET(_req: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { schoolId } = await params
    const file = await readDiplomaTemplate(ctx.actor, schoolId)
    return new NextResponse(new Uint8Array(file.data), {
      headers: { "Content-Type": file.mime, "Cache-Control": "private, no-store", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" },
    })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
