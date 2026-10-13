import type { Metadata } from "next"
import { KidsWorkspace } from "@/components/kids/kids-workspace"

export const metadata: Metadata = { title: "Comunidad Kids" }

export default async function KidsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <KidsWorkspace ministryId={id} backHref="/mi/ministerios" />
}
