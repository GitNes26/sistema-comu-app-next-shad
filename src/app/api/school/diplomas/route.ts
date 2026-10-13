import { NextResponse } from "next/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"
import { issueDiplomaManually, listMyDiplomas } from "@/lib/school/growth"

export const dynamic = "force-dynamic"

// GET → mis diplomas. POST { memberId } → emisión manual (administración; exige todos los libros aprobados).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    return NextResponse.json({ ok: true, diplomas: await listMyDiplomas(ctx.actor) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function POST(req: Request) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const body = await readJson(req)
    const result = await issueDiplomaManually(ctx.actor, typeof body.memberId === "string" ? body.memberId : "")
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
