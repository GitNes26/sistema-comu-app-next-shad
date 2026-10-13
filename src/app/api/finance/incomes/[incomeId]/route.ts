import { NextResponse } from "next/server"
import { deleteIncome } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse} from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// DELETE → elimina un ingreso capturado a mano.
export async function DELETE(_req: Request, { params }: { params: Promise<{ incomeId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { incomeId } = await params
    return NextResponse.json(await deleteIncome(ctx.actor, incomeId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
