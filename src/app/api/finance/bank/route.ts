import { NextResponse } from "next/server"
import { importStatement, listStatements, previewStatement } from "@/lib/finance/bank"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET → estados de cuenta importados. POST { csv, label?, fileName?, preview? } → vista previa o importación.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, statements: await listStatements(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const body = await readJson(req)
    if (body.preview === true) return NextResponse.json({ ok: true, preview: previewStatement(ctx.actor, body.csv) })
    return NextResponse.json({ ok: true, ...(await importStatement(ctx.actor, body)) }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
