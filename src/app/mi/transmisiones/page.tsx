import type { Metadata } from "next"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth/options"
import { hasPermission } from "@/lib/auth/permissions"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StreamsView } from "@/components/portal/streams-view"

export const metadata: Metadata = { title: "Transmisiones" }

export default async function MyStreamsPage() {
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
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Transmisiones</h1>
        <p className="text-sm text-muted-foreground">Mira los servicios y eventos de tu iglesia en vivo o cuando quieras.</p>
      </div>
      <StreamsView canManage={canManage} />
    </div>
  )
}
