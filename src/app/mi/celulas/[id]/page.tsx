import type { Metadata } from "next"
import { CellWorkspace } from "@/components/cells/cell-workspace"

export const metadata: Metadata = { title: "Célula" }

export default async function MyCellPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CellWorkspace cellId={id} backHref="/mi/celulas" />
}
