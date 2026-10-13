import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { WorshipWorkspace } from "@/components/worship/worship-workspace"

export const metadata: Metadata = { title: "Alabanza" }

export default async function AdminWorshipPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const { id } = await params
  return <WorshipWorkspace ministryId={id} backHref="/admin/ministries" />
}
