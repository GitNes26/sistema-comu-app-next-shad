import { NextResponse } from "next/server"
import { listMyTickets } from "@/lib/events/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → mis boletos.
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, tickets: await listMyTickets(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
