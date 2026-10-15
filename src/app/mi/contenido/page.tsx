import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { Newspaper } from "lucide-react"
import { PageHero } from "@/components/mi/page-hero"
import { ContentFeed } from "@/components/portal/content-feed"

export const metadata: Metadata = { title: "Noticias" }

export default async function MyContentPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const canManage = hasPermission(session, "content.manage")
  return (
    <div className="w-full space-y-5">
      <PageHero icon={Newspaper} title="Noticias" description="Anuncios, devocionales y novedades de tu iglesia." />
      <ContentFeed canManage={canManage} />
    </div>
  )
}
