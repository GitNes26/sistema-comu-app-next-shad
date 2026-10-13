import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { MinistryWorkspace } from "@/components/ministries/ministry-workspace"

export const metadata: Metadata = { title: "Ministerio" }

// Espacio de trabajo desde el panel. El acceso real (permiso global o ser líder/
// servidor del ministerio) lo decide la API; aquí solo se exige sesión.
export default async function AdminMinistryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const { id } = await params
  return <MinistryWorkspace ministryId={id} backHref="/admin/ministries" backLabel="Ministerios" />
}
