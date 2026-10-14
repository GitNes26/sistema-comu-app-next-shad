import type { Metadata } from "next"
import { OrgChart } from "@/components/org/org-chart"

export const metadata: Metadata = { title: "Organigrama" }

export default function OrgChartPage() {
  return <OrgChart />
}
