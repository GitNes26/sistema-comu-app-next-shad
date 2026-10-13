import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CellsList } from "@/components/cells/cells-list"

export const metadata: Metadata = { title: "Mis células" }

// Las células propias salen de la relación (líder, apoyo, integrante, anfitrión o
// encargado de red); un líder con varias las ve todas, cada una con su horario.
export default function MyCellsPage() {
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/mi">
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mis células</h1>
        <p className="text-sm text-muted-foreground">Las células donde participas o que lideras.</p>
      </div>
      <CellsList scope="mine" basePath="/mi/celulas" />
    </div>
  )
}
