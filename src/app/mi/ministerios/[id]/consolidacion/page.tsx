import type { Metadata } from "next"
import { ConsolidationWorkspace } from "@/components/consolidation/consolidation-workspace"

export const metadata: Metadata = { title: "Consolidación" }

export default async function ConsolidationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ConsolidationWorkspace ministryId={id} backHref="/mi/ministerios" />
}
