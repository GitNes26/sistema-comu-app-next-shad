import type { Metadata } from "next"
import { WorshipWorkspace } from "@/components/worship/worship-workspace"

export const metadata: Metadata = { title: "Alabanza" }

export default async function MyWorshipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorshipWorkspace ministryId={id} backHref="/mi/ministerios" />
}
