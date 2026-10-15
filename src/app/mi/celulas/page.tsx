import type { Metadata } from "next"
import { MyCellsTabs } from "@/components/cells/my-cells-tabs"

export const metadata: Metadata = { title: "Mi hogar de amor" }

// El hogar de amor (grupo en casa = célula) propio sale de la relación (líder, apoyo,
// integrante, anfitrión o encargado de red). El buscador vive en la misma página.
export default async function MyCellsPage({ searchParams }: { searchParams: Promise<{ buscar?: string }> }) {
  const { buscar } = await searchParams
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mi hogar de amor</h1>
        <p className="text-sm text-muted-foreground">La reunión en casa donde participas o que lideras, y cómo encontrar la más cercana.</p>
      </div>
      <MyCellsTabs initial={buscar ? "find" : "mine"} />
    </div>
  )
}
