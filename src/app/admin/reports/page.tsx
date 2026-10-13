import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { BarChart3 } from "lucide-react"
import { ministriesActor } from "@/lib/ministries/api"
import { listReports } from "@/lib/reports/server"
import { PageHeader } from "@/components/layout/page-header"
import { ReportsCenter } from "@/components/reports/reports-center"

export const metadata: Metadata = { title: "Reportes" }

// Reportes: cada persona ve solo los de los módulos que su rol y su plan incluyen.
export default async function AdminReportsPage() {
  const ctx = await ministriesActor()
  if ("response" in ctx) redirect("/admin")
  const reports = listReports(ctx.actor)
  if (reports.length === 0) redirect("/admin")
  return (
    <div className="space-y-4">
      <PageHeader icon={<BarChart3 className="size-5" />} title="Reportes" description="Consulta el periodo que necesites y expórtalo a PDF." />
      <ReportsCenter reports={reports} />
    </div>
  )
}
