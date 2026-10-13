import { NextResponse } from "next/server"
import { getCell, updateCell } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?month=YYYY-MM → detalle (cumpleañeros de ese mes). PUT → edita la configuración.
export async function GET(req: Request, { params }: { params: Promise<{ cellId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId } = await params
    const month = new URL(req.url).searchParams.get("month") ?? undefined
    return NextResponse.json({ ok: true, cell: await getCell(ctx.actor, cellId, month) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ cellId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { cellId } = await params
    return NextResponse.json({ ok: true, ...(await updateCell(ctx.actor, cellId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
