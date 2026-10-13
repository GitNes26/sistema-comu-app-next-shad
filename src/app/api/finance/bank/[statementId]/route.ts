import { NextResponse } from "next/server"
import { autoReconcile, deleteStatement, getStatement } from "@/lib/finance/bank"
import { ministriesActor, ministryErrorResponse } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ statementId: string }> }

// GET → renglones con sus sugerencias. POST → concilia automáticamente lo claro. DELETE → quita el estado de cuenta.
export async function GET(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { statementId } = await params
    return NextResponse.json({ ok: true, ...(await getStatement(ctx.actor, statementId)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { statementId } = await params
    return NextResponse.json({ ok: true, ...(await autoReconcile(ctx.actor, statementId)) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { statementId } = await params
    return NextResponse.json(await deleteStatement(ctx.actor, statementId))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
