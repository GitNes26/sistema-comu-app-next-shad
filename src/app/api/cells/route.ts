import { NextResponse } from "next/server"
import { createCell, listCells } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?scope=mine|all&q=&networkId= → células. POST → crea una célula.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const url = new URL(req.url)
    const scope = url.searchParams.get("scope") === "all" ? "all" : "mine"
    const cells = await listCells(ctx.actor, { scope, q: url.searchParams.get("q") ?? "", networkId: url.searchParams.get("networkId") ?? undefined })
    return NextResponse.json({ ok: true, cells })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const result = await createCell(ctx.actor, await readJson(req))
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
