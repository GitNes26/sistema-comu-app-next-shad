import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { getMyProfile, saveMyProfile } from "@/lib/portal/server"

export const dynamic = "force-dynamic"

// GET → mis datos personales. PUT → los actualiza (solo los campos que la persona puede editar).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, profile: await getMyProfile(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json(await saveMyProfile(ctx.actor, await readJson(req)))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
