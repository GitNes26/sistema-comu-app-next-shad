import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GatheringsOverview } from "@/components/gatherings/gatherings-overview"

export const metadata: Metadata = { title: "Reuniones" }

export default function MyGatheringsPage() {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/mi">
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Reuniones</h1>
        <p className="text-sm text-muted-foreground">Cuándo nos reunimos y de qué se ha hablado.</p>
      </div>
      <GatheringsOverview />
    </div>
  )
}
