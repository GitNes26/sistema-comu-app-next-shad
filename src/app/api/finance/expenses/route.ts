import { NextResponse } from "next/server"
import { deleteExpense, listExpenses, saveExpense } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET ?month= → gastos (todos, también los de eventos y vehículos). POST { id?, … }. DELETE ?id=.
export async function GET(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, expenses: await listExpenses(ctx.actor, new URL(req.url).searchParams.get("month") ?? undefined) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const body = await readJson(req)
    const id = typeof body.id === "string" && body.id ? body.id : null
    return NextResponse.json({ ok: true, ...(await saveExpense(ctx.actor, id, body)) }, { status: id ? 200 : 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json(await deleteExpense(ctx.actor, new URL(req.url).searchParams.get("id") ?? ""))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
