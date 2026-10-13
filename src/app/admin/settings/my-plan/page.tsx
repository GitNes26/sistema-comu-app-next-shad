import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { BadgeDollarSign, Building2, Check, Lock, MessageCircle, Users } from "lucide-react"
import { PERMISSION_MODULE_LABELS, permissionsByModule } from "@/lib/auth/permission-keys"
import { planDeniedKeys } from "@/lib/billing/plan-permissions"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { subscriptionUsage } from "@/lib/billing/subscriptions"
import { prisma } from "@/lib/db"
import { planSupportUrl } from "@/lib/contact"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Mi plan" }

/** Módulos que el plan deja completamente fuera. */
function excludedModules(planPermissions: unknown) {
  const denied = new Set<string>(planDeniedKeys(planPermissions))
  if (!denied.size) return []
  return Object.entries(permissionsByModule())
    .filter(([, perms]) => perms.every((p) => denied.has(p.key)))
    .map(([module]) => PERMISSION_MODULE_LABELS[module] ?? module)
}

export default async function Page({ searchParams }: { searchParams: Promise<{ bloqueado?: string }> }) {
  const { bloqueado } = await searchParams
  const session = await getServerSession(authOptions)
  const organizationId = effectiveOrgId(session)
  if (!organizationId) redirect("/admin")
  const [usage, plans] = await Promise.all([
    subscriptionUsage(organizationId),
    prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } }),
  ])
  const subscription = usage.subscription
  return <div className="space-y-5">
    <PageHeader icon={<BadgeDollarSign />} title="Mi plan" description="Consulta tu capacidad actual y pide ayuda para elegir o actualizar tu plan." />
    {bloqueado && <div role="status" className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"><Lock className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Esa sección no está incluida en tu plan actual</p><p className="text-muted-foreground">Actualiza tu plan para usarla; abajo ves qué incluye cada uno.</p></div></div>}
    <Card><CardContent className="grid gap-4 p-5 md:grid-cols-3">
      <div><p className="text-sm text-muted-foreground">Plan actual</p><p className="text-2xl font-semibold">{subscription?.plan.name ?? "Sin plan asignado"}</p><p className="text-sm text-muted-foreground">{subscription ? `Vence ${new Date(subscription.periodEndsAt).toLocaleDateString("es-MX")}` : "Contacta a la plataforma"}</p></div>
      <div><p className="flex gap-2 font-medium"><Building2 className="size-5" />Sedes</p><p className="text-2xl font-semibold">{usage.locations} / {usage.locationLimit ?? "—"}</p></div>
      <div><p className="flex gap-2 font-medium"><Users className="size-5" />Creyentes activos</p><p className="text-2xl font-semibold">{usage.employees} / {usage.employeeLimit ?? "—"}</p></div>
    </CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-3">{plans.map((plan) => {
      const isCurrent = subscription?.planId === plan.id
      return <Card key={plan.id}><CardContent className="space-y-4 p-5">
        <h2 className="text-xl font-semibold">{plan.name}</h2>
        <p className="text-3xl font-semibold">${Number(plan.monthlyPrice).toLocaleString("es-MX")}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
        <p className="text-sm">{plan.includedLocations} sede(s) · {plan.includedEmployees} creyentes</p>
        <ul className="space-y-2 text-sm">{(plan.features as string[]).map((feature) => <li key={feature} className="flex gap-2"><Check className="size-4 text-primary" />{feature}</li>)}</ul>
        {excludedModules(plan.permissions).length > 0 && <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground"><Lock className="mt-0.5 size-3.5 shrink-0" />No incluye: {excludedModules(plan.permissions).join(", ")}</p>}
        <Button asChild variant={isCurrent ? "secondary" : "default"} className="w-full"><a href={planSupportUrl(plan)} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />{isCurrent ? "Consultar mi plan" : "Solicitar actualización"}</a></Button>
      </CardContent></Card>
    })}</div>
  </div>
}
