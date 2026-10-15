import type { Metadata } from "next"
import { Home } from "lucide-react"
import { CellFinder } from "@/components/cells/cell-finder"

export const metadata: Metadata = { title: "Hogares de amor" }

export default function HomesPortalPage() {
  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
          <Home className="size-6 text-primary" /> Hogares de amor
        </h1>
        <p className="text-sm text-muted-foreground">Encuentra el hogar de amor (grupo en casa) más cercano y pide unirte.</p>
      </div>
      <CellFinder mode={{ kind: "portal" }} />
    </div>
  )
}
