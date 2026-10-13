import { NextResponse } from "next/server"
import { addVehicleDocument, addVehicleFuel, addVehicleLog, addVehicleService, deleteVehicleEntry } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// POST { type: log|service|fuel|document, … } agrega un renglón. DELETE ?kind=&id= lo quita.
export async function POST(req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { vehicleId } = await params
    const body = await readJson(req)
    const run = { log: addVehicleLog, service: addVehicleService, fuel: addVehicleFuel, document: addVehicleDocument }[String(body.type) as "log"]
    if (!run) return NextResponse.json({ ok: false, error: "Tipo de registro no válido" }, { status: 400 })
    await run(ctx.actor, vehicleId, body)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { vehicleId } = await params
    const u = new URL(req.url)
    return NextResponse.json(await deleteVehicleEntry(ctx.actor, vehicleId, u.searchParams.get("kind") ?? "", u.searchParams.get("id") ?? ""))
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
