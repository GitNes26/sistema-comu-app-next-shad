import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { PayrollPeriodView } from "@/components/payroll/payroll-period"

export const metadata: Metadata = { title: "Nómina" }

export default async function AdminPayrollPeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  if (!hasPermission(session, "payroll.manage")) redirect("/admin")
  const { id } = await params
  return <PayrollPeriodView id={id} />
}
