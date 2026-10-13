import { NextResponse } from "next/server"
import { listSongs, saveSong } from "@/lib/worship/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?q=&all=1 → catálogo (sin letras). POST → crea una canción.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const url = new URL(req.url)
    const result = await listSongs(ctx.actor, url.searchParams.get("q") ?? "", url.searchParams.get("all") === "1")
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const song = await saveSong(ctx.actor, null, await readJson(req))
    return NextResponse.json({ ok: true, song }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
