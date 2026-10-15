import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { Radio } from "lucide-react"
import { PageHero } from "@/components/mi/page-hero"
import { StreamsView } from "@/components/portal/streams-view"

export const metadata: Metadata = { title: "Transmisiones" }

export default async function MyStreamsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/auth/login")
  const canManage = hasPermission(session, "content.manage")
  return (
    <div className="w-full space-y-5">
      <PageHero icon={Radio} title="Transmisiones" description="Mira los servicios y eventos de tu iglesia en vivo o cuando quieras." />
      <StreamsView canManage={canManage} />
    </div>
  )
}
