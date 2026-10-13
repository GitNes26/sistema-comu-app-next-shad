import { NextResponse } from "next/server"
import { getDonationInfo } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → datos de la iglesia para donar (transferencia o enlace).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, info: await getDonationInfo(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
