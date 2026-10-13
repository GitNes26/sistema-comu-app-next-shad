import { NextResponse } from "next/server"
import { createChild, listMyChildren } from "@/lib/kids/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → mis hijos en Kids (por la relación de tutela). POST → registra a un hijo propio.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, children: await listMyChildren(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const body = await readJson(req)
    const result = await createChild(ctx.actor, { ...body, guardians: body.relation }, "guardian")
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
