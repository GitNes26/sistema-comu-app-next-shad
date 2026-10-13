import { NextResponse } from "next/server"
import { getVehicle, saveVehicle } from "@/lib/finance/server"
import { ministriesActor, ministryErrorResponse, readJson } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → bitácora, servicios, combustible y documentos. PUT → edita.
export async function GET(_req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { vehicleId } = await params
    return NextResponse.json({ ok: true, vehicle: await getVehicle(ctx.actor, vehicleId) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  try {
    const { vehicleId } = await params
    return NextResponse.json({ ok: true, ...(await saveVehicle(ctx.actor, vehicleId, await readJson(req))) })
  } catch (err) {
    return ministryErrorResponse(err)
  }
}
