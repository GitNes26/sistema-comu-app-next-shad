import { NextResponse } from "next/server"
import { saveNetwork } from "@/lib/cells/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// PUT → edita la red.
export async function PUT(req: Request, { params }: { params: Promise<{ networkId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { networkId } = await params
    return NextResponse.json({ ok: true, ...(await saveNetwork(ctx.actor, networkId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
