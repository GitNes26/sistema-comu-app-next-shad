import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { FinanceAdmin } from "@/components/finance/finance-admin"

export const metadata: Metadata = { title: "Finanzas" }

export default async function AdminFinancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const manage = hasPermission(session, "finance.manage")
  const view = manage || hasPermission(session, "finance.view")
  const payroll = hasPermission(session, "payroll.manage")
  if (!view && !payroll) redirect("/admin")
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">Ingresos, gastos, donativos y nómina de la iglesia.</p>
      </div>
      <FinanceAdmin canManage={manage} canPayroll={payroll} canVehicles={hasPermission(session, "vehicles.view") || hasPermission(session, "vehicles.manage")} />
    </div>
  )
}
