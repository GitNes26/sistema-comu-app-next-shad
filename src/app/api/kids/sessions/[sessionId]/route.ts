import { NextResponse } from "next/server"
import { closeSession, getSession } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → detalle del servicio. PATCH { action: "close" } → lo cierra.
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { sessionId } = await params
    return NextResponse.json({ ok: true, detail: await getSession(ctx.actor, sessionId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { sessionId } = await params
    const body = await readJson(req)
    if (body.action !== "close") return NextResponse.json({ ok: false, error: "Acción no válida" }, { status: 400 })
    return NextResponse.json(await closeSession(ctx.actor, sessionId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
