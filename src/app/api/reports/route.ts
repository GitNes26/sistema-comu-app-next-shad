import { NextResponse } from "next/server"
import { listReports } from "@/lib/reports/server"
import { ministriesActor } from "@/lib/ministries/api"

export const dynamic = "force-dynamic"

// GET → reportes disponibles para la persona (según sus permisos).
export async function GET() {
  const ctx = await ministriesActor()
  if ("response" in ctx) return ctx.response
  return NextResponse.json({ ok: true, reports: listReports(ctx.actor) })
}
