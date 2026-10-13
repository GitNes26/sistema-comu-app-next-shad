import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { CellsList } from "@/components/cells/cells-list"

export const metadata: Metadata = { title: "Células y redes" }

export default async function AdminCellsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  if (!hasPermission(session, "cells.view")) redirect("/mi/celulas")
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Células y redes</h1>
        <p className="text-sm text-muted-foreground">Cada célula con su tipo, día, hora y líderes; agrupadas en redes.</p>
      </div>
      <CellsList scope="all" basePath="/admin/cells" />
    </div>
  )
}
