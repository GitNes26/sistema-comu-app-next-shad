import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { ConsolidationWorkspace } from "@/components/consolidation/consolidation-workspace"

export const metadata: Metadata = { title: "Consolidación" }

export default async function ConsolidationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const { id } = await params
  return <ConsolidationWorkspace ministryId={id} backHref="/admin/ministries" />
}
