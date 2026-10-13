import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { createStream, listStreams } from "@/lib/portal/server"

export const dynamic = "force-dynamic"

// GET → transmisiones publicadas (?manage=1: todas, solo con permiso). POST → crea una.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const manage = new URL(req.url).searchParams.get("manage") === "1"
    return NextResponse.json({ ok: true, streams: await listStreams(ctx.actor, { manage }) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, ...(await createStream(ctx.actor, await readJson(req))) }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
