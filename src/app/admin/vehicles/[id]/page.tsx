import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { VehicleWorkspace } from "@/components/finance/vehicles-admin"

export const metadata: Metadata = { title: "Vehículo" }

export default async function AdminVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const manage = hasPermission(session, "vehicles.manage")
  if (!manage && !hasPermission(session, "vehicles.view")) redirect("/admin")
  const { id } = await params
  return <VehicleWorkspace vehicleId={id} canManage={manage} />
}
