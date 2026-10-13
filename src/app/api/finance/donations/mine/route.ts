import { NextResponse } from "next/server"
import { listMyDonations } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → mis donativos reportados.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, donations: await listMyDonations(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
