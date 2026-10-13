import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MyDonations } from "@/components/finance/my-donations"

export const metadata: Metadata = { title: "Donativos" }

export default function MyDonationsPage() {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/mi">
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Donativos</h1>
        <p className="text-sm text-muted-foreground">Diezmos, ofrendas y donativos a la iglesia.</p>
      </div>
      <MyDonations />
    </div>
  )
}
