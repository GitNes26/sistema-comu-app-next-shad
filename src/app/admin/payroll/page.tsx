import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { PayrollPage } from "@/components/payroll/payroll-page"

export const metadata: Metadata = { title: "Nómina" }

export default async function AdminPayrollPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  if (!hasPermission(session, "payroll.manage")) redirect("/admin")
  return <PayrollPage />
}
