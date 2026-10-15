import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { FamiliesAdmin } from "@/components/families/families-admin"

export const metadata: Metadata = { title: "Familias" }

export default async function AdminFamiliesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  if (!hasPermission(session, "members.manage")) redirect("/admin")
  return <FamiliesAdmin />
}
