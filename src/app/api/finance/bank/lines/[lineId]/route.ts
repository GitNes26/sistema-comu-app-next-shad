import { NextResponse } from "next/server"
import { createFromLine, matchLine, setIgnored, unmatchLine } from "@/lib/finance/bank"
import { CrudError } from "@/lib/crud/types"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { action: match | unmatch | ignore | restore | create, ... } sobre un renglón del banco.
export async function POST(req: Request, { params }: { params: Promise<{ lineId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { lineId } = await params
    const body = await readJson(req)
    switch (body.action) {
      case "match":
        return NextResponse.json(await matchLine(ctx.actor, lineId, body))
      case "unmatch":
        return NextResponse.json(await unmatchLine(ctx.actor, lineId))
      case "ignore":
        return NextResponse.json(await setIgnored(ctx.actor, lineId, true))
      case "restore":
        return NextResponse.json(await setIgnored(ctx.actor, lineId, false))
      case "create":
        return NextResponse.json(await createFromLine(ctx.actor, lineId, body), { status: 201 })
      default:
        throw new CrudError("Acción no válida", 400, "action")
    }
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
