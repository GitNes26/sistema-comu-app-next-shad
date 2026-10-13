import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { CellWorkspace } from "@/components/cells/cell-workspace"

export const metadata: Metadata = { title: "Célula" }

// El acceso real (permiso global o relación con la célula) lo decide la API.
export default async function AdminCellPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const { id } = await params
  return <CellWorkspace cellId={id} backHref="/admin/cells" />
}
