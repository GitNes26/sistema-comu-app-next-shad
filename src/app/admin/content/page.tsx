import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { ContentAdmin } from "@/components/portal/content-admin"

export const metadata: Metadata = { title: "Contenido y transmisiones" }

export default async function AdminContentPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  if (!hasPermission(session, "content.manage")) redirect("/admin")
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Contenido y transmisiones</h1>
        <p className="text-sm text-muted-foreground">Publica anuncios y devocionales, y programa las transmisiones que verán los creyentes.</p>
      </div>
      <ContentAdmin />
    </div>
  )
}
