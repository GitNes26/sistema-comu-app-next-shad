import type { Metadata } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ContentFeed } from "@/components/portal/content-feed"

export const metadata: Metadata = { title: "Noticias" }

export default async function MyContentPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const canManage = hasPermission(session, "content.manage")
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/mi">
          <ArrowLeft className="size-4" />
          Mi espacio
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Noticias</h1>
        <p className="text-sm text-muted-foreground">Anuncios, devocionales y novedades de tu iglesia.</p>
      </div>
      <ContentFeed canManage={canManage} />
    </div>
  )
}
