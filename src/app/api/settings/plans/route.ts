import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db"
import { hasPermission } from "@/lib/auth/permissions"
import { Prisma } from "@/generated/prisma/client"
import { DEFAULT_PLAN_FEATURES } from "@/lib/billing/subscriptions"
import { sanitizePlanPermissions } from "@/lib/billing/plan-permissions"

export async function GET() {
  const session = await getServerSession(authOptions)
  const plans = await prisma.subscriptionPlan.findMany({ where: hasPermission(session, "organizations.manage") ? {} : { isActive: true }, orderBy: [{ sortOrder: "asc" }, { monthlyPrice: "asc" }] })
  return NextResponse.json({ ok: true, plans })
}
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!hasPermission(session, "organizations.manage")) return NextResponse.json({ ok: false, error: "Solo el superadministrador puede gestionar planes" }, { status: 403 })
  try {
    const body = await request.json()
    if (body.action === "delete") { await prisma.subscriptionPlan.update({ where: { id: String(body.id) }, data: { isActive: false } }); return NextResponse.json({ ok: true }) }
    const data = { name: String(body.name ?? "").trim(), description: String(body.description ?? "").trim() || null, monthlyPrice: Number(body.monthlyPrice), includedLocations: Math.max(1, Number(body.includedLocations)), includedEmployees: Math.max(1, Number(body.includedEmployees)), extraLocationPrice: Math.max(0, Number(body.extraLocationPrice)), extraEmployeePackSize: Math.max(1, Number(body.extraEmployeePackSize)), extraEmployeePackPrice: Math.max(0, Number(body.extraEmployeePackPrice)), features: Array.isArray(body.features) ? body.features.filter(Boolean) : DEFAULT_PLAN_FEATURES, permissions: (() => { const p = sanitizePlanPermissions(body.permissions); return p === null ? Prisma.DbNull : p })(), isActive: body.isActive !== false, sortOrder: Number(body.sortOrder ?? 0) }
    if (!data.name || !Number.isFinite(data.monthlyPrice) || data.monthlyPrice < 0) throw new Error("Revisa el nombre y precio mensual")
    const plan = body.id ? await prisma.subscriptionPlan.update({ where: { id: String(body.id) }, data }) : await prisma.subscriptionPlan.create({ data })
    return NextResponse.json({ ok: true, plan })
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No fue posible guardar el plan" }, { status: 400 }) }
}
