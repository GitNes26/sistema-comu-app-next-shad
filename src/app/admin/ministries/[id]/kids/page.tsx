import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { KidsWorkspace } from "@/components/kids/kids-workspace"

export const metadata: Metadata = { title: "Comunidad Kids" }

export default async function KidsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const { id } = await params
  return <KidsWorkspace ministryId={id} backHref="/admin/ministries" />
}
