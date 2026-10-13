import { NextResponse } from "next/server"
import { getServiceSheet, saveServiceSheet } from "@/lib/gatherings/service"
import { CrudError } from "@/lib/crud/types"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

// GET ?ministryId= → lista de servidores del ministerio con su asistencia a esa reunión.
// PUT { ministryId, records: [{ memberId, status: present|absent|excused|null, note? }] } → pasa lista.
export async function GET(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    const ministryId = new URL(req.url).searchParams.get("ministryId")
    if (!ministryId) throw new CrudError("Elige el ministerio", 400, "ministryId")
    return NextResponse.json({ ok: true, sheet: await getServiceSheet(ctx.actor, id, ministryId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { id } = await params
    const body = await readJson(req)
    if (typeof body.ministryId !== "string" || !body.ministryId) throw new CrudError("Elige el ministerio", 400, "ministryId")
    return NextResponse.json(await saveServiceSheet(ctx.actor, id, body.ministryId, body))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
