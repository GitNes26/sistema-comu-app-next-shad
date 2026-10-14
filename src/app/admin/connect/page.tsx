import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { ConnectAdmin } from "@/components/connect/connect-admin"

export const metadata: Metadata = { title: "Conexión y oración" }

export default async function AdminConnectPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  if (!hasPermission(session, "members.manage")) redirect("/admin")
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Conexión y oración</h1>
        <p className="text-sm text-muted-foreground">Quienes llegan desde la página pública y las peticiones de oración de tu iglesia.</p>
      </div>
      <ConnectAdmin />
    </div>
  )
}
