import { NextResponse } from "next/server"
import { buildDonationReceipt } from "@/lib/finance/receipt"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"
export const maxDuration = 30

// GET → PDF del recibo de un donativo confirmado (quien dio o la tesorería).
export async function GET(_req: Request, { params }: { params: Promise<{ donationId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { donationId } = await params
    const { pdf, filename } = await buildDonationReceipt(ctx.actor, donationId)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
