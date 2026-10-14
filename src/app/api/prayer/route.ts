import { NextResponse } from "next/server"
import { answerMyPrayer, createPrayer, myPrayers } from "@/lib/connect/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// Mis peticiones de oración (cualquier creyente con sesión; solo ve y manda las suyas).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, prayers: await myPrayers(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, ...(await createPrayer(ctx.actor, await readJson(req))) }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

// PATCH { id, note? } → la persona marca su petición como respondida.
export async function PATCH(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const body = await readJson(req)
    return NextResponse.json(await answerMyPrayer(ctx.actor, String(body.id ?? ""), body.note))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
