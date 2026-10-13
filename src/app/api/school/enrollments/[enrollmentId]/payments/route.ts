import { NextResponse } from "next/server"
import { addPayment } from "@/lib/school/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { concept, amount, method, reference? }.
export async function POST(req: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { enrollmentId } = await params
    return NextResponse.json(await addPayment(ctx.actor, enrollmentId, await readJson(req)), { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
