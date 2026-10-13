import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { VehiclesAdmin } from "@/components/finance/vehicles-admin"

export const metadata: Metadata = { title: "Vehículos" }

export default async function AdminVehiclesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const manage = hasPermission(session, "vehicles.manage")
  if (!manage && !hasPermission(session, "vehicles.view")) redirect("/admin")
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Vehículos</h1>
        <p className="text-sm text-muted-foreground">Bitácora, mantenimiento, combustible y documentos con su vencimiento.</p>
      </div>
      <VehiclesAdmin canManage={manage} />
    </div>
  )
}
