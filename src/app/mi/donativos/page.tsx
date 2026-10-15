import type { Metadata } from "next"
import { HandHeart } from "lucide-react"
import { PageHero } from "@/components/mi/page-hero"
import { MyDonations } from "@/components/finance/my-donations"

export const metadata: Metadata = { title: "Donativos" }

export default function MyDonationsPage() {
  return (
    <div className="w-full space-y-5">
      <PageHero icon={HandHeart} title="Donativos" description="Diezmos, ofrendas y donativos a la iglesia." />
      <MyDonations />
    </div>
  )
}
