import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"
import { renderDiplomaPdfFor } from "@/lib/school/growth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET → PDF del diploma (solo su dueño o la administración de la escuela). ?download=1 lo descarga.
export async function GET(req: Request, { params }: { params: Promise<{ diplomaId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { diplomaId } = await params
    const { pdf, fileName } = await renderDiplomaPdfFor(ctx.actor, diplomaId)
    const download = new URL(req.url).searchParams.get("download") === "1"
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      },
    })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
