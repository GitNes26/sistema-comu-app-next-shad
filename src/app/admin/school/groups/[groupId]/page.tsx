import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { Gradebook } from "@/components/school/gradebook"

export const metadata: Metadata = { title: "Grupo" }

export default async function AdminGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const { groupId } = await params
  return <Gradebook groupId={groupId} backHref="/admin/school" />
}
